import { LANG, log, MODULE_ID, TRANSLATIONS_DIR } from "../const.js";
import { CONVERTERS, MAPPING } from "./converters.js";

/**
 * Babele подменяет содержимое компендиумов в памяти, читая JSON из указанного
 * каталога модуля. Файлы там называются по имени пака: `pf2e.spells-srd.json`.
 *
 * @param {object} babele экземпляр game.babele
 */
export function registerBabele(babele) {
  babele.registerMapping(MAPPING);
  babele.registerConverters(CONVERTERS);
  babele.register({
    module: MODULE_ID,
    lang: LANG,
    dir: TRANSLATIONS_DIR,
  });
  log.info(`Babele: зарегистрирован каталог ${TRANSLATIONS_DIR}`);
}
