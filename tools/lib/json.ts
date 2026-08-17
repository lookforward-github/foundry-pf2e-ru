import fs from "node:fs";
import path from "node:path";
import { relFromRoot } from "./paths";

/**
 * Рекурсивно сортирует ключи объектов. Порядок ключей в JSON смысловой нагрузки
 * не несёт, но стабильная сортировка делает диффы переводов читаемыми.
 */
export function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeysDeep) as unknown as T;
  if (value === null || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort((a, b) => a.localeCompare(b, "en"))) {
    sorted[key] = sortKeysDeep(source[key]);
  }
  return sorted as unknown as T;
}

export function readJson<T = unknown>(file: string): T {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`Не удалось прочитать ${relFromRoot(file)}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Некорректный JSON в ${relFromRoot(file)}: ${reason}`);
  }
}

export function readJsonIfExists<T = unknown>(file: string): T | undefined {
  return fs.existsSync(file) ? readJson<T>(file) : undefined;
}

/**
 * Пишет файл только если содержимое изменилось — иначе `git status` шумит
 * после каждой сборки.
 *
 * @returns true, если файл действительно был записан
 */
export function writeJsonIfChanged(file: string, value: unknown, sort = true): boolean {
  const payload = `${JSON.stringify(sort ? sortKeysDeep(value) : value, null, 2)}\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === payload) return false;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, payload, "utf8");
  return true;
}

/** Все *.json в каталоге, отсортированные по имени. Отсутствующий каталог — пустой список. */
export function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}
