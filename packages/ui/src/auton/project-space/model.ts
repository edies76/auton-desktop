// ============================================================
// Auton project space — modelo puro
// ============================================================
// Sin React y sin store: ordenar proyectos, formatear relojes y traducir el
// estado de un worker a etiqueta y tono. Así las pruebas ejercitan la lógica
// real sin montar Electron.

export type AutonWorkerStatus =
  | "trabajando"
  | "preguntando"
  | "esperando"
  | "bloqueado"
  | "terminado";

export interface AutonProject {
  id: string;
  name: string;
  path: string;
  lastActiveAt: number;
}

export interface AutonWorkerEvent {
  id: string;
  at: number;
  kind: "message" | "tool" | "question" | "close";
  text: string;
}

export type AutonWorkerKind = "agent" | "subagent" | "muse";
export type AutonWorkerEngine = "zcode" | "muse";

export interface AutonWorkerView {
  id: string;
  name: string;
  status: AutonWorkerStatus;
  /** Inicio del worker, epoch ms. */
  startedAt: number;
  /** Última señal, epoch ms. */
  lastSignalAt: number;
  lastLine?: string;
  transcript: AutonWorkerEvent[];
  /** Rol del canal: agente completo de ZCode, subagente o motor Muse. */
  kind?: AutonWorkerKind;
  engine?: AutonWorkerEngine;
  /** Subagentes creados por este worker, cuando la sesión los expone. */
  subagentCount?: number;
  /** Identificador con el que se detiene al worker; el panel lo usa para el botón. */
  agentId?: string;
}

export interface AutonWorkerGroup {
  kind: AutonWorkerKind;
  label: string;
  workers: AutonWorkerView[];
  /** Un subagente no se detiene desde este panel; su orquestador lo cierra. */
  canStop?: boolean;
}

export interface AutonWorkTramo {
  id: string;
  startedAt: number;
  endedAt?: number;
  workerIds: string[];
}

export interface AutonEvidence {
  id: string;
  command: string;
  output: string;
  files: string[];
}

export interface AutonThreadMessage {
  id: string;
  at: number;
  role: "orchestrator" | "human";
  text: string;
}

export interface AutonPlanItemView {
  id: string;
  title: string;
  status: string;
  owner?: string;
}

export interface AutonPlanView {
  goalTitle?: string;
  items: AutonPlanItemView[];
}

export interface AutonProjectSpaceData {
  messages: AutonThreadMessage[];
  workers: AutonWorkerView[];
  tramos: AutonWorkTramo[];
  plan?: AutonPlanView;
  evidence?: AutonEvidence;
}

export const AUTON_WORKER_SILENCE_MS = 45_000;

export const AUTON_WORKER_STATUS_META: Record<
  AutonWorkerStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  trabajando: {
    label: "Trabajando",
    badgeClass: "bg-primary/15 text-primary",
    dotClass: "bg-primary",
  },
  preguntando: {
    label: "Preguntando",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  esperando: {
    label: "Esperando",
    badgeClass: "bg-secondary text-secondary-foreground",
    dotClass: "bg-muted-foreground",
  },
  bloqueado: {
    label: "Bloqueado",
    badgeClass: "bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  terminado: {
    label: "Terminado",
    badgeClass: "bg-secondary text-secondary-foreground",
    dotClass: "bg-muted-foreground",
  },
};

export function sortProjectsByActivity(projects: readonly AutonProject[]): AutonProject[] {
  return [...projects].sort((a, b) => {
    if (b.lastActiveAt !== a.lastActiveAt) return b.lastActiveAt - a.lastActiveAt;
    return a.name.localeCompare(b.name);
  });
}

/** mm:ss, o h:mm:ss cuando pasa de una hora. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatProjectActivity(lastActiveAt: number, now: number): string {
  const elapsed = Math.max(0, now - lastActiveAt);
  if (elapsed < 60_000) return "actividad ahora";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `actividad hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `actividad hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `actividad hace ${days} d`;
}

export function workerElapsed(worker: AutonWorkerView, now: number): number {
  const end = worker.status === "terminado" ? worker.lastSignalAt : now;
  return Math.max(0, end - worker.startedAt);
}

export function formatWorkerSilence(lastSignalAt: number, now: number): string {
  const elapsed = Math.max(0, now - lastSignalAt);
  if (elapsed < 60_000) return `sin señales hace ${Math.floor(elapsed / 1000)}s`;
  const minutes = Math.floor(elapsed / 60_000);
  return `sin señales hace ${minutes}m`;
}

export function isWorkerSilent(
  worker: AutonWorkerView,
  now: number,
  thresholdMs = AUTON_WORKER_SILENCE_MS,
): boolean {
  if (worker.status === "terminado") return false;
  return now - worker.lastSignalAt >= thresholdMs;
}

export function formatTramoDuration(tramo: AutonWorkTramo, now: number): string {
  const end = tramo.endedAt ?? now;
  return formatClock(end - tramo.startedAt);
}

export function canCreateProject(name: string, path: string): boolean {
  return name.trim().length > 0 && path.trim().length > 0;
}

export function validateProjectDraft(name: string, path: string): {
  ok: boolean;
  errors: { name?: string; path?: string };
} {
  const errors: { name?: string; path?: string } = {};
  if (!name.trim()) errors.name = "El nombre es obligatorio.";
  if (!path.trim()) errors.path = "La ruta es obligatoria.";
  return { ok: Object.keys(errors).length === 0, errors };
}

export function emptySpaceData(): AutonProjectSpaceData {
  return { messages: [], workers: [], tramos: [] };
}

export function projectIdFor(name: string, path: string, existing: readonly AutonProject[]): string {
  const base =
    `${name.trim()}-${path.trim()}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "proyecto";
  let candidate = base;
  let suffix = 2;
  const taken = new Set(existing.map((project) => project.id));
  while (taken.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
