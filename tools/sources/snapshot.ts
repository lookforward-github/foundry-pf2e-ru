import path from "node:path";
import type { SheetSnapshot } from "../config";
import { SheetSnapshot as SnapshotSchema } from "../config";
import { listJsonFiles, readJson, writeJsonIfChanged } from "../lib/json";
import { PATHS, relFromRoot } from "../lib/paths";

/** Служебный файл с метаданными выгрузки — не является листом. */
const META_FILE = "_meta.json";

export function snapshotPath(sheet: string): string {
  // Имена листов попадают в имена файлов, поэтому чистим запрещённые символы.
  const safe = sheet.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return path.join(PATHS.sheetsSnapshot, `${safe}.json`);
}

export function writeSnapshot(snapshot: SheetSnapshot): boolean {
  // sort=false: порядок { sheet, header, rows } осмысленный, ломать его не надо.
  return writeJsonIfChanged(snapshotPath(snapshot.sheet), snapshot, false);
}

export function writeSnapshotMeta(meta: Record<string, unknown>): void {
  writeJsonIfChanged(path.join(PATHS.sheetsSnapshot, META_FILE), meta, true);
}

/** Читает и валидирует все выгрузки листов. Ключ результата — имя листа. */
export function loadSnapshots(): Map<string, SheetSnapshot> {
  const result = new Map<string, SheetSnapshot>();

  for (const file of listJsonFiles(PATHS.sheetsSnapshot)) {
    if (path.basename(file) === META_FILE) continue;

    const parsed = SnapshotSchema.safeParse(readJson(file));
    if (!parsed.success) {
      throw new Error(
        `${relFromRoot(file)} не похож на выгрузку листа:` +
          ` ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
      );
    }
    result.set(parsed.data.sheet, parsed.data);
  }

  return result;
}
