import type { ProjectTask } from "@zcode/services";

/**
 * Cada proyecto tiene UNA conversación de orquestador. Las sesiones que no son
 * esa conversación quedan como legado (no se muestran como workers). Los
 * workers reales son las sesiones `auton-worker` de la proyección viva.
 */
export interface ProjectConversation {
  orchestratorTaskId: string;
  legacyTaskIds: string[];
}

const KEY = "auton-project-conversation-v3";

function readAll(): Record<string, ProjectConversation> {
  try {
    if (typeof localStorage === "undefined") return {};
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, ProjectConversation>) : {};
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, ProjectConversation>): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* preferencia de UI; un fallo de almacenamiento no rompe el panel */
  }
}

export function projectConversationKey(workspaceKey: string, projectId: string): string {
  return `${workspaceKey}::${projectId}`;
}

function oldestTask(tasks: readonly ProjectTask[]): ProjectTask | undefined {
  return [...tasks].sort((left, right) => left.createdAt - right.createdAt)[0];
}

export function ensureProjectConversation(
  key: string,
  tasks: readonly ProjectTask[],
  activeTaskId?: string | null,
): ProjectConversation {
  const all = readAll();
  // Una sesión hija de worker nunca puede ser la conversación del proyecto.
  const candidates = tasks.filter((task) => !isWorkerSessionTaskId(task.taskId));
  const ids = new Set(candidates.map((task) => task.taskId));
  const current = all[key];
  if (current && ids.has(current.orchestratorTaskId)) return current;

  // La sesión del humano manda. Si no hay una, la conversación persistida o la
  // más antigua del proyecto; nunca se elige por “lo último actualizado”.
  const active =
    activeTaskId && ids.has(activeTaskId)
      ? candidates.find((task) => task.taskId === activeTaskId)
      : undefined;
  const orchestrator = active ?? oldestTask(candidates);
  const next: ProjectConversation = {
    orchestratorTaskId: orchestrator?.taskId ?? "",
    legacyTaskIds: candidates
      .filter((task) => task.taskId !== orchestrator?.taskId)
      .map((task) => task.taskId),
  };
  all[key] = next;
  writeAll(all);
  return next;
}

export function rememberProjectOrchestrator(key: string, taskId: string): ProjectConversation | null {
  const all = readAll();
  const current = all[key];
  if (!current || current.orchestratorTaskId === taskId) return current ?? null;
  const next: ProjectConversation = {
    orchestratorTaskId: taskId,
    legacyTaskIds: [...new Set([...current.legacyTaskIds, current.orchestratorTaskId])].filter(
      (id) => id !== taskId,
    ),
  };
  all[key] = next;
  writeAll(all);
  return next;
}

export function isLegacyProjectTask(key: string, taskId: string | null): boolean {
  if (!taskId) return false;
  return readAll()[key]?.legacyTaskIds.includes(taskId) ?? false;
}

/**
 * Las sesiones hijas del orquestador (`auton-worker` y subagentes) son canales
 * de trabajo, no chats del proyecto. Nunca se listan ni se editan como tarea.
 */
export function isWorkerSessionTaskId(taskId: string | null | undefined): boolean {
  return Boolean(
    taskId && (taskId.startsWith("sess_auton_") || taskId.startsWith("sess_subagent_")),
  );
}

/** Una tarea solo puede ser el chat del proyecto si no es legado ni worker. */
export function isPromotableProjectTask(input: {
  taskId: string;
  legacyTaskIds: readonly string[];
}): boolean {
  return !isWorkerSessionTaskId(input.taskId) && !input.legacyTaskIds.includes(input.taskId);
}

export type ProjectTaskSelection =
  | { action: "open"; taskId: string }
  | { action: "worker"; taskId: string }
  | { action: "redirect-orchestrator"; taskId: string }
  | { action: "promote-and-open"; taskId: string };

/**
 * Qué hacer al seleccionar una tarea del proyecto. Un worker va a su panel de
 * solo lectura, un legado reabre el orquestador y solo una tarea nueva puede
 * convertirse en la conversación del proyecto.
 */
export function resolveProjectTaskSelection(input: {
  taskId: string;
  orchestratorTaskId: string;
  legacyTaskIds: readonly string[];
}): ProjectTaskSelection {
  if (isWorkerSessionTaskId(input.taskId)) {
    return { action: "worker", taskId: input.taskId };
  }
  if (!isPromotableProjectTask(input)) {
    return { action: "redirect-orchestrator", taskId: input.taskId };
  }
  if (input.orchestratorTaskId === input.taskId) {
    return { action: "open", taskId: input.taskId };
  }
  return { action: "promote-and-open", taskId: input.taskId };
}

/**
 * Tareas que no deben salir en las vistas de tareas: los chats legados de cada
 * proyecto y las sesiones hijas de worker. La conversación del orquestador de
 * cada proyecto sí queda visible (una por proyecto).
 */
export function hiddenProjectTaskIds(
  workspaceKey: string,
  tasks: readonly ProjectTask[],
  activeTaskId?: string | null,
): Set<string> {
  const hidden = new Set<string>();
  const projectIds = new Set<string>();
  for (const task of tasks) {
    if (isWorkerSessionTaskId(task.taskId)) hidden.add(task.taskId);
    // Una tarea sin proyecto es un chat suelto del ZCode heredado: el panel
    // del proyecto no lo lista como si fuera otra conversación del proyecto.
    if (!task.projectId) hidden.add(task.taskId);
    if (task.projectId) projectIds.add(task.projectId);
  }
  for (const projectId of projectIds) {
    const projectTasks = tasks.filter((task) => task.projectId === projectId);
    const conversation = ensureProjectConversation(
      projectConversationKey(workspaceKey, projectId),
      projectTasks,
      activeTaskId,
    );
    for (const taskId of conversation.legacyTaskIds) hidden.add(taskId);
  }
  return hidden;
}

/** Reclama la creación una sola vez por proyecto, no una vez por app. */
export function claimProjectConversationCreation(created: Set<string>, key: string): boolean {
  if (created.has(key)) return false;
  created.add(key);
  return true;
}

/** La sesión activa manda; solo se abre otra si es legado o no hay ninguna. */
export function shouldOpenProjectOrchestrator(input: {
  activeTaskId: string | null;
  orchestratorTaskId: string;
  legacyTaskIds: readonly string[];
}): boolean {
  if (!input.orchestratorTaskId) return false;
  if (!input.activeTaskId) return true;
  if (input.activeTaskId === input.orchestratorTaskId) return false;
  return input.legacyTaskIds.includes(input.activeTaskId);
}
