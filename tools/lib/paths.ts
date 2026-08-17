import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Путь от корня репозитория. */
export function fromRoot(...parts: string[]): string {
  return path.join(ROOT, ...parts);
}

/** Путь относительно корня репозитория, всегда со слэшами — для логов и сравнений. */
export function relFromRoot(absolute: string): string {
  return path.relative(ROOT, absolute).split(path.sep).join("/");
}

export const PATHS = {
  moduleJson: fromRoot("module.json"),
  sheetsConfig: fromRoot("sheets", "sheets.config.json"),
  sheetsSnapshot: fromRoot("sheets", "snapshot"),
  apiFixtures: fromRoot("fixtures", "api"),
  dataLang: fromRoot("data", "lang"),
  dataManual: fromRoot("data", "manual"),
  dataOverrides: fromRoot("data", "overrides"),
  dataGlossary: fromRoot("data", "glossary", "terms.json"),
  outLang: fromRoot("lang"),
  outTranslations: fromRoot("translations", "ru"),
  cache: fromRoot(".cache"),
} as const;

/** Единственный i18n-файл, который объявлен в module.json → languages. */
export const I18N_TARGET = "lang/ru.json";

/** Каталог Babele-переводов, ожидаемый scripts/const.js → TRANSLATIONS_DIR. */
export const BABELE_TARGET_DIR = "translations/ru";
