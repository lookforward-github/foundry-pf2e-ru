/**
 * Фаза pull: Google Sheets → sheets/snapshot/*.json.
 *
 * Выгрузка коммитится в репозиторий. Благодаря этому `npm run build`
 * работает офлайн, детерминированно и без ключей, а дифф снапшота показывает,
 * что именно поменяли переводчики в таблице.
 */
import fs from "node:fs";
import { loadSheetsConfig } from "./config";
import { requireEnv } from "./lib/env";
import { fail, log, logSample } from "./lib/log";
import { PATHS, relFromRoot } from "./lib/paths";
import { fetchSheets, fetchSheetTitles } from "./sources/sheets";
import { writeSnapshot, writeSnapshotMeta } from "./sources/snapshot";

async function main(): Promise<void> {
  const config = loadSheetsConfig();
  const apiKey = requireEnv("GOOGLE_SHEETS_API_KEY");

  log.step(`Выгрузка Google Sheets (${config.sheets.length} лист(ов))`);
  fs.mkdirSync(PATHS.sheetsSnapshot, { recursive: true });

  const available = await fetchSheetTitles(config.spreadsheetId, apiKey);
  log.info(`В таблице ${available.length} лист(ов)`);

  const wanted = [...new Set(config.sheets.map((mapping) => mapping.sheet))];
  const missing = wanted.filter((sheet) => !available.includes(sheet));
  if (missing.length > 0) {
    throw new Error(
      `В таблице нет листов ${missing.map((s) => `«${s}»`).join(", ")}.` +
        ` Доступные: ${available.map((s) => `«${s}»`).join(", ")}`,
    );
  }

  const snapshots = await fetchSheets(config.spreadsheetId, apiKey, wanted);

  const changed: string[] = [];
  for (const snapshot of snapshots) {
    const didChange = writeSnapshot(snapshot);
    if (didChange) changed.push(`${snapshot.sheet} (${snapshot.rows.length} строк)`);
    log.info(`${snapshot.sheet}: ${snapshot.rows.length} строк${didChange ? " — обновлено" : ""}`);
  }

  writeSnapshotMeta({
    spreadsheetId: config.spreadsheetId,
    fetchedAt: new Date().toISOString(),
    sheets: Object.fromEntries(snapshots.map((s) => [s.sheet, s.rows.length])),
  });

  if (changed.length === 0) {
    log.ok("Выгрузка совпадает с текущей — файлы не тронуты");
  } else {
    log.ok(`Обновлено листов: ${changed.length}`);
    logSample(changed);
    log.info(`Дальше: npm run build (проверьте дифф в ${relFromRoot(PATHS.sheetsSnapshot)})`);
  }
}

main().catch(fail);
