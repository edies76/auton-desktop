import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionId } from "@zcode/contracts";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { createToolRegistry } from "../src/tool/registry.js";
import { registerBuiltInTools } from "../src/tool/handlers/index.js";
import { createCoordinatorResponsePort } from "../src/subagent/coordinator-response.js";
import { createSubagentMessageSink } from "../src/subagent/message-steering.js";
import { InMemoryRuntimeTaskRegistry } from "../src/runtime-task/registry.js";
import { createRootTraceContext } from "@zcode/contracts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  delete process.env.AUTON_HEARTBEAT_MS;
});

/**
 * Criterio 1 completo sobre el runtime real: despacho por la tool Agent, turno
 * abierto, pregunta del worker y latido como eventos (no mensajes del humano) y
 * cierre del último canal que libera el turno.
 */
describe("turno vivo y canal rápido sobre una sesión real", () => {
  it("despacha, espera, recibe la pregunta y el latido como eventos, y cierra al terminar el worker", async () => {
    process.env.AUTON_HEARTBEAT_MS = "250";

    const sessionId = createSessionId("auton-real-session");
    const registry = createToolRegistry();
    registerBuiltInTools(registry, {});
    const runtimeTaskRegistry = new InMemoryRuntimeTaskRegistry();

    let workerStarted = false;
    let workerFinished = false;
    let workerDispatched = false;
    const seenRequests: string[] = [];

    const modelAdapter = {
      async generateText(request: { messages?: Array<{ role: string; content: unknown }> }) {
        const text = JSON.stringify(request.messages ?? []);
        seenRequests.push(text);

        // El worker: tarda lo suficiente para que el turno del orquestador espere.
        if (text.includes("escribe index.html")) {
          if (!workerStarted) {
            workerStarted = true;
            await wait(1500);
            workerFinished = true;
          }
          return {
            finishReason: "stop" as const,
            providerMetadata: undefined,
            text: "index.html listo",
            toolCalls: [],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        }

        // El orquestador: primero despacha; después cierra su respuesta.
        if (!text.includes("index.html listo")) {
          if (!workerDispatched) {
            workerDispatched = true;
            return {
              finishReason: "tool-calls" as const,
              providerMetadata: undefined,
              text: "",
              toolCalls: [
                {
                  id: "agent-1",
                  name: "Agent",
                  input: {
                    description: "landing",
                    prompt: "escribe index.html",
                    subagent_type: "auton-worker",
                    worker_mode: "subagent",
                    run_in_background: true,
                    effort: "minimal",
                  },
                },
              ],
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          }
        }

        return {
          finishReason: "stop" as const,
          providerMetadata: undefined,
          text: "sigo pendiente",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      },
    } as never;

    const runtime = createTestAgentRuntime(
      sessionId,
      { mode: "yolo" },
      {
        eventStore: createTestSessionEventStore(),
        modelAdapter,
        toolRegistry: registry,
        runtimeTaskRegistry,
      },
    );

    const notifications: string[] = [];
    const originalEnqueue = runtime.enqueueBackgroundTaskNotification.bind(runtime);
    vi.spyOn(runtime, "enqueueBackgroundTaskNotification").mockImplementation((notification) => {
      notifications.push(notification.text);
      return originalEnqueue(notification);
    });

    let settled = false;
    const turn = runtime.executeTurn("lanza la landing").then(() => {
      settled = true;
    });

    // 1) El worker arranca y el turno cierra: el humano puede escribir.
    const startedDeadline = Date.now() + 5_000;
    while (!workerStarted && Date.now() < startedDeadline) await wait(50);
    expect(workerStarted).toBe(true);
    const settledDeadline = Date.now() + 2_000;
    while (!settled && Date.now() < settledDeadline) await wait(25);
    expect(settled).toBe(true);

    const running = Object.values(runtimeTaskRegistry.all()).find(
      (task) => task.status === "running" && task.agentType === "auton-worker",
    );
    expect(running).toBeDefined();

    // 2) El worker publica a mitad de encargo: entra como evento del worker.
    const port = createCoordinatorResponsePort({
      agentId: String(running?.agentId),
      agentType: "auton-worker",
      childSessionId: sessionId,
      enqueue: (input) => runtime.enqueueSubagentMessage(input),
    });
    const response = port.respond({
      childToolCallId: "child-tool-1",
      summary: "duda",
      message: "¿uso la paleta nueva?",
      trace: createRootTraceContext({ sessionId, turnId: "turn-real" as never }),
    } as never);
    expect(response.status).toBe("success");

    // 3) El latido sale a su umbral (250 ms en esta prueba) como evento de sistema.
    await wait(600);
    expect(notifications.some((text) => text.includes("[Auton]"))).toBe(true);
    expect(settled).toBe(true);

    // 4) Al cerrar el último canal, el turno se libera.
    await turn;
    expect(settled).toBe(true);
    const finishedDeadline = Date.now() + 3_000;
    while (!workerFinished && Date.now() < finishedDeadline) await wait(25);
    expect(workerFinished).toBe(true);
    const idleDeadline = Date.now() + 3_000;
    while (
      Object.values(runtimeTaskRegistry.all()).some((task) => task.status === "running") &&
      Date.now() < idleDeadline
    ) {
      await wait(25);
    }
    expect(Object.values(runtimeTaskRegistry.all()).some((task) => task.status === "running")).toBe(false);

    // 5) La pregunta del worker llega al orquestador como evento envuelto, nunca
    //    como un mensaje escrito por el humano.
    await runtime.executeTurn("sigue");
    const delivered = seenRequests.filter((text) => text.includes("¿uso la paleta nueva?"));
    expect(delivered.length).toBeGreaterThan(0);
    expect(delivered.every((text) => text.includes("<subagent-message>"))).toBe(true);
  }, 20_000);

  it("el orquestador instruye al worker en curso y el worker la recibe", async () => {
    const sessionId = createSessionId("auton-fast-child");
    let turnActive: () => void = () => {};
    const active = new Promise<void>((resolve) => {
      turnActive = resolve;
    });
    let call = 0;
    const requests: Array<Array<{ role: string; content: unknown }>> = [];

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
            toolCalls: [{ id: "ping", name: "Ping", input: {} }],
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
      { eventStore: createTestSessionEventStore(), modelAdapter, toolRegistry: registry },
    );

    const sink = createSubagentMessageSink(child, {
      traceContext: createRootTraceContext({
        sessionId: createSessionId("auton-fast-parent"),
        turnId: "turn-fast" as never,
      }),
    });

    const turn = child.executeTurn("trabaja en la landing");
    await active;
    await sink.send({
      id: "msg-1",
      message: "usa la paleta nueva y no toques el header",
      summary: "instrucción",
      queuedAt: new Date(),
    });
    await turn;

    const received = requests
      .flat()
      .map((message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content)))
      .filter((text) => text.includes("usa la paleta nueva y no toques el header"));
    expect(received.length).toBeGreaterThan(0);
  }, 20_000);
});
