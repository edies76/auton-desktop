// ============================================================
// Auton registry — lectura (Nivel 0)
// ============================================================
// Lee lo que Auton ya escribe en disco y lo convierte en fichas con
// identificador y referencias. Es solo lectura: no crea, no modifica y no
// borra archivos. Tampoco devuelve el contenido de los cambios; solo rutas,
// tamaños y huellas, para que una búsqueda no filtre secretos.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AutonPlanSchema,
  normalizeLegacyPlan,
  type AutonPlan,
  type AutonPlanItem,
} from "@zcode/contracts";
import {
  AUTON_DIR_NAME,
  CHANGES_FILE_NAME,
  REVERTS_FILE_NAME,
  type ChangeRecord,
  type RevertAuditEntry,
} from "./journal.js";

export const AUTON_REGISTRY_READ_VERSION = 1;

export const AUTON_REGISTRY_RECORD_KINDS = [
  "goal",
  "sprint",
  "decision",
  "report",
  "artifact",
  "change",
  "revert",
] as const;

export type AutonRegistryRecordKind = (typeof AUTON_REGISTRY_RECORD_KINDS)[number];

export interface AutonRegistryRecord {
  /** Identificador estable dentro del registro, por ejemplo `item:s1`. */
  id: string;
  kind: AutonRegistryRecordKind;
  /** ISO timestamp cuando la fuente lo tiene. */
  at?: string;
  title: string;
  /** Resumen de una línea; nunca incluye el contenido del archivo. */
  summary: string;
  /** Identificadores de otras fichas, rutas o URLs. */
  refs: string[];
  /** Archivo y línea de origen, por ejemplo `changes.jsonl:12`. */
  source: string;
  status?: string;
  agentId?: string;
  itemId?: string;
  paths?: string[];
}

export type AutonRegistryWarningCode =
  | "invalid_plan"
  | "malformed_line"
  | "duplicate_id"
  | "broken_ref";

export interface AutonRegistryWarning {
  code: AutonRegistryWarningCode;
  source: string;
  message: string;
}

export interface AutonRegistrySnapshot {
  version: number;
  generatedAt: string;
  records: AutonRegistryRecord[];
  warnings: AutonRegistryWarning[];
}

export interface AutonRegistryQuery {
  id?: string;
  text?: string;
  kind?: AutonRegistryRecordKind;
  /** Busca una referencia exacta, por ejemplo `item:s1` o `src/login.ts`. */
  ref?: string;
  /** Máximo de resultados; por defecto 5. */
  limit?: number;
}

export interface AutonRegistryMatch {
  record: AutonRegistryRecord;
  score: number;
}

export interface AutonRegistrySearchResult {
  matches: AutonRegistryMatch[];
  total: number;
  truncated: boolean;
  query: AutonRegistryQuery;
}

export interface AutonRegistryVerifyResult {
  ok: boolean;
  issues: AutonRegistryWarning[];
}

interface ParsedLine<T> {
  value?: T;
  index: number;
  error?: string;
}

const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 20;
const ID_PREFIXES = [
  "goal",
  "item:",
  "decision:",
  "report:",
  "artifact:",
  "change:",
  "revert:",
] as const;

function registryDir(workspaceRoot: string): string {
  return join(workspaceRoot, AUTON_DIR_NAME);
}

function readTextIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function parseJsonLines<T>(raw: string): ParsedLine<T>[] {
  const lines = raw.split(/\r?\n/);
  const parsed: ParsedLine<T>[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line.length === 0) continue;
    try {
      parsed.push({ value: JSON.parse(line) as T, index: index + 1 });
    } catch {
      parsed.push({ index: index + 1, error: "no es JSON válido" });
    }
  }
  return parsed;
}

function isChangeRecord(value: unknown): value is ChangeRecord {
  if (!value || typeof value !== "object") return false;
  const parsed = value as Partial<ChangeRecord>;
  return (
    typeof parsed.at === "string" &&
    typeof parsed.agentId === "string" &&
    typeof parsed.sessionId === "string" &&
    typeof parsed.path === "string" &&
    (parsed.before === null || typeof parsed.before === "string" || parsed.before === undefined) &&
    (parsed.after === null || typeof parsed.after === "string" || parsed.after === undefined)
  );
}

function isRevertAuditEntry(value: unknown): value is RevertAuditEntry {
  if (!value || typeof value !== "object") return false;
  const parsed = value as Partial<RevertAuditEntry>;
  return (
    typeof parsed.at === "string" &&
    Boolean(parsed.selection) &&
    typeof parsed.selection === "object" &&
    Array.isArray(parsed.files)
  );
}

function hashText(value: string | null | undefined): string {
  if (typeof value !== "string") return "none";
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

function byteLength(value: string | null | undefined): number {
  return typeof value === "string" ? Buffer.byteLength(value, "utf8") : 0;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function changeSummary(record: ChangeRecord): string {
  const before = byteLength(record.before);
  const after = byteLength(record.after);
  const action = record.before === null ? "creó" : record.after === null ? "borró" : "cambió";
  return `${record.agentId} ${action} ${record.path} (${before} B → ${after} B, sha ${hashText(record.before)}→${hashText(record.after)})`;
}

function planItems(plan: AutonPlan): AutonPlanItem[] {
  return plan.items;
}

function planGoalRecord(plan: AutonPlan, source: string): AutonRegistryRecord | undefined {
  if (!plan.goal) return undefined;
  const refs = plan.goal.done ?? [];
  return {
    id: "goal",
    kind: "goal",
    ...(plan.updatedAt ? { at: plan.updatedAt } : {}),
    title: plan.goal.title,
    summary: oneLine(plan.goal.statement ?? plan.goal.title),
    refs,
    source,
  };
}

function itemRecord(item: AutonPlanItem, source: string): AutonRegistryRecord {
  const refs = [
    ...(item.files ?? []),
    ...(item.evidence ?? []).flatMap((evidence) =>
      evidence.ref ? [evidence.ref] : [],
    ),
  ];
  const extras = [
    item.owner ? `owner ${item.owner}` : undefined,
    item.effort ? `effort ${item.effort}` : undefined,
    item.mode ? `mode ${item.mode}` : undefined,
    item.attempts > 0 ? `attempts ${item.attempts}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return {
    id: `item:${item.id}`,
    kind: "sprint",
    title: item.title,
    summary: oneLine([item.status, ...extras, item.detail].filter(Boolean).join(" · ")),
    refs: refs.length > 0 ? refs : [`item:${item.id}`],
    source,
    status: item.status,
    ...(item.owner ? { agentId: item.owner } : {}),
    itemId: item.id,
    ...(item.files?.length ? { paths: item.files } : {}),
  };
}

function itemDecisionRecords(plan: AutonPlan, source: string): AutonRegistryRecord[] {
  return plan.limitHistory.map((change, index) => ({
    id: `decision:limit:${index + 1}`,
    kind: "decision" as const,
    at: change.at,
    title: `Límite ${change.field}`,
    summary: oneLine(
      `${change.field}: ${change.from ?? "—"} → ${change.to ?? "—"} · ${change.reason} (${change.approvedBy})`,
    ),
    refs: ["goal"],
    source,
  }));
}

function itemReportRecords(plan: AutonPlan, source: string): AutonRegistryRecord[] {
  return plan.limitReports.map((report, index) => ({
    id: `report:limit:${index + 1}`,
    kind: "report" as const,
    at: report.at,
    title: `Reporte de límite: ${report.field}`,
    summary: oneLine(
      `${report.by} observó ${report.observed}${report.expected ? `; esperaba ${report.expected}` : ""}${report.note ? ` · ${report.note}` : ""}`,
    ),
    refs: ["goal"],
    source,
  }));
}

function itemArtifactRecords(plan: AutonPlan, source: string): AutonRegistryRecord[] {
  const records: AutonRegistryRecord[] = [];
  for (const item of planItems(plan)) {
    for (const [index, evidence] of (item.evidence ?? []).entries()) {
      records.push({
        id: `artifact:${item.id}:${index + 1}`,
        kind: "artifact",
        title: evidence.label,
        summary: `${evidence.kind}${evidence.ref ? ` · ${evidence.ref}` : ""}`,
        refs: [`item:${item.id}`, ...(evidence.ref ? [evidence.ref] : [])],
        source,
        itemId: item.id,
        ...(evidence.ref ? { paths: [evidence.ref] } : {}),
      });
    }
  }
  return records;
}

function changeRecord(record: ChangeRecord, index: number): AutonRegistryRecord {
  return {
    id: `change:${index}`,
    kind: "change",
    at: record.at,
    title: `Cambio en ${record.path}`,
    summary: changeSummary(record),
    refs: [
      ...(record.itemId ? [`item:${record.itemId}`] : []),
      record.path,
    ],
    source: `${CHANGES_FILE_NAME}:${index}`,
    agentId: record.agentId,
    ...(record.itemId ? { itemId: record.itemId } : {}),
    paths: [record.path],
  };
}

function revertRecord(entry: RevertAuditEntry, index: number): AutonRegistryRecord {
  const paths = entry.files.map((file) => file.path);
  const outcomes = entry.files.reduce<Record<string, number>>((counts, file) => {
    counts[file.outcome] = (counts[file.outcome] ?? 0) + 1;
    return counts;
  }, {});
  const refs = [
    ...(entry.selection.itemId ? [`item:${entry.selection.itemId}`] : []),
    ...paths,
  ];
  return {
    id: `revert:${index}`,
    kind: "revert",
    at: entry.at,
    title: `Reversión de ${paths.length} archivo${paths.length === 1 ? "" : "s"}`,
    summary: Object.entries(outcomes)
      .map(([outcome, count]) => `${outcome} ${count}`)
      .join(" · "),
    refs,
    source: `${REVERTS_FILE_NAME}:${index}`,
    ...(entry.selection.agentId ? { agentId: entry.selection.agentId } : {}),
    ...(entry.selection.itemId ? { itemId: entry.selection.itemId } : {}),
    paths,
  };
}

function brokenReferenceWarnings(records: readonly AutonRegistryRecord[]): AutonRegistryWarning[] {
  const ids = new Set(records.map((record) => record.id));
  const warnings: AutonRegistryWarning[] = [];
  for (const record of records) {
    for (const ref of record.refs) {
      const looksLikeRegistryId = ID_PREFIXES.some(
        (prefix) => ref === prefix || ref.startsWith(prefix),
      );
      if (!looksLikeRegistryId || ids.has(ref)) continue;
      warnings.push({
        code: "broken_ref",
        source: record.source,
        message: `${record.id} referencia ${ref}, que no existe en el registro`,
      });
    }
  }
  return warnings;
}

/**
 * Lee el registro derivado del workspace. Es tolerante a datos viejos o
 * corruptos: una línea mala no invalida el resto y queda como advertencia.
 */
export function readAutonRegistry(workspaceRoot: string, now = new Date()): AutonRegistrySnapshot {
  const records: AutonRegistryRecord[] = [];
  const warnings: AutonRegistryWarning[] = [];
  const dir = registryDir(workspaceRoot);

  const planPath = join(dir, "plan.json");
  const planRaw = readTextIfPresent(planPath);
  if (planRaw !== null) {
    try {
      const parsed: unknown = JSON.parse(planRaw);
      const result = AutonPlanSchema.safeParse(parsed);
      if (result.success) {
        const plan = normalizeLegacyPlan(result.data);
        const source = "plan.json";
        const goal = planGoalRecord(plan, source);
        if (goal) records.push(goal);
        for (const item of planItems(plan)) records.push(itemRecord(item, source));
        records.push(...itemDecisionRecords(plan, source));
        records.push(...itemReportRecords(plan, source));
        records.push(...itemArtifactRecords(plan, source));
      } else {
        warnings.push({
          code: "invalid_plan",
          source: "plan.json",
          message: result.error.issues.map((issue) => issue.message).join("; "),
        });
      }
    } catch {
      warnings.push({
        code: "invalid_plan",
        source: "plan.json",
        message: "no es JSON válido",
      });
    }
  }

  const changesRaw = readTextIfPresent(join(dir, CHANGES_FILE_NAME));
  if (changesRaw !== null) {
    for (const line of parseJsonLines<unknown>(changesRaw)) {
      if (line.error || !isChangeRecord(line.value)) {
        warnings.push({
          code: "malformed_line",
          source: `${CHANGES_FILE_NAME}:${line.index}`,
          message: line.error ?? "no tiene la forma de un cambio",
        });
        continue;
      }
      records.push(changeRecord(line.value, line.index));
    }
  }

  const revertsRaw = readTextIfPresent(join(dir, REVERTS_FILE_NAME));
  if (revertsRaw !== null) {
    for (const line of parseJsonLines<unknown>(revertsRaw)) {
      if (line.error || !isRevertAuditEntry(line.value)) {
        warnings.push({
          code: "malformed_line",
          source: `${REVERTS_FILE_NAME}:${line.index}`,
          message: line.error ?? "no tiene la forma de una reversión",
        });
        continue;
      }
      records.push(revertRecord(line.value, line.index));
    }
  }

  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) {
      warnings.push({
        code: "duplicate_id",
        source: record.source,
        message: `id duplicado: ${record.id}`,
      });
    }
    seen.add(record.id);
  }

  warnings.push(...brokenReferenceWarnings(records));

  return {
    version: AUTON_REGISTRY_READ_VERSION,
    generatedAt: now.toISOString(),
    records,
    warnings,
  };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT;
  return Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.floor(limit)));
}

function timeValue(at: string | undefined): number {
  if (!at) return 0;
  const parsed = Date.parse(at);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textScore(record: AutonRegistryRecord, text: string): number {
  const needle = text.trim().toLowerCase();
  if (!needle) return 0;
  const title = record.title.toLowerCase();
  const summary = record.summary.toLowerCase();
  const refs = record.refs.join(" ").toLowerCase();
  let score = 0;
  if (title === needle) score += 100;
  else if (title.includes(needle)) score += 30;
  if (summary.includes(needle)) score += 8;
  if (refs.includes(needle)) score += 15;
  if (record.id.toLowerCase() === needle) score += 200;
  return score;
}

export function searchAutonRegistry(
  snapshot: AutonRegistrySnapshot,
  query: AutonRegistryQuery = {},
): AutonRegistrySearchResult {
  const limit = clampLimit(query.limit);
  const id = query.id?.trim();
  const text = query.text?.trim();
  const ref = query.ref?.trim();
  const matches: AutonRegistryMatch[] = [];

  for (const record of snapshot.records) {
    if (query.kind && record.kind !== query.kind) continue;
    if (id && record.id !== id) continue;
    if (ref && !record.refs.includes(ref)) continue;
    const score = text ? textScore(record, text) : 1;
    if (text && score === 0) continue;
    matches.push({ record, score });
  }

  matches.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    const time = timeValue(right.record.at) - timeValue(left.record.at);
    if (time !== 0) return time;
    return left.record.id.localeCompare(right.record.id);
  });

  return {
    matches: matches.slice(0, limit),
    total: matches.length,
    truncated: matches.length > limit,
    query: { ...query, limit },
  };
}

/** Formato compacto: una línea por ficha, con su id y su fuente. */
export function formatAutonRegistryMatches(result: AutonRegistrySearchResult): string {
  if (result.matches.length === 0) return "Sin recuerdos que coincidan.";
  return result.matches
    .map(
      ({ record }) =>
        `- ${record.id} [${record.kind}] ${oneLine(record.summary)} (${record.source})`,
    )
    .join("\n");
}

/**
 * Verificación de integridad del registro derivado. No escribe ni corrige:
 * informa para que el orquestador decida.
 */
export function verifyAutonRegistry(snapshot: AutonRegistrySnapshot): AutonRegistryVerifyResult {
  const issues: AutonRegistryWarning[] = [...snapshot.warnings];
  const seen = new Set<string>();
  for (const record of snapshot.records) {
    if (seen.has(record.id)) {
      issues.push({
        code: "duplicate_id",
        source: record.source,
        message: `id duplicado: ${record.id}`,
      });
    }
    seen.add(record.id);
  }
  issues.push(...brokenReferenceWarnings(snapshot.records));
  return { ok: issues.length === 0, issues };
}
