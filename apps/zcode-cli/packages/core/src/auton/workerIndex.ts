// ============================================================
// Índice durable de sesiones de workers
// ============================================================
// Un solo archivo por proyecto, ordenado por inicio, con el motor y el id de
// sesión de cada motor. No copia las sesiones: indexa sus metadatos.
//   <workspace>/.auton/workers/index.json

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type WorkerSessionStatus =
  | "running"
  | "completed"
  | "failed"
  | "stopped"
  | "waiting";

export interface WorkerSessionIndexEntry {
  /** Id del worker en Auton (agentId). */
  workerId: string;
  taskId: string;
  engine: string;
  /** Id de la sesión dentro del motor (ZCode child session o Muse session). */
  engineSessionId?: string;
  workspace: string;
  status: WorkerSessionStatus;
  startedAt: string;
  endedAt?: string;
  outputFile?: string;
  transcriptFile?: string;
  description: string;
  mode?: string;
  effort?: string;
}

const WRITE_CHAINS = new Map<string, Promise<void>>();

export function workerIndexPath(workspaceRoot: string): string {
  return join(workspaceRoot, ".auton", "workers", "index.json");
}

export async function readWorkerIndex(
  workspaceRoot: string,
): Promise<WorkerSessionIndexEntry[]> {
  try {
    const raw = await readFile(workerIndexPath(workspaceRoot), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

/** Lista ordenada por inicio; opcionalmente filtrada por motor. */
export async function listWorkerSessions(
  workspaceRoot: string,
  filter: { engine?: string } = {},
): Promise<WorkerSessionIndexEntry[]> {
  const entries = await readWorkerIndex(workspaceRoot);
  const filtered = filter.engine
    ? entries.filter((entry) => entry.engine === filter.engine)
    : entries;
  return filtered.sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
  );
}

/** Inserta o actualiza por workerId. La escritura es atómica y serializada. */
export async function upsertWorkerSession(
  workspaceRoot: string,
  entry: WorkerSessionIndexEntry,
): Promise<void> {
  const path = workerIndexPath(workspaceRoot);
  const previous = WRITE_CHAINS.get(path) ?? Promise.resolve();
  const next = previous.then(async () => {
    const entries = await readWorkerIndex(workspaceRoot);
    const index = entries.findIndex((candidate) => candidate.workerId === entry.workerId);
    if (index >= 0) entries[index] = { ...entries[index], ...entry };
    else entries.push(entry);
    entries.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
    await rename(temp, path);
  });
  WRITE_CHAINS.set(path, next.catch(() => undefined));
  await next;
}

function isEntry(value: unknown): value is WorkerSessionIndexEntry {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.workerId === "string" &&
    typeof record.taskId === "string" &&
    typeof record.engine === "string" &&
    typeof record.workspace === "string" &&
    typeof record.status === "string" &&
    typeof record.startedAt === "string" &&
    typeof record.description === "string"
  );
}
