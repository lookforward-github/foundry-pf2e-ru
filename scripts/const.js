export const MODULE_ID = "pf2e-ru";

/** Язык, под которым модуль регистрирует переводы в Babele. */
export const LANG = "ru";

/** Каталог с Babele-переводами внутри модуля (см. tools/pipeline/emit.ts). */
export const TRANSLATIONS_DIR = "translations/ru";

export const log = {
  info: (...args) => console.log(`${MODULE_ID} |`, ...args),
  warn: (...args) => console.warn(`${MODULE_ID} |`, ...args),
  error: (...args) => console.error(`${MODULE_ID} |`, ...args),
};
