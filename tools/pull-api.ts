/**
 * Фаза pull: API сайта переводов → fixtures/api/*.json.
 *
 * Файлы пишутся ровно в том виде, в котором их отдаёт сервер, и читаются
 * потом тем же кодом (FixtureApi), что и живой ответ. Поэтому «мок» и
 * «реальный API» не могут разойтись по структуре.
 *
 * Пока API нет: PF2E_RU_API_MODE=fixture — команда ничего не скачивает, а
 * только перечитывает и валидирует уже лежащую выгрузку.
 */
import fs from "node:fs";
import path from "node:path";
import { writeJsonIfChanged } from "./lib/json";
import { fail, log } from "./lib/log";
import { PATHS, relFromRoot } from "./lib/paths";
import { hasMorePages } from "./sources/api/contract";
import { entriesFixturePath, termsFixturePath } from "./sources/api/fixture";
import { createApi } from "./sources/api/provider";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

/** Удаляет страницы, оставшиеся от предыдущей, более длинной выгрузки. */
function prunePages(keep: Set<string>, pattern: RegExp): number {
  if (!fs.existsSync(PATHS.apiFixtures)) return 0;

  let removed = 0;
  for (const name of fs.readdirSync(PATHS.apiFixtures)) {
    if (!pattern.test(name)) continue;
    const absolute = path.resolve(PATHS.apiFixtures, name);
    if (keep.has(absolute)) continue;
    fs.rmSync(absolute);
    removed += 1;
  }
  return removed;
}

async function main(): Promise<void> {
  const api = createApi(argValue("source"));
  fs.mkdirSync(PATHS.apiFixtures, { recursive: true });

  log.step(`Выгрузка API: режим ${api.mode}, источник ${api.origin}`);
  if (api.mode === "fixture") {
    log.info("Режим fixture: сеть не используется, выгрузка только перечитывается и проверяется");
  }

  const writtenEntries = new Set<string>();
  let entryCount = 0;
  for (let page = 1; ; page += 1) {
    const response = await api.listEntries({ page });
    const file = entriesFixturePath(undefined, page);
    writtenEntries.add(path.resolve(file));
    writeJsonIfChanged(file, response, false);
    entryCount += response.data.length;
    log.info(`entries, страница ${page}: ${response.data.length} записей → ${relFromRoot(file)}`);
    if (!hasMorePages(response.meta) || response.data.length === 0) break;
  }

  const writtenTerms = new Set<string>();
  let termCount = 0;
  for (let page = 1; ; page += 1) {
    const response = await api.listTerms({ page });
    const file = termsFixturePath(page);
    writtenTerms.add(path.resolve(file));
    writeJsonIfChanged(file, response, false);
    termCount += response.data.length;
    log.info(`glossary, страница ${page}: ${response.data.length} терминов → ${relFromRoot(file)}`);
    if (!hasMorePages(response.meta) || response.data.length === 0) break;
  }

  const removed =
    prunePages(writtenEntries, /^entries\..+\.page-\d+\.json$/) +
    prunePages(writtenTerms, /^glossary\.page-\d+\.json$/);
  if (removed > 0) log.info(`Удалено устаревших страниц: ${removed}`);

  writeJsonIfChanged(path.join(PATHS.apiFixtures, "_meta.json"), {
    mode: api.mode,
    origin: api.mode === "http" ? api.origin : "local",
    fetchedAt: new Date().toISOString(),
    entries: entryCount,
    terms: termCount,
  });

  log.ok(`Готово: ${entryCount} сущностей, ${termCount} терминов`);
}

main().catch(fail);
