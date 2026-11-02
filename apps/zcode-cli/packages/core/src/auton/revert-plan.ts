// ============================================================
// Auton revert — planificación pura
// ============================================================
// Decide qué archivos se revierten, en qué orden y con qué contenido previo.
// No toca el disco: recibe los registros y el estado actual y devuelve un plan.

import type { ChangeRecord } from "./journal.js";

export interface RevertSelection {
  agentId?: string;
  itemId?: string;
  paths?: string[];
  all?: boolean;
}

export interface RevertTarget {
  path: string;
  /** Contenido al que hay que volver; null significa borrar el archivo. */
  before: string | null;
  /** Contenido que el diario espera encontrar ahora. */
  expectedAfter: string | null;
  records: number;
}

export interface RevertPlan {
  targets: RevertTarget[];
  unknownPaths: string[];
  matchedRecords: number;
  ignoredRecords: number;
}

function matches(record: ChangeRecord, selection: RevertSelection): boolean {
  if (selection.all === true) return true;
  if (selection.agentId !== undefined && record.agentId !== selection.agentId) return false;
  if (selection.itemId !== undefined && record.itemId !== selection.itemId) return false;
  if (selection.paths !== undefined && selection.paths.length > 0) {
    if (!selection.paths.includes(record.path)) return false;
  }
  return true;
}

export function planRevert(
  records: readonly ChangeRecord[],
  selection: RevertSelection,
): RevertPlan {
  const matching = records.filter((record) => matches(record, selection));
  const byPath = new Map<string, ChangeRecord[]>();

  for (const record of matching) {
    const group = byPath.get(record.path);
    if (group) group.push(record);
    else byPath.set(record.path, [record]);
  }

  const targets: RevertTarget[] = [];
  for (const [path, group] of byPath) {
    const ordered = [...group].sort((left, right) => left.at.localeCompare(right.at));
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    targets.push({
      path,
      before: first.before,
      expectedAfter: last.after,
      records: ordered.length,
    });
  }

  // El último cambio manda: se revierte en orden inverso al que se aplicó.
  targets.sort((left, right) => {
    const leftAt = byPath.get(left.path)?.at(-1)?.at ?? "";
    const rightAt = byPath.get(right.path)?.at(-1)?.at ?? "";
    return rightAt.localeCompare(leftAt);
  });

  const requested = selection.paths ?? [];
  const known = new Set(targets.map((target) => target.path));
  const unknownPaths = requested.filter((path) => !known.has(path));

  return {
    targets,
    unknownPaths,
    matchedRecords: matching.length,
    ignoredRecords: records.length - matching.length,
  };
}
