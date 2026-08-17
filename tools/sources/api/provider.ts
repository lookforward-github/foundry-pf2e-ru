import { optionalEnv } from "../../lib/env";
import type { ApiEntriesResponse, ApiEntry, ApiTerm, ApiTermsResponse } from "./contract";
import { hasMorePages } from "./contract";
import { FixtureApi } from "./fixture";
import { HttpApi } from "./http";

export type ApiMode = "http" | "fixture";

export interface TranslationApi {
  readonly mode: ApiMode;
  /** Описание источника для логов: URL или путь к выгрузке. */
  readonly origin: string;
  listEntries(query: { type?: string; page: number }): Promise<ApiEntriesResponse>;
  listTerms(query: { page: number }): Promise<ApiTermsResponse>;
}

export function resolveMode(explicit?: string): ApiMode {
  const raw = explicit ?? optionalEnv("PF2E_RU_API_MODE") ?? "fixture";
  if (raw === "http" || raw === "fixture") return raw;
  throw new Error(`Неизвестный режим API «${raw}». Допустимо: http | fixture.`);
}

export function createApi(explicitMode?: string): TranslationApi {
  return resolveMode(explicitMode) === "http" ? new HttpApi() : new FixtureApi();
}

/** Постранично вычитывает всё, что отдаёт источник. */
export async function collectEntries(api: TranslationApi, type?: string): Promise<ApiEntry[]> {
  const collected: ApiEntry[] = [];
  for (let page = 1; ; page += 1) {
    const response = await api.listEntries({ type, page });
    collected.push(...response.data);
    if (!hasMorePages(response.meta) || response.data.length === 0) break;
  }
  return collected;
}

export async function collectTerms(api: TranslationApi): Promise<ApiTerm[]> {
  const collected: ApiTerm[] = [];
  for (let page = 1; ; page += 1) {
    const response = await api.listTerms({ page });
    collected.push(...response.data);
    if (!hasMorePages(response.meta) || response.data.length === 0) break;
  }
  return collected;
}
