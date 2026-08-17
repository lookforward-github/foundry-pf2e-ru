import fs from "node:fs";
import { fromRoot } from "./paths";

let loaded = false;

/**
 * Минимальный загрузчик .env без зависимостей: значения из окружения имеют
 * приоритет над файлом, поэтому в CI достаточно обычных secrets.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const file = fromRoot(".env");
  if (!fs.existsSync(file)) return;

  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function optionalEnv(key: string): string | undefined {
  loadEnv();
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

export function requireEnv(key: string, hint?: string): string {
  const value = optionalEnv(key);
  if (!value) {
    throw new Error(
      `Не задана переменная окружения ${key}.` +
        ` Скопируйте .env.example в .env и заполните её.${hint ? ` ${hint}` : ""}`,
    );
  }
  return value;
}
