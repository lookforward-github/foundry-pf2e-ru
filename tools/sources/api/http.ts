import { optionalEnv, requireEnv } from "../../lib/env";
import type { ApiEntriesResponse, ApiTermsResponse } from "./contract";
import { ApiEntriesResponse as EntriesSchema, ApiTermsResponse as TermsSchema } from "./contract";
import { parseResponse } from "./contract";
import type { ApiMode, TranslationApi } from "./provider";

/**
 * Пути эндпоинтов. Когда API появится — правятся здесь и, если форма ответа
 * отличается, в contract.ts. Остальной конвейер об этом не знает.
 */
const ENDPOINTS = {
  entries: "/entries",
  glossary: "/glossary",
} as const;

const PER_PAGE = 200;
const RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpApi implements TranslationApi {
  readonly mode: ApiMode = "http";
  readonly origin: string;

  private readonly baseUrl: string;
  private readonly token: string | undefined;

  constructor() {
    this.baseUrl = requireEnv("PF2E_RU_API_BASE_URL").replace(/\/+$/, "");
    this.token = optionalEnv("PF2E_RU_API_TOKEN");
    this.origin = this.baseUrl;
  }

  async listEntries(query: { type?: string; page: number }): Promise<ApiEntriesResponse> {
    const params = new URLSearchParams({
      page: String(query.page),
      perPage: String(PER_PAGE),
    });
    if (query.type) params.set("type", query.type);

    const url = `${this.baseUrl}${ENDPOINTS.entries}?${params}`;
    return parseResponse(EntriesSchema, await this.get(url), url);
  }

  async listTerms(query: { page: number }): Promise<ApiTermsResponse> {
    const params = new URLSearchParams({
      page: String(query.page),
      perPage: String(PER_PAGE),
    });

    const url = `${this.baseUrl}${ENDPOINTS.glossary}?${params}`;
    return parseResponse(TermsSchema, await this.get(url), url);
  }

  private async get(url: string): Promise<unknown> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
      try {
        const response = await fetch(url, { headers });

        if (response.ok) return await response.json();

        // 4xx повторять бессмысленно — это ошибка запроса, а не сети.
        if (response.status < 500) {
          throw new Error(`${url} → ${response.status} ${response.statusText}`);
        }
        lastError = new Error(`${url} → ${response.status} ${response.statusText}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes("→ 4")) throw error;
        lastError = error;
      }

      if (attempt < RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }

    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Не удалось получить ${url} за ${RETRIES} попытки: ${reason}`);
  }
}
