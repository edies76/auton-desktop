// ============================================================
// Auton Notifications Tool Handler
// ============================================================
// El orquestador decide cuándo leer. Las dos rutas reales (mensajes de workers
// y avisos de agentes externos/otras sesiones) solo encolan notificaciones; esta
// operación devuelve el contenido y marca leído. Ninguna otra vía lo entrega.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SessionEventType } from "@zcode/contracts";
import {
  AUTON_CHANNELS,
  autonNotificationRegistryFor,
  type AutonChannel,
} from "@zcode/shared/auton-notifications";
import type { ToolEntry, ToolExecutionContext } from "../tool/types.js";

export const AUTON_NOTIFICATIONS_TOOL_NAME = "AutonNotifications";
const MAX_OUTPUT_BYTES = 60_000;

export const AutonNotificationsInputSchema = z.object({
  channel: z.enum(["worker", "external", "all"]).default("all"),
});
export type AutonNotificationsInput = z.infer<typeof AutonNotificationsInputSchema>;

export const AutonNotificationsOutputSchema = z.object({
  read: z.array(
    z.object({
      id: z.string(),
      channel: z.enum(AUTON_CHANNELS),
      origin: z.string(),
      text: z.string(),
      at: z.number(),
      readAt: z.number(),
    }),
  ),
  summaries: z.array(
    z.object({
      channel: z.enum(AUTON_CHANNELS),
      unread: z.number(),
      total: z.number(),
    }),
  ),
});
export type AutonNotificationsOutput = z.infer<typeof AutonNotificationsOutputSchema>;

export async function autonNotificationsHandler(
  input: AutonNotificationsInput,
  context: ToolExecutionContext,
): Promise<AutonNotificationsOutput> {
  const registry = autonNotificationRegistryFor(String(context.sessionId));
  const channel: AutonChannel | undefined =
    input.channel === "all" ? undefined : input.channel;
  const read = registry.read(channel);
  if (read.length > 0 && context.emitEvent) {
    await context.emitEvent({
      id: randomUUID() as never,
      sessionId: context.sessionId,
      turnId: context.turnId,
      type: SessionEventType.AutonNotificationRead,
      timestamp: new Date(),
      traceId: context.traceId,
      sequenceNumber: 0,
      payload: {
        notificationIds: read.map((notification) => notification.id),
        ...(channel ? { channel } : {}),
        readAt: read[0]!.readAt ?? Date.now(),
      },
    });
  }
  return {
    read: read.map((notification) => ({
      id: notification.id,
      channel: notification.channel,
      origin: notification.origin,
      text: notification.text,
      at: notification.at,
      readAt: notification.readAt ?? Date.now(),
    })),
    summaries: registry.summaries().map((summary) => ({ ...summary })),
  };
}

const AutonNotificationsInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    channel: {
      type: "string",
      enum: ["worker", "external", "all"],
      description:
        "Canal a leer: worker (mensajes de workers/subagentes), external (agentes externos/otras sesiones) o all. Por defecto all.",
    },
  },
} as const;

const AutonNotificationsOutputJsonSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    read: { type: "array", items: { type: "object", additionalProperties: true } },
    summaries: { type: "array", items: { type: "object", additionalProperties: true } },
  },
} as const;

export const autonNotificationsToolEntry: ToolEntry = {
  capability:
    "Read the orchestrator's pending notifications from the two channels (workers and external agents) and mark them read",
  metadata: {
    // El orquestador necesita poder leer avisos desde el primer turno.
    name: AUTON_NOTIFICATIONS_TOOL_NAME,
    searchHint: "orchestrator notifications, worker messages, external agent messages",
    description: `Read the orchestrator's pending notifications and mark them read.

Notifications arrive from two channels and never interrupt you by themselves:
- \`worker\`: messages from workers/subagents (their reports, questions and closures).
- \`external\`: notices from external agents or other sessions.

Use \`channel: "worker"\`, \`channel: "external"\` or \`channel: "all"\` (default). The tool returns the content you had pending and clears its unread counter; a second read returns nothing new. Unread notifications stay available; nothing else delivers their content.`,
    readOnly: true,
    destructive: false,
    concurrentSafe: true,
    timeoutMs: 15000,
    maxOutputBytes: MAX_OUTPUT_BYTES,
    sideEffectScope: "session",
    riskLevel: "low",
    needsApproval: false,
  },
  handler: autonNotificationsHandler as never,
  inputSchema: AutonNotificationsInputJsonSchema,
  outputSchema: AutonNotificationsOutputJsonSchema,
  runtimeInputSchema: AutonNotificationsInputSchema,
  runtimeOutputSchema: AutonNotificationsOutputSchema,
  permission: {
    permission: "auton.notifications",
    reason: "AutonNotifications only reads and marks the orchestrator's own notifications",
    riskLevel: "low",
    sideEffectScope: "session",
    needsApproval: false,
    patternSources: ["toolName"],
    alwaysAllowPatternSources: ["toolName"],
    denyPriority: "beforeAsk",
  },
  resultBudget: {
    maxInlineBytes: MAX_OUTPUT_BYTES,
    maxModelBytes: MAX_OUTPUT_BYTES,
    strategy: "truncate",
    preview: { maxBytes: MAX_OUTPUT_BYTES, direction: "head" },
  },
  timeout: {
    defaultMs: 15000,
    maxMs: 15000,
    allowCallOverride: false,
  },
  cancellation: {
    supported: true,
    cleanup: "none",
    userVisibleMessage: "AutonNotifications was cancelled before reading the notifications",
  },
  trace: {
    required: true,
    propagateToAdapters: false,
    recordInput: "summary",
    recordOutput: "summary",
  },
};
