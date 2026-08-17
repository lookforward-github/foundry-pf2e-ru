import type { TargetKind } from "../config";

/**
 * Промежуточное представление, к которому сводятся все источники.
 *
 * `entries`: ключ → (поле перевода → значение).
 *   · для i18n  ключ = ключ локализации, поле всегда "value";
 *   · для babele ключ = оригинальное английское название сущности,
 *     поля — те, что описаны в MAPPING (scripts/babele/converters.js).
 */
export interface Bucket {
  /** Путь от корня репозитория, он же идентификатор бакета. */
  target: string;
  type: TargetKind;
  packLabel?: string;
  entries: Map<string, Record<string, string>>;
}

export type Buckets = Map<string, Bucket>;

export function getOrCreateBucket(
  buckets: Buckets,
  target: string,
  type: TargetKind,
  packLabel?: string,
): Bucket {
  const existing = buckets.get(target);
  if (existing) {
    if (existing.type !== type) {
      throw new Error(`Конфликт типов для ${target}: уже "${existing.type}", запрошен "${type}".`);
    }
    if (packLabel && !existing.packLabel) existing.packLabel = packLabel;
    return existing;
  }

  const created: Bucket = { target, type, entries: new Map() };
  if (packLabel) created.packLabel = packLabel;
  buckets.set(target, created);
  return created;
}

/**
 * Кладёт значение в бакет. Пустые строки игнорируются — иначе пустая ячейка
 * в таблице затирала бы перевод, пришедший из нижнего слоя.
 *
 * @returns ключ поля, если предыдущее значение было перезаписано другим
 */
export function putValue(
  bucket: Bucket,
  key: string,
  field: string,
  value: string,
): { overwritten: boolean; previous?: string } {
  if (value === "") return { overwritten: false };

  const record = bucket.entries.get(key) ?? {};
  const previous = record[field];
  record[field] = value;
  bucket.entries.set(key, record);

  if (previous !== undefined && previous !== value) return { overwritten: true, previous };
  return { overwritten: false };
}

export function countValues(bucket: Bucket): number {
  let total = 0;
  for (const record of bucket.entries.values()) total += Object.keys(record).length;
  return total;
}
