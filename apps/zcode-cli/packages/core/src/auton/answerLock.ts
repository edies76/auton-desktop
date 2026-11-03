// ============================================================
// Candado de respuesta — lo pone el orquestador, no una guardia global
// ============================================================
// Cuando el orquestador manda una pregunta que el frente no puede resolver
// solo, marca el mensaje y el task queda esperando esa respuesta. El candado
// se levanta cuando llega el RespondToCoordinator del worker; nunca bloquea al
// modelo por sí solo, para que la autonomía del worker siga siendo suya.

import type { RuntimeTaskRegistry } from "../runtime-task/registry.js";

/** El orquestador marcó una decisión: el task queda esperando respuesta. */
export function markWaitingForAnswer(
  registry: RuntimeTaskRegistry,
  taskId: string,
  requiresAnswer: boolean | undefined,
): void {
  if (!requiresAnswer) return;
  registry.update(taskId, (current) => ({ ...current, waitingForAnswer: true }));
}

/** El worker contestó: el candado que puso el orquestador se levanta. */
export function clearWaitingForAnswer(registry: RuntimeTaskRegistry, taskId: string): boolean {
  const task = registry.get(taskId);
  if (!task?.waitingForAnswer) return false;
  registry.update(taskId, (current) => ({ ...current, waitingForAnswer: false }));
  return true;
}

/** Lo que el worker ve cuando el mensaje trae candado. */
export const ANSWER_REQUIRED_HEADER = [
  "DECISIÓN REQUERIDA POR EL ORQUESTADOR.",
  "No sigas con el encargo hasta responder esto con RespondToCoordinator.",
].join("\n");

export function isAnswerRequired(text: string): boolean {
  return text.startsWith("DECISIÓN REQUERIDA POR EL ORQUESTADOR.");
}
