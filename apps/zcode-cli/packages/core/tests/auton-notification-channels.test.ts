import { describe, expect, it, vi } from "vitest";
import { createRootTraceContext, createSessionId, createTurnId } from "@zcode/contracts";
import { autonNotificationRegistryFor } from "@zcode/shared/auton-notifications";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { autonNotificationsHandler } from "../src/auton/notifications-handler.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Las dos rutas reales (worker y agente externo) encolan notificaciones, no
 * arrancan turno ni inyectan mensaje del humano; la operación real de lectura
 * devuelve el contenido y marca leído.
 */
describe("canales de notificación del orquestador sobre el runtime real", () => {
  it("las dos rutas encolan, no arrancan turno y la lectura real las marca", async () => {
    const sessionId = createSessionId("auton-notification-channels");
    const generateText = vi.fn(async () => ({
      finishReason: "stop" as const,
      providerMetadata: undefined,
      text: "listo",
      toolCalls: [],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    }));
    const runtime = createTestAgentRuntime(
      sessionId,
      { mode: "build" },
      {
        eventStore: createTestSessionEventStore(),
        modelAdapter: { generateText } as never,
      },
    );
    const registry = autonNotificationRegistryFor(String(sessionId));
    const trace = createRootTraceContext({
      sessionId,
      turnId: createTurnId("turn-notification-channels"),
    });

    // Ruta 1: mensaje de worker por su camino de producción.
    runtime.enqueueSubagentMessage({
      responseId: "response-1",
      agentId: "agent_1",
      agentType: "auton-worker",
      childSessionId: createSessionId("child_1"),
      childToolCallId: "tool_child_1",
      summary: "avance",
      message: "voy por el CSS, faltan dos secciones",
      traceContext: trace,
    } as never);

    // Ruta 2: aviso de otra sesión/agente externo por su camino de producción.
    runtime.enqueueBackgroundTaskNotification({
      text: "la sesión de documentación terminó su revisión",
      taskId: "task-external-1",
      originMeta: {
        backgroundSource: "workflow",
        title: "Sesión de documentación",
        workId: "work-external-1",
      },
      traceContext: trace,
    });

    await wait(60);
    // Ninguna de las dos arrancó un turno por sí sola.
    expect(generateText).not.toHaveBeenCalled();

    const workerUnread = registry.unread("worker");
    const externalUnread = registry.unread("external");
    expect(workerUnread).toHaveLength(1);
    expect(workerUnread[0]?.text).toContain("voy por el CSS");
    expect(workerUnread[0]?.origin).toBe("auton-worker");
    expect(externalUnread).toHaveLength(1);
    expect(externalUnread[0]?.text).toContain("documentación terminó");
    expect(externalUnread[0]?.origin).toBe("Sesión de documentación");

    const emitEvent = vi.fn(async () => undefined);
    const context = {
      sessionId,
      turnId: createTurnId("turn-read-notifications"),
      traceId: "trace-read",
      emitEvent,
    } as never;

    const first = await autonNotificationsHandler({ channel: "all" }, context);
    expect(first.read).toHaveLength(2);
    expect(first.read.map((item) => item.channel)).toEqual(["worker", "external"]);
    expect(first.read.map((item) => item.text)).toEqual([
      "voy por el CSS, faltan dos secciones",
      "la sesión de documentación terminó su revisión",
    ]);
    expect(first.read.every((item) => typeof item.readAt === "number")).toBe(true);
    expect(first.summaries).toEqual([
      { channel: "worker", unread: 0, total: 1 },
      { channel: "external", unread: 0, total: 1 },
    ]);
    expect(emitEvent).toHaveBeenCalledTimes(1);

    // Segunda lectura no devuelve nada.
    const second = await autonNotificationsHandler({ channel: "all" }, context);
    expect(second.read).toEqual([]);
    await wait(20);
    expect(generateText).not.toHaveBeenCalled();
  }, 20_000);
});
