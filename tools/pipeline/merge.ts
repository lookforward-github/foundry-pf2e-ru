import path from "node:path";
import { readJson, listJsonFiles } from "../lib/json";
import { log, logSample } from "../lib/log";
import { BABELE_TARGET_DIR, I18N_TARGET, relFromRoot } from "../lib/paths";
import type { Buckets } from "./types";
import { getOrCreateBucket, putValue } from "./types";

/**
 * Разворачивает вложенный i18n-объект в плоские ключи с точками.
 * Foundry понимает оба вида, но плоский лучше диффается и мержится.
 */
export function flattenI18n(
  source: unknown,
  file: string,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    log.warn(`${relFromRoot(file)}: ключ «${prefix}» пропущен — ожидался объект или строка`);
    return out;
  }

  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[fullKey] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[fullKey] = String(value);
    } else {
      flattenI18n(value, file, fullKey, out);
    }
  }
  return out;
}

/** data/lang/*.json → бакет lang/ru.json. Файлы сливаются в порядке имён. */
export function mergeI18nLayer(buckets: Buckets, dir: string): number {
  const files = listJsonFiles(dir);
  if (files.length === 0) return 0;

  const bucket = getOrCreateBucket(buckets, I18N_TARGET, "i18n");
  let added = 0;
  const conflicts: string[] = [];

  for (const file of files) {
    const flat = flattenI18n(readJson(file), file);
    for (const [key, value] of Object.entries(flat)) {
      const result = putValue(bucket, key, "value", value);
      if (result.overwritten) conflicts.push(`${key} (${relFromRoot(file)})`);
      added += 1;
    }
  }

  if (conflicts.length > 0) {
    log.warn(`${relFromRoot(dir)}: ${conflicts.length} ключ(ей) перебили значение из листов`);
    logSample(conflicts);
  }
  return added;
}

interface BabeleFile {
  label?: string;
  entries?: Record<string, Record<string, unknown>>;
}

/**
 * data/manual/*.json и data/overrides/*.json → бакеты translations/ru/<имя>.json.
 *
 * Ожидается формат Babele — { label, entries }. Файл без обёртки `entries`
 * тоже принимается: тогда весь объект считается entries.
 */
export function mergeBabeleLayer(buckets: Buckets, dir: string, layer: string): number {
  const files = listJsonFiles(dir);
  if (files.length === 0) return 0;

  let added = 0;

  for (const file of files) {
    const raw = readJson<BabeleFile>(file);
    const entries = raw.entries ?? (raw as unknown as Record<string, Record<string, unknown>>);
    const target = `${BABELE_TARGET_DIR}/${path.basename(file)}`;
    const bucket = getOrCreateBucket(buckets, target, "babele", raw.label);
    const conflicts: string[] = [];

    for (const [key, record] of Object.entries(entries)) {
      if (record === null || typeof record !== "object" || Array.isArray(record)) {
        log.warn(`${relFromRoot(file)}: запись «${key}» пропущена — ожидался объект полей`);
        continue;
      }
      for (const [field, value] of Object.entries(record)) {
        if (typeof value !== "string") {
          log.warn(`${relFromRoot(file)}: «${key}».${field} пропущено — ожидалась строка`);
          continue;
        }
        const result = putValue(bucket, key, field, value);
        if (result.overwritten) conflicts.push(`${key}.${field}`);
        added += 1;
      }
    }

    if (conflicts.length > 0) {
      log.info(`${layer}: ${relFromRoot(file)} перебил ${conflicts.length} значени(й) из листов`);
      logSample(conflicts, 5);
    }
  }

  return added;
}
