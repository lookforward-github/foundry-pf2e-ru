/**
 * Линтер артефактов сборки: lang/ и translations/ru/.
 *
 * Проверяет то, что Foundry молча проглотит, а игрок увидит как поломку:
 * битый JSON, неверная форма babele-файла, нераскрытые плейсхолдеры и
 * обрубленные ссылки-энричеры вроде @UUID[...].
 */
import path from "node:path";
import { listJsonFiles, readJson } from "./lib/json";
import { fail, log, logSample } from "./lib/log";
import { PATHS, relFromRoot } from "./lib/paths";
import { findPlaceholders } from "./pipeline/placeholders";

const problems: string[] = [];

function report(file: string, message: string): void {
  problems.push(`${relFromRoot(file)}: ${message}`);
}

/** Незакрытая скобка энричера ломает рендер всего описания. */
function checkEnrichers(file: string, where: string, text: string): void {
  const opener = /@([A-Za-z]+)\[/g;
  let match: RegExpExecArray | null;

  while ((match = opener.exec(text)) !== null) {
    const contentStart = match.index + match[0].length;
    const close = text.indexOf("]", contentStart);
    if (close < 0) {
      report(file, `${where}: не закрыта скобка у @${match[1]}[`);
      continue;
    }
    if (close === contentStart) {
      report(file, `${where}: пустой @${match[1]}[]`);
      continue;
    }
    if (match[1] === "UUID") {
      const uuid = text.slice(contentStart, close);
      if (uuid.startsWith("Compendium.") && uuid.split(".").length < 4) {
        report(file, `${where}: подозрительный UUID «${uuid}»`);
      }
    }
  }
}

function checkText(file: string, where: string, text: string): void {
  const leftover = findPlaceholders(text);
  if (leftover.length > 0) {
    report(file, `${where}: нераскрытые плейсхолдеры ${[...new Set(leftover)].join(", ")}`);
  }
  checkEnrichers(file, where, text);
}

function validateI18n(file: string): number {
  const payload = readJson<Record<string, unknown>>(file);
  let count = 0;

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value !== "string") {
      report(file, `ключ «${key}»: ожидалась строка, получено ${typeof value}`);
      continue;
    }
    checkText(file, `ключ «${key}»`, value);
    count += 1;
  }
  return count;
}

function validateBabele(file: string): number {
  const payload = readJson<Record<string, unknown>>(file);

  if (typeof payload.label !== "string" || payload.label === "") {
    report(file, "отсутствует непустое поле label");
  }
  const entries = payload.entries;
  if (entries === null || typeof entries !== "object" || Array.isArray(entries)) {
    report(file, "отсутствует объект entries");
    return 0;
  }

  let count = 0;
  for (const [key, record] of Object.entries(entries as Record<string, unknown>)) {
    if (record === null || typeof record !== "object" || Array.isArray(record)) {
      report(file, `запись «${key}»: ожидался объект полей`);
      continue;
    }
    for (const [field, value] of Object.entries(record as Record<string, unknown>)) {
      if (typeof value !== "string") {
        report(file, `«${key}».${field}: ожидалась строка, получено ${typeof value}`);
        continue;
      }
      checkText(file, `«${key}».${field}`, value);
    }
    count += 1;
  }
  return count;
}

function main(): void {
  log.step("Проверка артефактов сборки");

  const langFiles = listJsonFiles(PATHS.outLang);
  const packFiles = listJsonFiles(PATHS.outTranslations);

  if (langFiles.length === 0 && packFiles.length === 0) {
    throw new Error("Нечего проверять: lang/ и translations/ru/ пусты. Запустите `npm run build`.");
  }

  let langKeys = 0;
  for (const file of langFiles) langKeys += validateI18n(file);
  log.info(`lang/: ${langFiles.length} файл(ов), ${langKeys} ключ(ей)`);

  let packEntries = 0;
  for (const file of packFiles) packEntries += validateBabele(file);
  log.info(`translations/ru/: ${packFiles.length} пак(ов), ${packEntries} запис(ей)`);

  const dirName = path.basename(PATHS.outTranslations);
  if (dirName !== "ru") {
    log.warn(`Каталог переводов называется «${dirName}» — Babele регистрируется на lang "ru"`);
  }

  if (problems.length > 0) {
    log.error(`Найдено проблем: ${problems.length}`);
    logSample(problems, 40, "    ");
    process.exit(1);
  }

  log.ok("Проблем не найдено");
}

try {
  main();
} catch (error) {
  fail(error);
}
