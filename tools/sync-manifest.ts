/**
 * Держит module.json в согласии с тем, что реально лежит в репозитории:
 * объявляет lang/ru.json в languages и проверяет обязательные для перевода
 * связи (система pf2e, модуль Babele).
 */
import fs from "node:fs";
import { readJson, writeJsonIfChanged } from "./lib/json";
import { fail, log } from "./lib/log";
import { fromRoot, I18N_TARGET, PATHS, relFromRoot } from "./lib/paths";

interface Manifest {
  languages?: { lang: string; name: string; path: string }[];
  relationships?: {
    systems?: { id: string }[];
    requires?: { id: string }[];
  };
  esmodules?: string[];
  styles?: string[];
}

function main(): void {
  const manifest = readJson<Manifest>(PATHS.moduleJson);

  const languages = [{ lang: "ru", name: "Русский", path: I18N_TARGET }];
  const before = JSON.stringify(manifest.languages ?? []);
  manifest.languages = languages;

  if (before !== JSON.stringify(languages)) {
    log.info(`languages ← ${I18N_TARGET}`);
  }

  // sort=false — порядок ключей в манифесте осмысленный, не трогаем.
  const changed = writeJsonIfChanged(PATHS.moduleJson, manifest, false);
  log.ok(changed ? "module.json обновлён" : "module.json уже в порядке");

  if (!fs.existsSync(fromRoot(I18N_TARGET))) {
    log.warn(`${I18N_TARGET} ещё не собран — запустите \`npm run build\``);
  }
  if (!manifest.relationships?.systems?.some((system) => system.id === "pf2e")) {
    log.warn("В relationships.systems нет pf2e — Foundry не свяжет модуль с системой");
  }
  if (!manifest.relationships?.requires?.some((module) => module.id === "babele")) {
    log.warn("В relationships.requires нет babele — переводы компендиумов не применятся");
  }
  for (const file of [...(manifest.esmodules ?? []), ...(manifest.styles ?? [])]) {
    if (!fs.existsSync(fromRoot(file))) {
      log.warn(`В манифесте объявлен несуществующий файл ${relFromRoot(fromRoot(file))}`);
    }
  }
}

try {
  main();
} catch (error) {
  fail(error);
}
