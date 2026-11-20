import { describe, expect, it, vi } from "vitest";
import { createRootTraceContext, createSessionId, createTurnId } from "@zcode/contracts";
import { autonNotificationRegistryFor } from "@zcode/shared/auton-notifications";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { autonNotificationsHandler } from "../src/auton/notifications-handler.js";
import { resetAutonWakeWindow } from "../src/auton/wake.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function recordingModel(requests: unknown[]) {
  return {
    generateText: vi.fn(async (request: { messages?: unknown[] }) => {
      requests.push(request.messages ?? []);
      return {
        finishReason: "stop" as const,
        providerMetadata: undefined,
        text: "listo",
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
    }),
  };
}

/**
 * Las dos rutas reales (worker y agente externo) encolan notificaciones para
 * lectura y despiertan un turno genérico del orquestador: el contenido viaja
 * solo por AutonNotifications, y varios avisos seguidos producen un solo
 * despertar (coalescencia).
 */
describe("canales de notificación del orquestador sobre el runtime real", () => {
  it("las dos rutas encolan, despiertan sin contenido y la lectura real las marca", async () => {
    const sessionId = createSessionId("auton-notification-channels");
    const requests: unknown[] = [];
    const runtime = createTestAgentRuntime(
      sessionId,
      { mode: "build" },
      {
        eventStore: createTestSessionEventStore(),
        modelAdapter: recordingModel(requests) as never,
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

    await vi.waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(1), { timeout: 5_000 });
    const wakeTurns = requests.length;

    // El despertar es una guía genérica: el contenido del worker y del agente
    // externo NO viaja en el turno; solo se lee con AutonNotifications.
    const wakePayload = JSON.stringify(requests);
    expect(wakePayload).toContain("avisos sin leer");
    expect(wakePayload).not.toContain("voy por el CSS");
    expect(wakePayload).not.toContain("documentación terminó su revisión");

    const workerUnread = registry.unread("worker");
    const externalUnread = registry.unread("external");
    expect(workerUnread).toHaveLength(1);
    expect(workerUnread[0]?.text).toContain("voy por el CSS");
    expect(workerUnread[0]?.origin).toBe("auton-worker");
    expect(externalUnread).toHaveLength(1);
    expect(externalUnread[0]?.text).toContain("documentación terminó");
    expect(externalUnread[0]?.origin).toBe("Sesión de documentación");

    // Coalescencia: un tercer aviso dentro de la ventana no abre otro turno.
    runtime.enqueueSubagentMessage({
      responseId: "response-2",
      agentId: "agent_1",
      agentType: "auton-worker",
      childSessionId: createSessionId("child_1"),
      childToolCallId: "tool_child_2",
      summary: "sigo",
      message: "otra sección lista",
      traceContext: trace,
    } as never);
    await wait(80);
    expect(requests.length).toBe(wakeTurns);
    expect(registry.unread("worker")).toHaveLength(2);

    const emitEvent = vi.fn(async () => undefined);
    const context = {
      sessionId,
      turnId: createTurnId("turn-read-notifications"),
      traceId: "trace-read",
      emitEvent,
    } as never;

    const first = await autonNotificationsHandler({ channel: "all" }, context);
    expect(first.read).toHaveLength(3);
    expect(first.read.map((item) => item.channel)).toEqual(["worker", "external", "worker"]);
    expect(first.read[0]?.text).toBe("voy por el CSS, faltan dos secciones");
    expect(first.read[1]?.text).toBe("la sesión de documentación terminó su revisión");
    expect(first.read[2]?.text).toBe("otra sección lista");
    expect(first.read.every((item) => typeof item.readAt === "number")).toBe(true);
    expect(first.summaries).toEqual([
      { channel: "worker", unread: 0, total: 2 },
      { channel: "external", unread: 0, total: 1 },
    ]);
    expect(emitEvent).toHaveBeenCalledTimes(1);

    // Segunda lectura no devuelve nada y no añade turnos.
    const turnsAfterRead = requests.length;
    const second = await autonNotificationsHandler({ channel: "all" }, context);
    expect(second.read).toEqual([]);
    await wait(20);
    expect(requests.length).toBe(turnsAfterRead);
  }, 20_000);

  it("pasada la ventana, el siguiente aviso vuelve a despertar", async () => {
    const sessionId = createSessionId("auton-wake-window");
    const requests: unknown[] = [];
    const runtime = createTestAgentRuntime(
      sessionId,
      { mode: "build" },
      {
        eventStore: createTestSessionEventStore(),
        modelAdapter: recordingModel(requests) as never,
      },
    );
    const trace = createRootTraceContext({
      sessionId,
      turnId: createTurnId("turn-wake-window"),
    });
    const send = (message: string, index: number) =>
      runtime.enqueueSubagentMessage({
        responseId: `response-${index}`,
        agentId: "agent_1",
        agentType: "auton-worker",
        childSessionId: createSessionId("child_window"),
        childToolCallId: `tool_child_${index}`,
        summary: "recap",
        message,
        traceContext: trace,
      } as never);

    send("avance 1", 1);
    await vi.waitFor(() => expect(requests.length).toBe(1), { timeout: 5_000 });
    send("avance 2", 2);
    await wait(80);
    expect(requests.length).toBe(1);

    resetAutonWakeWindow(String(sessionId));
    send("avance 3", 3);
    await vi.waitFor(() => expect(requests.length).toBe(2), { timeout: 5_000 });
  }, 20_000);
});
