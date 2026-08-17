import type { SheetSnapshot } from "../config";

const API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

/** Сколько листов запрашиваем за один batchGet, чтобы не упереться в длину URL. */
const BATCH_SIZE = 20;

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (response.ok) return response.json();

  // Google возвращает вменяемое описание ошибки в теле — не выбрасываем его.
  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ? `: ${body.error.message}` : "";
  } catch {
    /* тело не JSON — обойдёмся статусом */
  }

  if (response.status === 403) {
    throw new Error(
      `Google Sheets вернул 403${detail}.` +
        " Проверьте, что в проекте включён Google Sheets API и ключ не ограничен другим API.",
    );
  }
  if (response.status === 404) {
    throw new Error(
      `Google Sheets вернул 404${detail}.` +
        " Проверьте spreadsheetId и то, что таблица расшарена «всем, у кого есть ссылка».",
    );
  }
  throw new Error(`Google Sheets вернул ${response.status} ${response.statusText}${detail}`);
}

/** Имена всех листов таблицы — нужны, чтобы дать понятную ошибку при опечатке в конфиге. */
export async function fetchSheetTitles(spreadsheetId: string, apiKey: string): Promise<string[]> {
  const url =
    `${API_BASE}/${encodeURIComponent(spreadsheetId)}` +
    `?key=${encodeURIComponent(apiKey)}&fields=sheets.properties.title`;

  const body = (await getJson(url)) as { sheets?: { properties?: { title?: string } }[] };
  return (body.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));
}

/**
 * Тянет значения листов и разворачивает их в снапшот.
 *
 * Google обрезает пустые ячейки в конце строки, поэтому строки добиваются до
 * длины заголовка — иначе последние колонки молча теряются.
 */
export async function fetchSheets(
  spreadsheetId: string,
  apiKey: string,
  titles: readonly string[],
): Promise<SheetSnapshot[]> {
  const snapshots: SheetSnapshot[] = [];

  for (let offset = 0; offset < titles.length; offset += BATCH_SIZE) {
    const batch = titles.slice(offset, offset + BATCH_SIZE);
    const ranges = batch
      .map((title) => `ranges=${encodeURIComponent(`'${title.replace(/'/g, "''")}'`)}`)
      .join("&");
    const url =
      `${API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchGet` +
      `?key=${encodeURIComponent(apiKey)}&majorDimension=ROWS&${ranges}`;

    const body = (await getJson(url)) as { valueRanges?: { values?: unknown[][] }[] };
    const valueRanges = body.valueRanges ?? [];

    batch.forEach((title, index) => {
      // Порядок ответов совпадает с порядком ranges в запросе.
      snapshots.push(toSnapshot(title, valueRanges[index]?.values ?? []));
    });
  }

  return snapshots;
}

function toSnapshot(sheet: string, values: readonly unknown[][]): SheetSnapshot {
  const [headerRow, ...dataRows] = values;
  if (!headerRow || headerRow.length === 0) {
    throw new Error(`Лист «${sheet}» пуст: в первой строке ожидаются заголовки колонок.`);
  }

  const header = headerRow.map((cell) => String(cell ?? "").trim());
  const blank = header.findIndex((title) => title === "");
  if (blank >= 0) {
    throw new Error(
      `Лист «${sheet}»: колонка №${blank + 1} без заголовка.` +
        " Заголовки обязательны для всех используемых колонок.",
    );
  }

  const duplicates = header.filter((title, index) => header.indexOf(title) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `Лист «${sheet}»: заголовки колонок повторяются: ${[...new Set(duplicates)].join(", ")}`,
    );
  }

  const rows = dataRows
    .map((row) => {
      const record: Record<string, string> = {};
      header.forEach((title, index) => {
        record[title] = String(row[index] ?? "");
      });
      return record;
    })
    // Полностью пустые строки — обычное дело в конце листа.
    .filter((record) => Object.values(record).some((value) => value.trim() !== ""));

  return { sheet, header, rows };
}
