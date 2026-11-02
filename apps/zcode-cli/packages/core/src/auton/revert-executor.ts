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

function applyTarget(workspaceRoot: string, target: RevertTarget): RevertFileResult {
  const absolute = insideWorkspace(workspaceRoot, target.path);
  if (!absolute) {
    return { path: target.path, outcome: "blocked", reason: "path outside the workspace" };
  }

  let current: string | null;
  try {
    current = readIfPresent(absolute);
  } catch (error) {
    return { path: target.path, outcome: "blocked", reason: (error as Error).message };
  }

  if (current === target.before) {
    return { path: target.path, outcome: "already", reason: "already at the pre-change content" };
  }

  if (current !== target.expectedAfter) {
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
  writeFileSync(absolute, target.before, "utf8");
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
  };
}

/** Lee el contenido actual de un path dentro del workspace, o null si no existe. */
export function readWorkspaceFile(workspaceRoot: string, relativePath: string): string | null {
  const absolute = insideWorkspace(workspaceRoot, relativePath);
  if (!absolute || !existsSync(absolute)) return null;
  return readIfPresent(absolute);
}

export { insideWorkspace as resolveWorkspacePath, join as joinWorkspacePath };
