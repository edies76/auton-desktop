// ============================================================
// Auton registry — hooks de plan y reversión (Nivel 1C)
// ============================================================
// Dos hooks mínimos escriben eventos en el registro durable:
// - al escribir el plan, solo lo que cambió (goal, items, límites, reportes);
// - al ejecutar una reversión, el resultado que ya quedó en reverts.jsonl.
//
// Los ids son deterministas (SHA-256 corto del contenido canónico) y cada
// evento lleva un `dedupeKey`: repetir el mismo cambio no duplica la línea.
// Nunca se guarda `before`/`after` ni el contenido de un archivo.

import { createHash } from "node:crypto";
import {
  type AutonLimitChange,
  type AutonLimitReport,
  type AutonPlan,
  type AutonPlanItem,
  type AutonRegistryAppendResult,
} from "@zcode/contracts";
import type { RevertExecution } from "./revert-executor.js";
import type { RevertSelection } from "./revert-plan.js";
import { appendRegistryRecord } from "./registry-store.js";

export type AutonRevertResult = "reverted" | "partial" | "already" | "blocked";

/** JSON canónico: claves ordenadas, `undefined` fuera, arrays en su orden. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const parts = Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${parts.join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  return encoded === undefined ? "null" : encoded;
}

function hash8(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex").slice(0, 8);
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function itemComparable(item: AutonPlanItem): unknown {
  return {
    id: item.id,
    title: item.title,
    detail: item.detail,
    status: item.status,
    effort: item.effort,
    mode: item.mode,
    engine: item.engine,
    owner: item.owner,
    strength: item.strength,
    files: item.files,
    evidence: item.evidence,
    questions: item.questions,
    attempts: item.attempts,
    needsApproval: item.needsApproval,
  };
}

function sameValue(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function goalSummary(plan: AutonPlan): string {
  const goal = plan.goal;
  if (!goal) return "";
  const statement = goal.statement?.trim();
  if (statement) return oneLine(statement);
  const details = [...(goal.constraints ?? []), ...(goal.done ?? [])];
  return oneLine(details.length > 0 ? details.join(" · ") : goal.title);
}

function itemSummary(item: AutonPlanItem): string {
  return oneLine(
    `${item.status} · owner ${item.owner ?? "sin asignar"} · attempts ${item.attempts}`,
  );
}

function limitSummary(change: AutonLimitChange): string {
  return oneLine(
    `${change.field}: ${change.from ?? "—"} → ${change.to ?? "—"} · ${change.reason} (${change.approvedBy})`,
  );
}

function reportSummary(report: AutonLimitReport): string {
  return oneLine(
    `${report.observed}${report.expected ? `; esperaba ${report.expected}` : ""} · ${report.by}`,
  );
}

/**
 * Anexa al registro durable lo que cambió al escribir el plan. Compara contra
 * el plan anterior y no escribe nada si no hubo cambios de contenido (el
 * `updatedAt` no cuenta).
 */
export function recordPlanWrite(input: {
  workspaceRoot: string;
  previous: AutonPlan;
  plan: AutonPlan;
  now?: Date;
}): AutonRegistryAppendResult[] {
  const { workspaceRoot, previous, plan, now } = input;
  const results: AutonRegistryAppendResult[] = [];
  const append = (event: Parameters<typeof appendRegistryRecord>[1]) => {
    results.push(appendRegistryRecord(workspaceRoot, event, { now }));
  };

  if (plan.goal && !sameValue(plan.goal, previous.goal)) {
    append({
      kind: "goal",
      id: `goal:${hash8(plan.goal)}`,
      dedupeKey: `plan:goal:${hash8(plan.goal)}`,
      title: plan.goal.title,
      summary: goalSummary(plan),
      refs: [],
      source: "plan.json:goal",
    });
  }

  const previousById = new Map(previous.items.map((item) => [item.id, item]));
  for (const item of plan.items) {
    const before = previousById.get(item.id);
    if (before && sameValue(itemComparable(item), itemComparable(before))) continue;

    const attemptsUp = item.attempts > (before?.attempts ?? 0);
    const startedRunning = item.status === "running" && before?.status !== "running";
    append({
      kind: attemptsUp || startedRunning ? "dispatch" : "sprint",
      id: `item:${item.id}:${hash8(item)}`,
      dedupeKey: `plan:item:${hash8(item)}`,
      title: item.title,
      summary: itemSummary(item),
      refs: [`item:${item.id}`, ...(item.files ?? [])],
      itemId: item.id,
      ...(item.files !== undefined ? { paths: item.files } : {}),
      status: item.status,
      source: "plan.json:items",
    });
  }

  for (let index = previous.limitHistory.length; index < plan.limitHistory.length; index += 1) {
    const change = plan.limitHistory[index];
    if (!change) continue;
    append({
      kind: "decision",
      id: `decision:limit:${hash8(change)}`,
      dedupeKey: `plan:limit:${hash8(change)}`,
      title: `Límite ${change.field}`,
      summary: limitSummary(change),
      refs: [`limit:${change.field}`],
      source: "plan.json:limitHistory",
    });
  }

  for (let index = previous.limitReports.length; index < plan.limitReports.length; index += 1) {
    const report = plan.limitReports[index];
    if (!report) continue;
    append({
      kind: "report",
      id: `report:limit:${hash8(report)}`,
      dedupeKey: `plan:report:${hash8(report)}`,
      title: `Reporte de límite ${report.field}`,
      summary: reportSummary(report),
      refs: [],
      source: "plan.json:limitReports",
    });
  }

  return results;
}

/**
 * Anexa el resultado de una reversión. La línea de reverts.jsonl ya la escribió
 * el ejecutor; este evento solo la refleja en el registro durable. Repetir el
 * mismo `audit` no duplica nada.
 */
export function recordRevert(input: {
  workspaceRoot: string;
  selection: RevertSelection;
  execution: RevertExecution;
  result: AutonRevertResult;
  now?: Date;
}): AutonRegistryAppendResult {
  const { workspaceRoot, selection, execution, result } = input;
  const at = execution.audit.at;
  const paths = [
    ...new Set(execution.audit.files.map((file) => file.path)),
  ];
  const digest = hash8({ selection, files: paths, at });

  return appendRegistryRecord(
    workspaceRoot,
    {
      kind: "revert",
      id: `revert:${digest}`,
      dedupeKey: `revert:${digest}`,
      at,
      title: "Reversión",
      summary: oneLine(
        `${result}: ${execution.reverted} revertidos, ${execution.already} ya estaban, ${execution.conflicts} conflictos, ${execution.blocked} bloqueados`,
      ),
      refs: paths,
      paths,
      status: result,
      source: "reverts.jsonl",
    },
    { now: input.now ?? new Date(at) },
  );
}
