import type { SheetMapping, SheetsConfig, SheetSnapshot } from "../config";
import { log, logSample } from "../lib/log";
import type { Buckets } from "./types";
import { getOrCreateBucket, putValue } from "./types";

export interface SheetStats {
  sheet: string;
  target: string;
  rows: number;
  taken: number;
  skippedNoKey: number;
  skippedByRule: number;
  skippedEmpty: number;
}

function requireColumns(mapping: SheetMapping, snapshot: SheetSnapshot): void {
  const needed = [mapping.keyColumn, ...Object.values(mapping.columns)];
  if (mapping.skipWhen) needed.push(...Object.keys(mapping.skipWhen));

  const missing = [...new Set(needed)].filter((column) => !snapshot.header.includes(column));
  if (missing.length > 0) {
    throw new Error(
      `Лист «${mapping.sheet}»: в таблице нет колонок ${missing.map((c) => `«${c}»`).join(", ")}.` +
        ` Доступные: ${snapshot.header.map((c) => `«${c}»`).join(", ")}`,
    );
  }
}

function skippedByRule(mapping: SheetMapping, row: Record<string, string>): boolean {
  if (!mapping.skipWhen) return false;
  return Object.entries(mapping.skipWhen).some(([column, values]) =>
    values.includes((row[column] ?? "").trim()),
  );
}

/** Раскладывает выгрузки листов по бакетам согласно конфигу. */
export function normalizeSheets(
  config: SheetsConfig,
  snapshots: Map<string, SheetSnapshot>,
): { buckets: Buckets; stats: SheetStats[] } {
  const buckets: Buckets = new Map();
  const stats: SheetStats[] = [];

  for (const mapping of config.sheets) {
    const snapshot = snapshots.get(mapping.sheet);
    if (!snapshot) {
      throw new Error(
        `Нет выгрузки листа «${mapping.sheet}» в sheets/snapshot/.` +
          " Запустите `npm run pull:sheets`.",
      );
    }
    requireColumns(mapping, snapshot);

    const bucket = getOrCreateBucket(buckets, mapping.target, mapping.type, mapping.packLabel);
    const stat: SheetStats = {
      sheet: mapping.sheet,
      target: mapping.target,
      rows: snapshot.rows.length,
      taken: 0,
      skippedNoKey: 0,
      skippedByRule: 0,
      skippedEmpty: 0,
    };
    const duplicates: string[] = [];
    const seen = new Set<string>();

    for (const row of snapshot.rows) {
      if (skippedByRule(mapping, row)) {
        stat.skippedByRule += 1;
        continue;
      }

      const key = (row[mapping.keyColumn] ?? "").trim();
      if (!key) {
        stat.skippedNoKey += 1;
        continue;
      }

      const values = Object.entries(mapping.columns)
        .map(([field, column]) => [field, (row[column] ?? "").trim()] as const)
        .filter(([, value]) => value !== "");

      if (values.length === 0) {
        stat.skippedEmpty += 1;
        continue;
      }

      if (seen.has(key)) duplicates.push(key);
      seen.add(key);

      for (const [field, value] of values) putValue(bucket, key, field, value);
      stat.taken += 1;
    }

    stats.push(stat);

    if (duplicates.length > 0) {
      log.warn(
        `Лист «${mapping.sheet}»: ключ повторяется ${duplicates.length} раз(а),` +
          " побеждает последняя строка",
      );
      logSample([...new Set(duplicates)]);
    }
    if (mapping.warnOnEmpty && stat.skippedEmpty > 0) {
      log.warn(`Лист «${mapping.sheet}»: ${stat.skippedEmpty} строк без перевода`);
    }
  }

  return { buckets, stats };
}
