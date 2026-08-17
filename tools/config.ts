import { z } from "zod";
import { readJson } from "./lib/json";
import { optionalEnv } from "./lib/env";
import { BABELE_TARGET_DIR, I18N_TARGET, PATHS, relFromRoot } from "./lib/paths";

/**
 * `i18n`   — лист превращается в плоские ключ→строка для lang/ru.json;
 * `babele` — лист превращается в { label, entries } для одного пака.
 */
export const TargetKind = z.enum(["i18n", "babele"]);
export type TargetKind = z.infer<typeof TargetKind>;

export const SheetMapping = z
  .object({
    /** Имя листа в Google-таблице, ровно как на ярлычке. */
    sheet: z.string().min(1),
    type: TargetKind,
    /** Куда пишем результат, путь от корня репозитория. */
    target: z.string().min(1),
    /** Подпись пака в интерфейсе Foundry (только для type: "babele"). */
    packLabel: z.string().min(1).optional(),
    /** Колонка-ключ: для i18n это ключ локализации, для babele — англ. название. */
    keyColumn: z.string().min(1),
    /** Поле перевода → заголовок колонки. Для i18n обязателен ключ "value". */
    columns: z.record(z.string().min(1), z.string().min(1)),
    /** Пропустить строку, если в колонке одно из этих значений (пустая строка тоже подходит). */
    skipWhen: z.record(z.string().min(1), z.array(z.string())).optional(),
    /** Строки, где все переводы пустые, по умолчанию пропускаются молча. */
    warnOnEmpty: z.boolean().default(false),
  })
  .strict();
export type SheetMapping = z.infer<typeof SheetMapping>;

export const SheetsConfig = z
  .object({
    spreadsheetId: z.string().min(1),
    sheets: z.array(SheetMapping).min(1),
  })
  .strict();
export type SheetsConfig = z.infer<typeof SheetsConfig>;

/** Сырая выгрузка одного листа. Формат специально диффабельный: строки как объекты. */
export const SheetSnapshot = z
  .object({
    sheet: z.string(),
    header: z.array(z.string()),
    rows: z.array(z.record(z.string(), z.string())),
  })
  .strict();
export type SheetSnapshot = z.infer<typeof SheetSnapshot>;

function validateTargets(config: SheetsConfig): void {
  const seen = new Map<string, string>();

  for (const mapping of config.sheets) {
    if (mapping.type === "i18n") {
      if (!("value" in mapping.columns)) {
        throw new Error(
          `Лист «${mapping.sheet}»: для type "i18n" в columns обязателен ключ "value".`,
        );
      }
      if (mapping.target !== I18N_TARGET) {
        throw new Error(
          `Лист «${mapping.sheet}»: для type "i18n" target должен быть "${I18N_TARGET}",` +
            ` получено "${mapping.target}". Все i18n-листы сливаются в один файл.`,
        );
      }
    } else {
      if (!mapping.target.startsWith(`${BABELE_TARGET_DIR}/`)) {
        throw new Error(
          `Лист «${mapping.sheet}»: target для type "babele" должен лежать в` +
            ` ${BABELE_TARGET_DIR}/, получено "${mapping.target}".`,
        );
      }
      const previous = seen.get(mapping.target);
      if (previous) {
        throw new Error(
          `Листы «${previous}» и «${mapping.sheet}» пишут в один файл ${mapping.target}.` +
            ` Для babele-паков это запрещено: используйте разные target.`,
        );
      }
      seen.set(mapping.target, mapping.sheet);
    }
  }

  const duplicateSheets = config.sheets
    .map((mapping) => mapping.sheet)
    .filter((name, index, all) => all.indexOf(name) !== index);
  if (duplicateSheets.length > 0) {
    throw new Error(`Лист указан в конфиге дважды: ${[...new Set(duplicateSheets)].join(", ")}`);
  }
}

export function loadSheetsConfig(): SheetsConfig {
  const parsed = SheetsConfig.safeParse(readJson(PATHS.sheetsConfig));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  · ${issue.path.join(".") || "<корень>"}: ${issue.message}`)
      .join("\n");
    throw new Error(`${relFromRoot(PATHS.sheetsConfig)} не проходит проверку:\n${issues}`);
  }

  const config = parsed.data;
  const override = optionalEnv("GOOGLE_SPREADSHEET_ID");
  if (override) config.spreadsheetId = override;

  validateTargets(config);
  return config;
}
