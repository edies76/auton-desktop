import { describe, expect, it } from "vitest";
import {
  createChildTraceContext,
  createRootTraceContext,
  createSessionId,
  createTurnId,
} from "@zcode/contracts";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { createCoordinatorResponsePort } from "../src/subagent/coordinator-response.js";
import { createSubagentMessageSink } from "../src/subagent/message-steering.js";
import { createToolRegistry } from "../src/tool/registry.js";
import { autonNotificationRegistryFor } from "@zcode/shared/auton-notifications";
import { autonNotificationsHandler } from "../src/auton/notifications-handler.js";

/** Modelo falso que guarda lo que recibe y cierra el turno. */
function recordingModel() {
  const requests: Array<Array<{ role: string; content: unknown }>> = [];
  const modelAdapter = {
    async generateText(request: { messages?: Array<{ role: string; content: unknown }> }) {
      requests.push(request.messages ?? []);
      return {
        finishReason: "stop" as const,
        providerMetadata: undefined,
        text: "listo",
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
    },
  } as never;
  return { modelAdapter, requests };
}

function textOf(message: { content: unknown }): string {
  if (typeof message.content === "string") return message.content;
  return JSON.stringify(message.content);
}

describe("canal rápido sobre el runtime real", () => {
  it("el worker publica a mitad de encargo y el orquestador lo recibe como evento, no como mensaje del humano", async () => {
    const sessionId = createSessionId("auton-fast-channel-parent");
    const { modelAdapter, requests } = recordingModel();
    const parent = createTestAgentRuntime(
      sessionId,
      { mode: "build" },
      { eventStore: createTestSessionEventStore(), modelAdapter },
    );

    // Mismo cableado que usa el runtime: el port del worker encola en el padre.
    const port = createCoordinatorResponsePort({
      agentId: "agent_fast",
      agentType: "auton-worker",
      childSessionId: createSessionId("child_fast"),
      enqueue: (input) => parent.enqueueSubagentMessage(input),
    });

    const trace = createRootTraceContext({
      sessionId,
      turnId: createTurnId("turn-fast-parent"),
    });

    const result = port.respond({
      childToolCallId: "tool_child_1",
      summary: "avance",
      message: "voy por el CSS, faltan 2 secciones",
      trace,
    } as never);

    expect(result.status).toBe("success");

    // El mensaje del worker queda como notificación encolada en su canal; no
    // arranca turno ni entra como mensaje del humano.
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(requests).toHaveLength(0);
    const registry = autonNotificationRegistryFor(String(sessionId));
    const unread = registry.unread("worker");
    expect(unread).toHaveLength(1);
    expect(unread[0]?.origin).toBe("auton-worker");
    expect(unread[0]?.text).toContain("voy por el CSS");

    // La operación real de lectura lo entrega y lo marca leído.
    const read = await autonNotificationsHandler(
      { channel: "worker" },
      {
        sessionId,
        turnId: createTurnId("turn-read-fast"),
        traceId: "trace-read-fast",
        emitEvent: async () => undefined,
      } as never,
    );
    expect(read.read.map((item) => item.text)).toEqual([
      "voy por el CSS, faltan 2 secciones",
    ]);
    expect(registry.unread("worker")).toHaveLength(0);
  }, 20_000);

  it("el orquestador instruye al worker en curso y el worker la recibe", async () => {
    const sessionId = createSessionId("auton-fast-channel-child");
    const requests: Array<Array<{ role: string; content: unknown }>> = [];
    let turnActive: () => void = () => {};
    const active = new Promise<void>((resolve) => {
      turnActive = resolve;
    });
    let call = 0;

    const registry = createToolRegistry();
    registry.register({
      inputSchema: {},
      metadata: {
        concurrentSafe: true,
        destructive: false,
        name: "Ping",
        needsApproval: false,
        readOnly: true,
        riskLevel: "low",
        sideEffectScope: "none",
      },
      handler: async () => ({ ok: true }),
    } as never);

    const modelAdapter = {
      async generateText(request: { messages?: Array<{ role: string; content: unknown }> }) {
        requests.push(request.messages ?? []);
        call += 1;
        if (call === 1) {
          turnActive();
          return {
            finishReason: "tool-calls" as const,
            providerMetadata: undefined,
            text: "",
            toolCalls: [{ id: "ping-1", name: "Ping", input: {} }],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        }
        return {
          finishReason: "stop" as const,
          providerMetadata: undefined,
          text: "listo",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      },
    } as never;

    const child = createTestAgentRuntime(
      sessionId,
      { mode: "build" },
      {
        eventStore: createTestSessionEventStore(),
        modelAdapter,
        toolRegistry: registry,
      },
    );

    const traceContext = createChildTraceContext({
      parent: createRootTraceContext({
        sessionId: createSessionId("auton-fast-channel-parent"),
        turnId: createTurnId("turn-fast-parent"),
      }),
      sessionId,
    });

    const sink = createSubagentMessageSink(child, { traceContext });
    const turn = child.executeTurn("trabaja en la landing");

    // El mensaje llega mientras el worker tiene el turno activo.
    await active;
    await sink.send({
      id: "msg_1",
      message: "usa la paleta nueva y no toques el header",
      summary: "instrucción",
      queuedAt: new Date(),
    });

    await turn;

    const received = requests
      .flat()
      .map(textOf)
      .filter((text) => text.includes("usa la paleta nueva y no toques el header"));
    expect(received.length).toBeGreaterThan(0);
  }, 20_000);
});
