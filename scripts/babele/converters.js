import { setting, SETTINGS } from "../settings.js";

/**
 * Babele-конвертеры вызываются для каждого замапленного поля.
 * Подпись: (originalValue, translation, source) => value
 */

/**
 * @param {string} original
 * @param {string | undefined} translation
 * @returns {string}
 */
export function nameConverter(original, translation) {
  if (!translation) return original;
  if (setting(SETTINGS.keepOriginalName) && translation !== original) {
    return `${translation} / ${original}`;
  }
  return translation;
}

/**
 * @param {string} original
 * @param {string | undefined} translation
 * @returns {string}
 */
export function descriptionConverter(original, translation) {
  if (!translation) return original;
  if (setting(SETTINGS.keepOriginalDescription) && translation !== original) {
    return `${translation}<hr /><details class="pf2e-ru-original"><summary>Оригинал</summary>${original}</details>`;
  }
  return translation;
}

export const CONVERTERS = {
  nameConverter,
  descriptionConverter,
};

/**
 * Маппинг «поле перевода → путь в документе». Ключи здесь — это те же имена,
 * которые допустимы в columns у babele-листов в sheets/sheets.config.json.
 */
export const MAPPING = {
  Item: {
    name: { path: "name", converter: "nameConverter" },
    description: { path: "system.description.value", converter: "descriptionConverter" },
  },
  Actor: {
    name: { path: "name", converter: "nameConverter" },
    description: { path: "system.details.publicNotes", converter: "descriptionConverter" },
  },
  JournalEntry: {
    name: { path: "name", converter: "nameConverter" },
  },
};
