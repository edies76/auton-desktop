import { WakeEventRow } from "./WakeEventRow.js";
import type { ToolCallBlockRenderContext } from "@/ToolCallBlocks/shared.js";

type RenderToolCall = ToolCallBlockRenderContext["toolCallNode"]["toolCall"];

/**
 * El orquestador preguntó y espera respuesta (`SendMessage` con
 * `waitingForAnswer`). En el hilo eso no es una tarjeta de tool: es una fila
 * centrada de pregunta, igual que el cierre y el latido.
 */
export function isWaitingQuestionToolCall(toolCall: RenderToolCall): boolean {
  const name = toolCall.toolName ?? toolCall.kind;
  if (name !== "SendMessage") return false;
  const input = toolCall.input;
  return typeof input === "object" && input !== null && (input as { waitingForAnswer?: unknown }).waitingForAnswer === true;
}

export function QuestionWakeBlock(context: ToolCallBlockRenderContext) {
  const { toolCall } = context.toolCallNode;
  const input = (toolCall.input ?? {}) as { message?: unknown; summary?: unknown };
  const summary = typeof input.summary === "string" ? input.summary : "necesita una decisión";
  const message = typeof input.message === "string" ? input.message : undefined;
  const respond = context.onRespondToQuestion;

  return (
    <WakeEventRow
      kind="question"
      workerName="Orquestador"
      title={summary}
      {...(message ? { detail: message } : {})}
      {...(respond && message
        ? { actionLabel: "Responder", onAction: () => respond({ message }) }
        : {})}
    />
  );
}
