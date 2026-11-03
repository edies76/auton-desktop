import { TID_V4_COMPOSER_INPUT } from "@zcode/shared/test-ids";

/**
 * Acción de "Responder" en la fila de pregunta: lleva el foco al compositor,
 * que es donde el humano responde. Es el mismo compositor del hilo, no un
 * formulario nuevo.
 */
export function createQuestionRespondHandler(
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): () => void {
  return () => {
    const composer = doc?.querySelector<HTMLElement>(`[data-testid="${TID_V4_COMPOSER_INPUT}"]`);
    composer?.focus();
  };
}
