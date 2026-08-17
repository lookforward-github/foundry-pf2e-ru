/**
 * Фаза build: выгрузки + data/ → lang/ru.json и translations/ru/*.json.
 *
 * Никакой сети. Один и тот же коммит всегда даёт один и тот же результат.
 *
 * Флаги:
 *   --allow-unresolved  не падать на нераскрытых плейсхолдерах (режим черновика)
 *   --check             ничего не менять молча: упасть, если результат отличается
 *                       от закоммиченного (используется в CI)
 */
import { loadSheetsConfig } from "./config";
import { readJsonIfExists } from "./lib/json";
import { fail, log, logSample } from "./lib/log";
import { PATHS, relFromRoot } from "./lib/paths";
import { emit } from "./pipeline/emit";
import { mergeBabeleLayer, mergeI18nLayer } from "./pipeline/merge";
import { normalizeSheets } from "./pipeline/normalize";
import { buildLookup, resolveBuckets } from "./pipeline/placeholders";
import { countValues } from "./pipeline/types";
import { collectEntries, collectTerms, createApi } from "./sources/api/provider";
import { loadSnapshots } from "./sources/snapshot";

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  const allowUnresolved = hasFlag("allow-unresolved");
  const checkOnly = hasFlag("check");

  // 1. Листы → бакеты
  log.step("Чтение выгрузок листов");
  const config = loadSheetsConfig();
  const snapshots = loadSnapshots();
  if (snapshots.size === 0) {
    throw new Error(
      `В ${relFromRoot(PATHS.sheetsSnapshot)} нет выгрузок.` + " Запустите `npm run pull:sheets`.",
    );
  }
  const { buckets, stats } = normalizeSheets(config, snapshots);
  for (const stat of stats) {
    log.info(
      `${stat.sheet} → ${stat.target}: взято ${stat.taken} из ${stat.rows}` +
        ` (без ключа ${stat.skippedNoKey}, по правилу ${stat.skippedByRule},` +
        ` без перевода ${stat.skippedEmpty})`,
    );
  }

  // 2. Ручные слои поверх листов
  log.step("Наложение ручных слоёв из data/");
  const fromLang = mergeI18nLayer(buckets, PATHS.dataLang);
  const fromManual = mergeBabeleLayer(buckets, PATHS.dataManual, "manual");
  const fromOverrides = mergeBabeleLayer(buckets, PATHS.dataOverrides, "overrides");
  log.info(`data/lang: ${fromLang}, data/manual: ${fromManual}, data/overrides: ${fromOverrides}`);

  // 3. Плейсхолдеры → данные API
  log.step("Подстановка данных API");
  const api = createApi();
  log.info(`Режим ${api.mode}, источник ${api.origin}`);
  const entries = await collectEntries(api);
  const terms = await collectTerms(api);
  const localTerms = readJsonIfExists<Record<string, string>>(PATHS.dataGlossary) ?? {};
  log.info(
    `Доступно: ${entries.length} сущностей, ${terms.length} терминов API,` +
      ` ${Object.keys(localTerms).length} терминов локального глоссария`,
  );

  const resolved = resolveBuckets(buckets, buildLookup(entries, terms, localTerms));
  log.info(`Подставлено значений: ${resolved.replaced}`);
  if (resolved.fromLocalGlossary.size > 0) {
    log.info(
      `Из локального глоссария (в API этих терминов нет): ${[...resolved.fromLocalGlossary].join(", ")}`,
    );
  }

  if (resolved.unresolved.size > 0) {
    const report = [...resolved.unresolved.entries()].map(
      ([placeholder, places]) =>
        `${placeholder} — ${places.length} мест(о), например: ${places[0]}`,
    );
    const message = `Нераскрытых плейсхолдеров: ${resolved.unresolved.size}`;
    if (allowUnresolved) {
      log.warn(`${message} (пропущено из-за --allow-unresolved)`);
      logSample(report);
    } else {
      log.error(message);
      logSample(report, 30);
      throw new Error(
        "Сборка остановлена. Дополните выгрузку API или запустите с --allow-unresolved," +
          " чтобы собрать черновик.",
      );
    }
  }

  // 4. Запись артефактов
  log.step("Запись файлов модуля");
  const results = emit(buckets, PATHS.outTranslations);
  const changed = results.filter((result) => result.changed);
  for (const result of results) {
    log.info(`${result.target}: ${result.keys} запис(ей)${result.changed ? " — обновлено" : ""}`);
  }

  const totalValues = [...buckets.values()].reduce((sum, b) => sum + countValues(b), 0);
  log.ok(`Готово: ${buckets.size} файл(ов), ${totalValues} переведённых значени(й)`);

  if (checkOnly && changed.length > 0) {
    throw new Error(
      `--check: результат сборки отличается от закоммиченного (${changed.length} файл(ов)).` +
        " Запустите `npm run build` локально и закоммитьте результат.",
    );
  }
  if (changed.length === 0) log.info("Изменений относительно закоммиченного нет");
}

main().catch(fail);
