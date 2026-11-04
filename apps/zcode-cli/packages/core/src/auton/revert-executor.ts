// ============================================================
// Auton revert — ejecución
// ============================================================
// Aplica el plan escribiendo el contenido anterior byte a byte. Nunca usa git
// de forma destructiva: toca solo los paths seleccionados y deja intacto
// cualquier cambio ajeno. Si el archivo ya no está como lo dejó el programador,
// no lo pisa: lo reporta como conflicto.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { appendRevertAudit, type RevertAuditEntry } from "./journal.js";
import type { RevertPlan, RevertSelection, RevertTarget } from "./revert-plan.js";

export type RevertOutcome = "reverted" | "already" | "conflict" | "blocked";

export interface RevertFileResult {
  path: string;
  outcome: RevertOutcome;
  reason?: string;
}

export interface RevertExecution {
  results: RevertFileResult[];
  reverted: number;
  already: number;
  conflicts: number;
  blocked: number;
  auditPath: string;
  /** Entrada exacta que quedó en reverts.jsonl; el hook durable la refleja. */
  audit: RevertAuditEntry;
}

function insideWorkspace(workspaceRoot: string, relativePath: string): string | null {
  const root = resolve(workspaceRoot);
  const absolute = resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) return null;
  return absolute;
}

function readIfPresent(absolutePath: string): string | null {
  try {
    return readFileSync(absolutePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function toLf(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function applyLineEndings(value: string, lineEndings: "LF" | "CRLF" | undefined): string {
  return lineEndings === "CRLF" ? value.replace(/\r?\n/g, "\r\n") : value;
}

function readBytes(absolutePath: string): Buffer | null {
  try {
    return readFileSync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function bytesFromBase64(value: string | null | undefined): Buffer | null {
  if (value === null || value === undefined) return null;
  return Buffer.from(value, "base64");
}

/** Restaura y compara por bytes crudos: exacto con CRLF, mixtos y no-UTF-8. */
function applyTargetBytes(
  absolute: string,
  target: RevertTarget & { beforeBase64: string | null; afterBase64: string | null },
): RevertFileResult {
  const current = readBytes(absolute);
  const before = bytesFromBase64(target.beforeBase64);
  const expectedAfter = bytesFromBase64(target.afterBase64);

  if (current === null ? before === null : before !== null && current.equals(before)) {
    return { path: target.path, outcome: "already", reason: "already at the pre-change content" };
  }

  const matchesExpected =
    current === null ? expectedAfter === null : expectedAfter !== null && current.equals(expectedAfter);

  if (!matchesExpected) {
    return {
      path: target.path,
      outcome: "conflict",
      reason: "the file changed after the recorded change; not overwritten",
    };
  }

  if (before === null) {
    rmSync(absolute, { force: true });
    return { path: target.path, outcome: "reverted", reason: "deleted (did not exist before)" };
  }

  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, before);
  return { path: target.path, outcome: "reverted" };
}

function applyTarget(workspaceRoot: string, target: RevertTarget): RevertFileResult {
  const absolute = insideWorkspace(workspaceRoot, target.path);
  if (!absolute) {
    return { path: target.path, outcome: "blocked", reason: "path outside the workspace" };
  }

  if ("beforeBase64" in target && "afterBase64" in target) {
    return applyTargetBytes(absolute, target as RevertTarget & {
      beforeBase64: string | null;
      afterBase64: string | null;
    });
  }

  let raw: string | null;
  try {
    raw = readIfPresent(absolute);
  } catch (error) {
    return { path: target.path, outcome: "blocked", reason: (error as Error).message };
  }

  // El diario guarda texto con saltos LF; el archivo puede estar en CRLF.
  const current = raw === null ? null : toLf(raw);

  if (current === target.before) {
    return { path: target.path, outcome: "already", reason: "already at the pre-change content" };
  }

  if (current !== toLf(target.expectedAfter ?? "")) {
    return {
      path: target.path,
      outcome: "conflict",
      reason: "the file changed after the recorded change; not overwritten",
    };
  }

  if (target.before === null) {
    rmSync(absolute, { force: true });
    return { path: target.path, outcome: "reverted", reason: "deleted (did not exist before)" };
  }

  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, applyLineEndings(target.before, target.lineEndings), "utf8");
  return { path: target.path, outcome: "reverted" };
}

export function executeRevert(input: {
  workspaceRoot: string;
  plan: RevertPlan;
  selection: RevertSelection;
  now?: Date;
}): RevertExecution {
  const results = input.plan.targets.map((target) => applyTarget(input.workspaceRoot, target));

  for (const missing of input.plan.unknownPaths) {
    results.push({
      path: missing,
      outcome: "blocked",
      reason: "no recorded change for this path",
    });
  }

  const count = (outcome: RevertOutcome) => results.filter((item) => item.outcome === outcome).length;
  const entry: RevertAuditEntry = {
    at: (input.now ?? new Date()).toISOString(),
    selection: input.selection,
    files: results.map((item) =>
      item.reason === undefined
        ? { path: item.path, outcome: item.outcome }
        : { path: item.path, outcome: item.outcome, reason: item.reason },
    ),
  };
  const auditPath = appendRevertAudit(input.workspaceRoot, entry);

  return {
    results,
    reverted: count("reverted"),
    already: count("already"),
    conflicts: count("conflict"),
    blocked: count("blocked"),
    auditPath,
    audit: entry,
  };
}

/** Lee el contenido actual de un path dentro del workspace, o null si no existe. */
export function readWorkspaceFile(workspaceRoot: string, relativePath: string): string | null {
  const absolute = insideWorkspace(workspaceRoot, relativePath);
  if (!absolute || !existsSync(absolute)) return null;
  return readIfPresent(absolute);
}

export { insideWorkspace as resolveWorkspacePath, join as joinWorkspacePath };
