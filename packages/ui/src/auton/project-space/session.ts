/**
 * Las sesiones hijas del orquestador (`auton-worker` y subagentes) son canales
 * de trabajo, no chats del proyecto. Nunca se listan ni se editan como tarea.
 */
export function isWorkerSessionTaskId(taskId: string | null | undefined): boolean {
  return Boolean(
    taskId && (taskId.startsWith("sess_auton_") || taskId.startsWith("sess_subagent_")),
  );
}
