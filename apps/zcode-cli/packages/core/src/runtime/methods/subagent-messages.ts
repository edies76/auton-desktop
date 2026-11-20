import { createMessageId, traceContextToLogContext } from "../deps.js";
import type { MessageId } from "../deps.js";
import { createRuntimeCommandId, type SubagentMessageRuntimeCommand } from "../command-queue.js";
import type { AgentRuntimeInternal } from "../internal.js";
import type { EnqueueSubagentMessageInput } from "../types.js";
import { runtimeInputMetadata } from "../../agent/runtime-input-presentation.js";
import { escapeXml } from "../../runtime-task/notification.js";
import { clearWaitingForAnswer } from "../../auton/answerLock.js";
import { autonNotificationRegistryFor } from "@zcode/shared/auton-notifications";
import { SessionEventType } from "@zcode/contracts";

export function formatSubagentMessage(input: {
  agentId: string;
  agentType: string;
  summary: string;
  message: string;
}): string {
  return [
    "<subagent-message>",
    `<agent-id>${escapeXml(input.agentId)}</agent-id>`,
    `<agent-type>${escapeXml(input.agentType)}</agent-type>`,
    `<summary>${escapeXml(input.summary)}</summary>`,
    `<message>${escapeXml(input.message)}</message>`,
    "</subagent-message>",
  ].join("\n");
}

export function enqueueSubagentMessage(
  this: AgentRuntimeInternal,
  input: EnqueueSubagentMessageInput,
): undefined {
  const branchGeneration =
    this.runtimeTaskRegistry.get(input.agentId)?.branchGeneration ?? this.branchGeneration;  if (branchGeneration !== this.branchGeneration) {
    this.logger?.debug("Dropped stale-branch subagent response", {
      ...traceContextToLogContext(input.traceContext),
      agentId: input.agentId,
      branchGeneration,
      currentBranchGeneration: this.branchGeneration,
      event: "subagent.response.stale_branch_dropped",
      module: "core.runtime",
      responseId: input.responseId,
    });
    return undefined;
  }
  const command = {
    branchGeneration,
    responseId: input.responseId,
    agentId: input.agentId,
    agentType: input.agentType,
    childSessionId: input.childSessionId,
    childToolCallId: input.childToolCallId,
    ...(input.parentToolCallId ? { parentToolCallId: input.parentToolCallId } : {}),
    summary: input.summary,
    messageLength: input.message.length,
    traceContext: input.traceContext,
    createdAt: new Date(),
    id: createRuntimeCommandId(),
    mode: "subagent-message" as const,
    priority: "next" as const,
    source: "subagent_message" as const,
    text: formatSubagentMessage(input),
  } satisfies SubagentMessageRuntimeCommand;

  this.logger?.debug("Subagent response queued as notification", {
    ...traceContextToLogContext(command.traceContext),
    agentId: command.agentId,
    commandId: command.id,
    event: "subagent.response.notification_enqueued",
    messageLength: command.messageLength,
    module: "core.runtime",
    responseId: command.responseId,
    summary: command.summary.slice(0, 200),
  });
  // Canal de workers: el mensaje entra como notificación encolada, no como
  // mensaje del humano ni como turno. El orquestador decide leerlo.
  const registry = autonNotificationRegistryFor(String(this.sessionId));
  const notification = registry.enqueue({
    channel: "worker",
    origin: input.agentType || input.agentId,
    text: input.message,
    meta: {
      agentId: input.agentId,
      childSessionId: input.childSessionId,
      ...(input.summary ? { summary: input.summary } : {}),
    },
  });
  void this.appendEvent(
    this.createEvent(
      SessionEventType.AutonNotificationQueued,
      {
        notificationId: notification.id,
        channel: notification.channel,
        origin: notification.origin,
        text: notification.text,
        at: notification.at,
      },
      input.traceContext,
    ),
    input.traceContext,
  ).catch((error) => {
    this.logger?.warn("Failed to publish auton notification event", {
      ...traceContextToLogContext(input.traceContext),
      errorMessage: error instanceof Error ? error.message : String(error),
      event: "auton.notification.publish_failed",
      module: "core.runtime",
      channel: "worker",
    });
  });
  // La fila del worker en el hilo se actualiza con el mismo hecho: es su señal
  // de vida (silencia el latido y baja la pregunta pendiente en la proyección).
  void this.appendEvent(
    this.createEvent(
      SessionEventType.SubagentMessage,
      {
        agentId: input.agentId,
        agentType: input.agentType,
        childSessionId: input.childSessionId,
        ...(input.parentToolCallId ? { parentToolCallId: input.parentToolCallId } : {}),
        summaryText: `\n${input.message.trim() || input.summary?.trim() || ""}`,
      },
      input.traceContext,
    ),
    input.traceContext,
  ).catch((error) => {
    this.logger?.warn("Failed to publish subagent message event", {
      ...traceContextToLogContext(input.traceContext),
      errorMessage: error instanceof Error ? error.message : String(error),
      event: "subagent.message.publish_failed",
      module: "core.runtime",
      agentId: input.agentId,
    });
  });
  // El worker respondió: la pregunta que el orquestador marcó como decisión
  // deja de estar pendiente. El candado era suyo y él lo levanta al recibir.
  clearWaitingForAnswer(this.runtimeTaskRegistry, input.agentId);
  return undefined;
}

export async function persistSubagentMessageCommand(
  this: AgentRuntimeInternal,
  command: SubagentMessageRuntimeCommand,
  midTurn = false,
): Promise<MessageId> {
  await this.ensureContextInitialized(command.traceContext);
  const messageID = createMessageId();
  const inputPresentation = midTurn ? "subagent_reply_steer" : "subagent_reply";
  this.messageHistory.addUser(command.text, runtimeInputMetadata(inputPresentation));
  await this.persistSyntheticUserNoticeForSession({
    messageID,
    sessionId: this.sessionId,
    source: "subagent_message",
    text: command.text,
    traceContext: command.traceContext,
    visibility: "model-only",
    metadata: {
      inputPresentation,
      subagentMessage: {
        responseId: command.responseId,
        agentId: command.agentId,
        agentType: command.agentType,
        childSessionId: command.childSessionId,
        childToolCallId: command.childToolCallId,
        ...(command.parentToolCallId ? { parentToolCallId: command.parentToolCallId } : {}),
      },
    },
  });
  return messageID;
}
