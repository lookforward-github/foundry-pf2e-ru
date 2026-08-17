import { MODULE_ID } from "./const.js";

export const SETTINGS = {
  keepOriginalName: "keepOriginalName",
  keepOriginalDescription: "keepOriginalDescription",
};

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.keepOriginalName, {
    name: "Показывать оригинальное название",
    hint: "Дописывать английское название после русского: «Огненный шар / Fireball».",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.keepOriginalDescription, {
    name: "Показывать оригинальное описание",
    hint: "Добавлять оригинальный текст описания в раскрывающемся блоке под переводом.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });
}

/** @returns {boolean} */
export function setting(key) {
  return game.settings.get(MODULE_ID, key);
}
