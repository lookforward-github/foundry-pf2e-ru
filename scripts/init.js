import { registerBabele } from "./babele/register.js";
import { log, MODULE_ID } from "./const.js";
import { registerSettings } from "./settings.js";

Hooks.once("init", () => {
  registerSettings();

  // Babele может инициализироваться и раньше, и позже нас — покрываем оба случая.
  if (game.babele) {
    registerBabele(game.babele);
  } else {
    Hooks.once("babele.init", registerBabele);
  }
});

Hooks.once("ready", () => {
  const version = game.modules.get(MODULE_ID)?.version ?? "?";
  if (!game.modules.get("babele")?.active) {
    ui.notifications?.error(
      `${MODULE_ID}: для перевода компендиумов нужен активный модуль Babele.`,
      { permanent: true },
    );
  }
  log.info(`Загружен, версия ${version}`);
});
