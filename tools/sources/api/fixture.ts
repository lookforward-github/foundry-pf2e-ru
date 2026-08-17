import fs from "node:fs";
import path from "node:path";
import { readJson } from "../../lib/json";
import { PATHS, relFromRoot } from "../../lib/paths";
import type { ApiEntriesResponse, ApiTermsResponse } from "./contract";
import { ApiEntriesResponse as EntriesSchema, ApiTermsResponse as TermsSchema } from "./contract";
import { parseResponse } from "./contract";
import type { ApiMode, TranslationApi } from "./provider";

/** Тип по умолчанию в именах файлов, когда выгрузка не разбита по типам. */
export const ALL_TYPES = "all";

export function entriesFixturePath(type: string | undefined, page: number): string {
  return path.join(PATHS.apiFixtures, `entries.${type ?? ALL_TYPES}.page-${page}.json`);
}

export function termsFixturePath(page: number): string {
  return path.join(PATHS.apiFixtures, `glossary.page-${page}.json`);
}

/**
 * Читает локальную выгрузку API. Файлы содержат ответы ровно в том виде, в
 * котором их отдаёт (будет отдавать) сервер, и проходят ту же схему, что и
 * живой HTTP-ответ.
 */
export class FixtureApi implements TranslationApi {
  readonly mode: ApiMode = "fixture";
  readonly origin = relFromRoot(PATHS.apiFixtures);

  async listEntries(query: { type?: string; page: number }): Promise<ApiEntriesResponse> {
    const file = entriesFixturePath(query.type, query.page);
    return parseResponse(EntriesSchema, this.read(file, query.page), relFromRoot(file));
  }

  async listTerms(query: { page: number }): Promise<ApiTermsResponse> {
    const file = termsFixturePath(query.page);
    return parseResponse(TermsSchema, this.read(file, query.page), relFromRoot(file));
  }

  private read(file: string, page: number): unknown {
    if (fs.existsSync(file)) return readJson(file);

    if (page > 1) {
      throw new Error(
        `Выгрузка обрывается: нет файла ${relFromRoot(file)}, хотя meta предыдущей` +
          " страницы обещает продолжение. Дополните выгрузку или поправьте meta.total.",
      );
    }
    throw new Error(
      `Нет файла выгрузки ${relFromRoot(file)}.` +
        " Положите туда ответ API (структура — см. tools/sources/api/contract.ts)" +
        " или запустите `npm run pull:api` с PF2E_RU_API_MODE=http.",
    );
  }
}
