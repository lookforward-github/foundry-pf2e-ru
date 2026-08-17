import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, sortKeysDeep, writeJsonIfChanged } from "../lib/json";
import { fromRoot } from "../lib/paths";
import type { Bucket, Buckets } from "./types";

export interface EmitResult {
  target: string;
  keys: number;
  changed: boolean;
}

/** «pf2e.spells-srd.json» → «Pf2e spells srd» — запасной вариант подписи пака. */
function labelFromFilename(target: string): string {
  const base = path.basename(target, ".json").replace(/^pf2e\./, "");
  const words = base.replace(/[-_.]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function buildI18nPayload(bucket: Bucket): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const [key, record] of bucket.entries) {
    const value = record.value;
    if (value !== undefined) payload[key] = value;
  }
  return payload;
}

function buildBabelePayload(bucket: Bucket, absolute: string): Record<string, unknown> {
  const existing = readJsonIfExists<{ label?: string }>(absolute);
  const label = bucket.packLabel ?? existing?.label ?? labelFromFilename(bucket.target);

  const entries: Record<string, Record<string, string>> = {};
  for (const [key, record] of bucket.entries) {
    if (Object.keys(record).length > 0) entries[key] = record;
  }

  return { label, entries: sortKeysDeep(entries) };
}

/**
 * Записывает бакеты в файлы модуля. Лишние файлы в translations/ru,
 * которых больше нет ни в одном источнике, удаляются — иначе перевод
 * удалённого пака остаётся жить в релизе.
 */
export function emit(buckets: Buckets, pruneDir?: string): EmitResult[] {
  const results: EmitResult[] = [];
  const written = new Set<string>();

  for (const bucket of [...buckets.values()].sort((a, b) => a.target.localeCompare(b.target))) {
    const absolute = fromRoot(bucket.target);
    const payload =
      bucket.type === "i18n" ? buildI18nPayload(bucket) : buildBabelePayload(bucket, absolute);

    // Ключи внутри уже отсортированы там, где это нужно; sort=false сохраняет
    // порядок { label, entries } в babele-файлах.
    const changed = writeJsonIfChanged(absolute, payload, bucket.type === "i18n");
    written.add(path.resolve(absolute));
    results.push({ target: bucket.target, keys: bucket.entries.size, changed });
  }

  if (pruneDir && fs.existsSync(pruneDir)) {
    for (const name of fs.readdirSync(pruneDir)) {
      if (!name.endsWith(".json")) continue;
      const absolute = path.resolve(pruneDir, name);
      if (written.has(absolute)) continue;
      fs.rmSync(absolute);
      results.push({ target: path.basename(absolute), keys: 0, changed: true });
    }
  }

  return results;
}
