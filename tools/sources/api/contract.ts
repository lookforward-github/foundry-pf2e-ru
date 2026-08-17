import { z } from "zod";

/**
 * ЕДИНСТВЕННЫЙ источник правды о форме ответа API сайта переводов.
 *
 * Через эти схемы проходят и живой HTTP-ответ, и локальная выгрузка из
 * fixtures/api. Поэтому мок физически не может разойтись со контрактом: если
 * структуры разойдутся — упадёт валидация, а не сборка на полпути.
 *
 * Когда появится настоящее API и его форма окажется другой — правится только
 * этот файл (плюс, при необходимости, распаковка в http.ts).
 */

/** Переведённая сущность: заклинание, фит, предмет, действие и т. п. */
export const ApiEntry = z.object({
  id: z.string().min(1),
  /** Тип сущности: spell | feat | item | action | … Используется в плейсхолдерах. */
  type: z.string().min(1),
  /** Стабильный машинный идентификатор внутри типа. */
  slug: z.string().min(1),
  name: z.object({
    en: z.string(),
    ru: z.string(),
  }),
  /** Прочие переведённые поля: description, prerequisites, traits и т. д. */
  fields: z.record(z.string(), z.string()).default({}),
  updatedAt: z.string(),
});
export type ApiEntry = z.infer<typeof ApiEntry>;

/** Термин глоссария: принятый перевод игрового термина или трейта. */
export const ApiTerm = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  en: z.string(),
  ru: z.string(),
  updatedAt: z.string(),
});
export type ApiTerm = z.infer<typeof ApiTerm>;

export const ApiMeta = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export type ApiMeta = z.infer<typeof ApiMeta>;

export const ApiEntriesResponse = z.object({
  data: z.array(ApiEntry),
  meta: ApiMeta,
});
export type ApiEntriesResponse = z.infer<typeof ApiEntriesResponse>;

export const ApiTermsResponse = z.object({
  data: z.array(ApiTerm),
  meta: ApiMeta,
});
export type ApiTermsResponse = z.infer<typeof ApiTermsResponse>;

/** Есть ли ещё страницы после текущей. */
export function hasMorePages(meta: ApiMeta): boolean {
  return meta.page * meta.perPage < meta.total;
}

/** Разбор ответа с понятным сообщением о том, что именно не совпало. */
export function parseResponse<S extends z.ZodTypeAny>(
  schema: S,
  payload: unknown,
  source: string,
): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues
    .map((issue) => `  · ${issue.path.join(".") || "<корень>"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Ответ ${source} не соответствует контракту API:\n${issues}`);
}
