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
  const ids = new Set(tasks.map((task) => task.taskId));
  const current = all[key];
  if (current && ids.has(current.orchestratorTaskId)) return current;

  // La sesión del humano manda. Si no hay una, la conversación persistida o la
  // más antigua del proyecto; nunca se elige por “lo último actualizado”.
  const active =
    activeTaskId && ids.has(activeTaskId)
      ? tasks.find((task) => task.taskId === activeTaskId)
      : undefined;
  const orchestrator = active ?? oldestTask(tasks);
  const next: ProjectConversation = {
    orchestratorTaskId: orchestrator?.taskId ?? "",
    legacyTaskIds: tasks
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
