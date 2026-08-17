/**
 * Покрытие перевода: сколько строк реально доехало до модуля и где дырки.
 * Читает только артефакты сборки, ничего не меняет.
 */
import { listJsonFiles, readJson } from "./lib/json";
import { fail, log } from "./lib/log";
import { PATHS, relFromRoot } from "./lib/paths";
import { findPlaceholders } from "./pipeline/placeholders";

interface Row {
  target: string;
  entries: number;
  values: number;
  placeholders: number;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function padLeft(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value;
}

function printTable(rows: readonly Row[]): void {
  const nameWidth = Math.max(6, ...rows.map((row) => row.target.length));
  console.log(
    `\n  ${pad("файл", nameWidth)}  ${padLeft("записей", 8)}  ${padLeft("строк", 8)}  ${padLeft("{{…}}", 6)}`,
  );
  console.log(`  ${"─".repeat(nameWidth)}  ${"─".repeat(8)}  ${"─".repeat(8)}  ${"─".repeat(6)}`);

  for (const row of rows) {
    console.log(
      `  ${pad(row.target, nameWidth)}  ${padLeft(String(row.entries), 8)}` +
        `  ${padLeft(String(row.values), 8)}` +
        `  ${padLeft(row.placeholders > 0 ? String(row.placeholders) : "—", 6)}`,
    );
  }
}

function main(): void {
  const rows: Row[] = [];

  for (const file of listJsonFiles(PATHS.outLang)) {
    const payload = readJson<Record<string, unknown>>(file);
    const values = Object.values(payload).filter(
      (value): value is string => typeof value === "string",
    );
    rows.push({
      target: relFromRoot(file),
      entries: values.length,
      values: values.length,
      placeholders: values.reduce((sum, value) => sum + findPlaceholders(value).length, 0),
    });
  }

  for (const file of listJsonFiles(PATHS.outTranslations)) {
    const payload = readJson<{ entries?: Record<string, Record<string, unknown>> }>(file);
    const entries = Object.values(payload.entries ?? {});
    let values = 0;
    let placeholders = 0;

    for (const record of entries) {
      for (const value of Object.values(record)) {
        if (typeof value !== "string") continue;
        values += 1;
        placeholders += findPlaceholders(value).length;
      }
    }

    rows.push({ target: relFromRoot(file), entries: entries.length, values, placeholders });
  }

  if (rows.length === 0) {
    throw new Error("Артефактов нет. Запустите `npm run build`.");
  }

  printTable(rows);

  const total = rows.reduce(
    (acc, row) => ({
      entries: acc.entries + row.entries,
      values: acc.values + row.values,
      placeholders: acc.placeholders + row.placeholders,
    }),
    { entries: 0, values: 0, placeholders: 0 },
  );

  console.log("");
  log.info(`Всего: ${total.entries} запис(ей), ${total.values} строк перевода`);
  if (total.placeholders > 0) {
    log.warn(`Осталось нераскрытых плейсхолдеров: ${total.placeholders}`);
  }
}

try {
  main();
} catch (error) {
  fail(error);
}
