const started = Date.now();

function stamp(): string {
  return `${String(Date.now() - started).padStart(6)}ms`;
}

let problems = 0;

export const log = {
  step(message: string): void {
    console.log(`\n▶ ${message}`);
  },
  info(message: string): void {
    console.log(`  ${stamp()}  ${message}`);
  },
  ok(message: string): void {
    console.log(`  ${stamp()}  ✓ ${message}`);
  },
  warn(message: string): void {
    problems += 1;
    console.warn(`  ${stamp()}  ! ${message}`);
  },
  error(message: string): void {
    problems += 1;
    console.error(`  ${stamp()}  ✗ ${message}`);
  },
  /** Сколько раз за прогон вызывались warn/error. */
  problemCount(): number {
    return problems;
  },
};

/** Аккуратно печатает длинный список, не заливая терминал. */
export function logSample(items: readonly string[], limit = 15, indent = "      "): void {
  for (const item of items.slice(0, limit)) console.log(`${indent}· ${item}`);
  if (items.length > limit) console.log(`${indent}… и ещё ${items.length - limit}`);
}

/** Единая точка выхода: печатает причину без стектрейса зависимостей. */
export function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✗ ${message}`);
  if (process.env.PF2E_RU_DEBUG && error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
