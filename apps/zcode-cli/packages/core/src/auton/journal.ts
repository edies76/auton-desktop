// ============================================================
// Auton revert — diario de cambios por programador
// ============================================================
// Cada cambio que un programador hace en el workspace queda registrado con su
// contenido anterior y posterior. La reversión se apoya en ese diario: es la
// única fuente que permite dejar el archivo byte a byte como estaba.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const AUTON_DIR_NAME = ".auton";
export const CHANGES_FILE_NAME = "changes.jsonl";
export const REVERTS_FILE_NAME = "reverts.jsonl";
export const MAX_JOURNALED_BYTES = 512 * 1024;

export interface ChangeRecord {
  at: string;
  agentId: string;
  sessionId: string;
  itemId?: string;
  path: string;
  /** Contenido antes del cambio; null cuando el archivo no existía. */
  before: string | null;
  /** Contenido después del cambio; null cuando el archivo se borró. */
  after: string | null;
}

export interface RevertAuditEntry {
  at: string;
  selection: {
    agentId?: string;
    itemId?: string;
    paths?: string[];
    all?: boolean;
  };
  files: Array<{ path: string; outcome: string; reason?: string }>;
}

export function autonDir(workspaceRoot: string): string {
  return join(workspaceRoot, AUTON_DIR_NAME);
}

export function changesPath(workspaceRoot: string): string {
  return join(autonDir(workspaceRoot), CHANGES_FILE_NAME);
}

export function revertsPath(workspaceRoot: string): string {
  return join(autonDir(workspaceRoot), REVERTS_FILE_NAME);
}

export function appendChange(workspaceRoot: string, record: ChangeRecord): void {
  const file = changesPath(workspaceRoot);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
}

export function readChanges(workspaceRoot: string): ChangeRecord[] {
  const file = changesPath(workspaceRoot);
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const records: ChangeRecord[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<ChangeRecord>;
      if (typeof parsed.path !== "string" || typeof parsed.agentId !== "string") continue;
      if (typeof parsed.sessionId !== "string" || typeof parsed.at !== "string") continue;
      const before = parsed.before ?? null;
      const after = parsed.after ?? null;
      if (before !== null && typeof before !== "string") continue;
      if (after !== null && typeof after !== "string") continue;
      records.push({
        at: parsed.at,
        agentId: parsed.agentId,
        sessionId: parsed.sessionId,
        ...(typeof parsed.itemId === "string" ? { itemId: parsed.itemId } : {}),
        path: parsed.path,
        before,
        after,
      });
    } catch {
      // Una linea corrupta no invalida el resto del diario.
    }
  }
  return records;
}

export function appendRevertAudit(workspaceRoot: string, entry: RevertAuditEntry): string {
  const file = revertsPath(workspaceRoot);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  return file;
}

export function readRevertAudit(workspaceRoot: string): RevertAuditEntry[] {
  const file = revertsPath(workspaceRoot);
  if (!existsSync(file)) return [];
  const entries: RevertAuditEntry[] = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      entries.push(JSON.parse(trimmed) as RevertAuditEntry);
    } catch {
      // Ignorar lineas corruptas.
    }
  }
  return entries;
}

/**
 * Registra un cambio real de archivo para un programador. Se llama desde las
 * tools de escritura cuando la sesión pertenece a un worker de Auton.
 */
export function recordFileChange(input: {
  workspaceRoot: string;
  sessionId: string;
  path: string;
  before: string | null;
  after: string | null;
  itemId?: string;
  now?: Date;
}): void {
  const relative = toWorkspaceRelative(input.workspaceRoot, input.path);
  const agentId = agentIdFromSessionId(input.sessionId);
  const itemId = input.itemId ?? findAgentItem(input.workspaceRoot, agentId);
  appendChange(input.workspaceRoot, {
    at: (input.now ?? new Date()).toISOString(),
    agentId,
    sessionId: input.sessionId,
    ...(itemId ? { itemId } : {}),
    path: relative,
    before: input.before,
    after: input.after,
  });
}

export function agentIdFromSessionId(sessionId: string): string {
  const trimmed = sessionId.trim().replace(/^sess_/, "");
  if (trimmed.startsWith("auton_")) return trimmed.slice("auton_".length);
  return trimmed;
}

/**
 * Las sesiones hijas de un worker se crean con createChildSessionId, que pasa por
 * createSessionId y añade el prefijo "sess_": el id real es `sess_auton_<agentId>`.
 * También se acepta la forma sin prefijo por compatibilidad con datos antiguos.
 */
export function isAutonWorkerSession(sessionId: string | undefined): boolean {
  if (typeof sessionId !== "string") return false;
  return /^(sess_)?auton_/.test(sessionId.trim());
}

/** Mapa agente → item del plan, escrito al despachar y leído al registrar cambios. */
export const AGENT_ITEMS_FILE_NAME = "agent-items.json";

function agentItemsPath(workspaceRoot: string): string {
  return join(autonDir(workspaceRoot), AGENT_ITEMS_FILE_NAME);
}

export function rememberAgentItem(
  workspaceRoot: string,
  agentId: string,
  itemId: string,
): void {
  const file = agentItemsPath(workspaceRoot);
  let map: Record<string, string> = {};
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        map = parsed as Record<string, string>;
      }
    }
  } catch {
    map = {};
  }
  map[agentId] = itemId;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

export function findAgentItem(workspaceRoot: string, agentId: string): string | undefined {
  try {
    const file = agentItemsPath(workspaceRoot);
    if (!existsSync(file)) return undefined;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const value = (parsed as Record<string, unknown>)[agentId];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function toWorkspaceRelative(workspaceRoot: string, absolutePath: string): string {
  const normalizedRoot = workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedPath = absolutePath.replace(/\\/g, "/");
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }
  return normalizedPath;
}
