import type { ProjectTask } from "@zcode/services";

/**
 * Cada proyecto tiene UNA conversación de orquestador. Los chats anteriores que
 * no son esa conversación quedan como legado (no se muestran como workers); los
 * workers se marcan explícitamente cuando el runtime crea una sesión completa.
 */
export interface ProjectConversation {
  orchestratorTaskId: string;
  legacyTaskIds: string[];
  workerTaskIds: string[];
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
): ProjectConversation {
  const all = readAll();
  const ids = new Set(tasks.map((task) => task.taskId));
  const current = all[key];
  if (
    current &&
    ids.has(current.orchestratorTaskId) &&
    !current.workerTaskIds.includes(current.orchestratorTaskId)
  )
    return current;

  // La primera vez manda la última conversación del humano, nunca un task
  // marcado como worker. Cuando el humano abre otra, `remember...` la fija y
  // esa identidad gana en los siguientes arranques.
  const workerIds = new Set(current?.workerTaskIds ?? []);
  const candidates = tasks.filter((task) => !workerIds.has(task.taskId));
  const latestConversation = [...candidates].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  )[0];
  const orchestrator = latestConversation ?? oldestTask(tasks);
  const next: ProjectConversation = {
    orchestratorTaskId: orchestrator?.taskId ?? "",
    legacyTaskIds: tasks
      .filter((task) => task.taskId !== orchestrator?.taskId)
      .map((task) => task.taskId),
    workerTaskIds: current?.workerTaskIds.filter((id) => ids.has(id)) ?? [],
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
    workerTaskIds: current.workerTaskIds.filter((id) => id !== taskId),
  };
  all[key] = next;
  writeAll(all);
  return next;
}

export function markWorkerTask(key: string, taskId: string): void {
  const all = readAll();
  const current = all[key];
  if (!current || current.workerTaskIds.includes(taskId)) return;
  all[key] = { ...current, workerTaskIds: [...current.workerTaskIds, taskId] };
  writeAll(all);
}

export function isProjectWorkerTask(key: string, taskId: string): boolean {
  return readAll()[key]?.workerTaskIds.includes(taskId) ?? false;
}
