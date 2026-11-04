// ============================================================
// Plan del proyecto — lectura y agrupación para el tablero
// ============================================================
// El plan vive en <proyecto>/.auton/plan.json y lo escribe el orquestador.
// Este módulo es puro: convierte el JSON en un modelo de sprint sin React y
// sin servicios, para que el tablero se pruebe sin montar Electron.

export type AutonSprintStatus =
  | "ready"
  | "running"
  | "waiting"
  | "blocked"
  | "done"
  | "dropped"
  | "not_evaluable";

export interface AutonSprintEvidence {
  kind: string;
  label: string;
  ref?: string;
}

export interface AutonSprintItem {
  id: string;
  title: string;
  status: AutonSprintStatus;
  detail?: string;
  owner?: string;
  effort?: string;
  mode?: string;
  engine?: string;
  files: string[];
  evidence: AutonSprintEvidence[];
  questions: string[];
  attempts: number;
}

export interface AutonPlanFile {
  goalTitle?: string;
  statement?: string;
  constraints: string[];
  done: string[];
  items: AutonSprintItem[];
  updatedAt?: string;
  limitHistoryCount: number;
  limitReportsCount: number;
}

export interface AutonSprintColumn {
  status: AutonSprintStatus;
  label: string;
  items: AutonSprintItem[];
}

export interface AutonSprintSummary {
  total: number;
  ready: number;
  running: number;
  waiting: number;
  blocked: number;
  done: number;
  dropped: number;
  notEvaluable: number;
}

const SPRINT_STATUSES: readonly AutonSprintStatus[] = [
  "ready",
  "running",
  "waiting",
  "blocked",
  "done",
  "dropped",
  "not_evaluable",
];

/** Orden del tablero: lo que falta, lo vivo, lo que espera y lo cerrado. */
export const AUTON_SPRINT_COLUMNS: readonly { status: AutonSprintStatus; label: string }[] = [
  { status: "ready", label: "Pendientes" },
  { status: "running", label: "Activos" },
  { status: "waiting", label: "Esperando" },
  { status: "blocked", label: "Bloqueados" },
  { status: "not_evaluable", label: "No evaluables" },
  { status: "done", label: "Terminados" },
  { status: "dropped", label: "Descartados" },
];

export const AUTON_SPRINT_STATUS_META: Record<
  AutonSprintStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  ready: {
    label: "Pendiente",
    badgeClass: "bg-secondary text-secondary-foreground",
    dotClass: "bg-muted-foreground",
  },
  running: {
    label: "Activo",
    badgeClass: "bg-primary/15 text-primary",
    dotClass: "bg-primary",
  },
  waiting: {
    label: "Esperando",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  blocked: {
    label: "Bloqueado",
    badgeClass: "bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  done: {
    label: "Terminado",
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  dropped: {
    label: "Descartado",
    badgeClass: "bg-secondary text-foreground-subtle",
    dotClass: "bg-muted-foreground",
  },
  not_evaluable: {
    label: "No evaluable",
    badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
};

export function planFilePath(workspaceRoot: string): string {
  const separator = workspaceRoot.includes("\\") ? "\\" : "/";
  const base = workspaceRoot.replace(/[\\/]+$/, "");
  return `${base}${separator}.auton${separator}plan.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function statusOf(record: Record<string, unknown>): AutonSprintStatus {
  const value = stringField(record, "status");
  if (value && SPRINT_STATUSES.includes(value as AutonSprintStatus)) {
    return value as AutonSprintStatus;
  }
  // Un estado que el tablero no entiende no se inventa: se marca como no evaluable.
  return "not_evaluable";
}

function evidenceOf(record: Record<string, unknown>): AutonSprintEvidence[] {
  const value = record.evidence;
  if (!Array.isArray(value)) return [];
  const evidence: AutonSprintEvidence[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const kind = stringField(raw, "kind");
    const label = stringField(raw, "label");
    if (!kind || !label) continue;
    const ref = stringField(raw, "ref");
    evidence.push({ kind, label, ...(ref ? { ref } : {}) });
  }
  return evidence;
}

function itemOf(record: Record<string, unknown>): AutonSprintItem | null {
  const id = stringField(record, "id");
  const title = stringField(record, "title");
  if (!id || !title) return null;
  const detail = stringField(record, "detail");
  const owner = stringField(record, "owner");
  const effort = stringField(record, "effort");
  const mode = stringField(record, "mode");
  const engine = stringField(record, "engine");
  const attempts = typeof record.attempts === "number" && Number.isFinite(record.attempts)
    ? Math.max(0, Math.trunc(record.attempts))
    : 0;
  return {
    id,
    title,
    status: statusOf(record),
    ...(detail ? { detail } : {}),
    ...(owner ? { owner } : {}),
    ...(effort ? { effort } : {}),
    ...(mode ? { mode } : {}),
    ...(engine ? { engine } : {}),
    files: stringList(record, "files"),
    evidence: evidenceOf(record),
    questions: stringList(record, "questions"),
    attempts,
  };
}

/**
 * Convierte el contenido de `plan.json` en el modelo del tablero.
 * Devuelve `null` cuando el archivo no tiene la forma mínima de un plan.
 * Un item corrupto se descarta; el resto del plan sigue siendo legible.
 */
export function parseAutonPlanFile(raw: string): AutonPlanFile | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.items)) return null;

  const goal = isRecord(parsed.goal) ? parsed.goal : {};
  const goalTitle = stringField(goal, "title");
  const statement = stringField(goal, "statement");
  const updatedAt = stringField(parsed, "updatedAt");

  const items: AutonSprintItem[] = [];
  const seen = new Set<string>();
  for (const rawItem of parsed.items) {
    if (!isRecord(rawItem)) continue;
    const item = itemOf(rawItem);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }

  return {
    ...(goalTitle ? { goalTitle } : {}),
    ...(statement ? { statement } : {}),
    constraints: stringList(goal, "constraints"),
    done: stringList(goal, "done"),
    items,
    ...(updatedAt ? { updatedAt } : {}),
    limitHistoryCount: Array.isArray(parsed.limitHistory) ? parsed.limitHistory.length : 0,
    limitReportsCount: Array.isArray(parsed.limitReports) ? parsed.limitReports.length : 0,
  };
}

export function groupSprints(plan: AutonPlanFile): AutonSprintColumn[] {
  return AUTON_SPRINT_COLUMNS.map((column) => ({
    ...column,
    items: plan.items.filter((item) => item.status === column.status),
  }));
}

export function summarizePlan(plan: AutonPlanFile): AutonSprintSummary {
  const summary: AutonSprintSummary = {
    total: plan.items.length,
    ready: 0,
    running: 0,
    waiting: 0,
    blocked: 0,
    done: 0,
    dropped: 0,
    notEvaluable: 0,
  };
  for (const item of plan.items) {
    if (item.status === "not_evaluable") summary.notEvaluable += 1;
    else summary[item.status] += 1;
  }
  return summary;
}
