import type { ApiEntry, ApiTerm } from "../sources/api/contract";
import type { Buckets } from "./types";

/**
 * Синтаксис плейсхолдеров:
 *
 *   {{term:flat-footed}}                    → принятый перевод термина
 *   {{entry:spell:magic-missile}}           → русское название сущности
 *   {{entry:spell:magic-missile.description}} → произвольное поле из fields
 *
 * Если в таблицах уже используется другой синтаксис — меняется только эта
 * пара константа/парсер, остальной конвейер не зависит от формы записи.
 */
export const PLACEHOLDER_RE = /\{\{\s*(entry|term)\s*:\s*([^{}]+?)\s*\}\}/g;

const ENTRY_SPEC_RE = /^([A-Za-z0-9_-]+)\s*:\s*([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9_-]+))?$/;

export interface Lookup {
  /** Ключ — `${type}:${slug}`. */
  entries: Map<string, ApiEntry>;
  /** Ключ — slug термина. */
  terms: Map<string, ApiTerm>;
  /** Локальный глоссарий: используется, только если в API термина нет. */
  localTerms: Map<string, string>;
}

export function buildLookup(
  entries: readonly ApiEntry[],
  terms: readonly ApiTerm[],
  localTerms: Record<string, string> = {},
): Lookup {
  return {
    entries: new Map(entries.map((entry) => [`${entry.type}:${entry.slug}`, entry])),
    terms: new Map(terms.map((term) => [term.slug, term])),
    localTerms: new Map(Object.entries(localTerms)),
  };
}

export interface ResolveStats {
  replaced: number;
  /** Плейсхолдеры, для которых не нашлось данных: описание → где встретилось. */
  unresolved: Map<string, string[]>;
  /** Термины, взятые из локального глоссария вместо API. */
  fromLocalGlossary: Set<string>;
}

export function emptyStats(): ResolveStats {
  return { replaced: 0, unresolved: new Map(), fromLocalGlossary: new Set() };
}

function note(stats: ResolveStats, placeholder: string, where: string): void {
  const places = stats.unresolved.get(placeholder) ?? [];
  places.push(where);
  stats.unresolved.set(placeholder, places);
}

/** Подставляет данные API в одну строку. Нераспознанное остаётся как есть. */
export function resolveText(
  text: string,
  lookup: Lookup,
  where: string,
  stats: ResolveStats,
): string {
  if (!text.includes("{{")) return text;

  return text.replace(PLACEHOLDER_RE, (match, kind: string, spec: string) => {
    if (kind === "term") {
      const slug = spec.trim();
      const term = lookup.terms.get(slug);
      if (term?.ru) {
        stats.replaced += 1;
        return term.ru;
      }
      const local = lookup.localTerms.get(slug);
      if (local) {
        stats.replaced += 1;
        stats.fromLocalGlossary.add(slug);
        return local;
      }
      note(stats, match, where);
      return match;
    }

    const parsed = ENTRY_SPEC_RE.exec(spec.trim());
    if (!parsed) {
      note(stats, match, where);
      return match;
    }

    const [, type, slug, field] = parsed;
    if (!type || !slug) {
      note(stats, match, where);
      return match;
    }

    const entry = lookup.entries.get(`${type}:${slug}`);
    if (!entry) {
      note(stats, match, where);
      return match;
    }

    const value = field ? entry.fields[field] : entry.name.ru;
    if (!value) {
      note(stats, match, where);
      return match;
    }

    stats.replaced += 1;
    return value;
  });
}

/** Проходит по всем значениям всех бакетов и подставляет данные API на месте. */
export function resolveBuckets(buckets: Buckets, lookup: Lookup): ResolveStats {
  const stats = emptyStats();

  for (const bucket of buckets.values()) {
    for (const [key, record] of bucket.entries) {
      for (const [field, value] of Object.entries(record)) {
        record[field] = resolveText(value, lookup, `${bucket.target} → ${key}.${field}`, stats);
      }
    }
  }

  return stats;
}

/** Ищет уцелевшие плейсхолдеры в готовом тексте — используется в validate. */
export function findPlaceholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((match) => match[0]);
}
