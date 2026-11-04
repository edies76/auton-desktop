import { describe, expect, it, vi } from "vitest";
import { stat } from "node:fs/promises";
import {
  createRootTraceContext,
  createSessionId,
  createTurnId,
  type ModelResult,
} from "@zcode/contracts";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { createCoordinatorResponsePort } from "../src/subagent/coordinator-response.js";

interface RecordedRequest {
  tools: string[];
  messages: unknown[];
}

/**
 * Arranque sin escritorio: el runtime real del núcleo, con un modelo de test,
 * despacha un worker Auton en modo sesión por la herramienta Agent. El worker
 * contesta con su propio modelo y el orquestador recibe esa salida.
 */
describe("worker de sesión por el camino real del núcleo", () => {
  it("crea el worker, recibe un encargo mínimo y devuelve su salida con el juego completo", async () => {
    const requests: RecordedRequest[] = [];
    const bashCwds: string[] = [];
    let parentCalls = 0;
    let workerCalls = 0;

    const modelAdapter = {
      async generateText(request: {
        tools?: Array<{ name: string }>;
        messages?: unknown[];
      }): Promise<ModelResult> {
        const tools = (request.tools ?? []).map((tool) => tool.name);
        requests.push({ tools, messages: request.messages ?? [] });
        const isParent = tools.includes("Agent");
        if (isParent) {
          parentCalls += 1;
          if (parentCalls === 1) {
            return {
              finishReason: "tool-calls" as const,
              providerMetadata: undefined,
              text: "",
              toolCalls: [
                {
                  id: "call_agent_1",
                  name: "Agent",
                  input: {
                    subagent_type: "auton-worker",
                    worker_mode: "session",
                    description: "mini encargo",
                    prompt: "prueba tu carpeta y di listo",
                  },
                },
              ],
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          }
          return {
            finishReason: "stop" as const,
            providerMetadata: undefined,
            text: "recibido",
            toolCalls: [],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        }
        workerCalls += 1;
        if (workerCalls === 1) {
          return {
            finishReason: "tool-calls" as const,
            providerMetadata: undefined,
            text: "",
            toolCalls: [{ id: "call_bash_1", name: "Bash", input: { command: "pwd" } }],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        }
        return {
          finishReason: "stop" as const,
          providerMetadata: undefined,
          text: "listo desde el worker",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      },
    } as never;

    const executionPort = {
      async run(request: { cwd?: string }) {
        bashCwds.push(request.cwd ?? "");
        return {
          status: "completed" as const,
          exitCode: 0,
          stdout: { text: request.cwd ?? "", bytes: 0, truncated: false },
          stderr: { text: "", bytes: 0, truncated: false },
          durationMs: 1,
          timedOut: false,
          cancelled: false,
          startedAt: new Date(),
          completedAt: new Date(),
        };
      },
    } as never;

    const sessionId = createSessionId("auton-session-worker-real");
    const parent = createTestAgentRuntime(
      sessionId,
      { mode: "build", autonWorkerMode: "session" },
      { eventStore: createTestSessionEventStore(), modelAdapter, executionPort },
    );
    const trace = createRootTraceContext({
      sessionId,
      turnId: createTurnId("turn-session-worker"),
    });

    await parent.executeTurn("lanza un worker para el mini encargo", undefined, {
      traceContext: trace,
    });

    const parentRequests = requests.filter((request) => request.tools.includes("Agent"));
    const workerRequests = requests.filter((request) => !request.tools.includes("Agent"));

    expect(parentRequests.length).toBeGreaterThanOrEqual(2);
    expect(workerRequests.length).toBeGreaterThanOrEqual(1);

    // El worker arrancó de verdad: recibió su encargo.
    const workerPayload = JSON.stringify(workerRequests[0]?.messages ?? []);
    expect(workerPayload).toContain("prueba tu carpeta y di listo");

    // Su juego de herramientas es el del runtime sin el despacho de subagentes.
    const workerTools = new Set(workerRequests[0]?.tools ?? []);
    const parentTools = new Set(parentRequests[0]?.tools ?? []);
    expect(workerTools.size).toBeGreaterThan(5);
    expect(workerTools.has("Read")).toBe(true);
    expect(workerTools.has("Agent")).toBe(false);
    const missing = [...parentTools].filter(
      (tool) => tool !== "Agent" && tool !== "Task" && !workerTools.has(tool),
    );
    // Faltan solo los controles de orquestación (repartir o mensajear a otros
    // agentes) y el modo plan: el worker ejecuta, no dirige. Todo lo demás es
    // el mismo juego que ve el orquestador.
    expect(missing.sort()).toEqual(["EnterPlanMode", "ExitPlanMode", "SendMessage"]);

    // La salida real del worker volvió al orquestador.
    const parentPayload = JSON.stringify(parentRequests.at(-1)?.messages ?? []);
    expect(parentPayload).toContain("listo desde el worker");

    // El registro del runtime lo confirma: tipo de sesión de worker, carpeta
    // propia y marca de aislamiento. No basta con los nombres de herramientas.
    const registry = (
      parent as unknown as {
        runtimeTaskRegistry: {
          all(): Record<
            string,
            {
              agentType: string;
              childSessionId?: string;
              isolatedWorkspace?: boolean;
              workingDirectory?: string;
            }
          >;
        };
      }
    ).runtimeTaskRegistry;
    const workerTask = Object.values(registry.all()).find(
      (entry) => entry.agentType === "auton-worker",
    );
    expect(workerTask?.childSessionId).toMatch(/^sess_auton_/);
    expect(workerTask?.isolatedWorkspace).toBe(true);
    expect(workerTask?.workingDirectory?.replaceAll("\\", "/")).toContain(".auton/workers/");

    // La carpeta existe de verdad y el primer comando del worker corrió ahí.
    const workerDir = workerTask?.workingDirectory ?? "";
    expect((await stat(workerDir)).isDirectory()).toBe(true);
    const ranIn = bashCwds.map((cwd) => cwd.replaceAll("\\", "/"));
    expect(ranIn).toContain(workerDir.replaceAll("\\", "/"));
  }, 30_000);

  it("con el interruptor apagado el worker sigue siendo subagente", async () => {
    let parentCalls = 0;
    const modelAdapter = {
      async generateText(request: {
        tools?: Array<{ name: string }>;
      }): Promise<ModelResult> {
        const tools = (request.tools ?? []).map((tool) => tool.name);
        if (tools.includes("Agent")) {
          parentCalls += 1;
          if (parentCalls === 1) {
            return {
              finishReason: "tool-calls" as const,
              providerMetadata: undefined,
              text: "",
              toolCalls: [
                {
                  id: "call_agent_sub",
                  name: "Agent",
                  input: {
                    subagent_type: "auton-worker",
                    description: "encargo corto",
                    prompt: "di listo",
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
          text: "listo",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      },
    } as never;

    const sessionId = createSessionId("auton-subagent-mode");
    const parent = createTestAgentRuntime(
      sessionId,
      { mode: "build", autonWorkerMode: "subagent" },
      { eventStore: createTestSessionEventStore(), modelAdapter },
    );
    await parent.executeTurn("lanza un worker normal", undefined, {
      traceContext: createRootTraceContext({
        sessionId,
        turnId: createTurnId("turn-subagent-mode"),
      }),
    });

    const registry = (
      parent as unknown as {
        runtimeTaskRegistry: {
          all(): Record<
            string,
            { agentType: string; isolatedWorkspace?: boolean; workingDirectory?: string }
          >;
        };
      }
    ).runtimeTaskRegistry;
    const workerTask = Object.values(registry.all()).find(
      (entry) => entry.agentType === "auton-worker",
    );
    expect(workerTask).toBeTruthy();
    expect(workerTask?.isolatedWorkspace).toBeUndefined();
    expect(workerTask?.workingDirectory ?? "").not.toContain(".auton/workers/");
  }, 30_000);

  it("el orquestador detiene al worker de sesión por la vía real", async () => {
    let releaseWorker: () => void = () => {};
    const workerGate = new Promise<void>((resolve) => {
      releaseWorker = resolve;
    });
    let workerStarted = false;

    const modelAdapter = {
      async generateText(request: {
        tools?: Array<{ name: string }>;
        messages?: unknown[];
      }): Promise<ModelResult> {
        const tools = (request.tools ?? []).map((tool) => tool.name);
        if (tools.includes("Agent")) {
          if (!workerStarted) {
            return {
              finishReason: "tool-calls" as const,
              providerMetadata: undefined,
              text: "",
              toolCalls: [
                {
                  id: "call_agent_bg",
                  name: "Agent",
                  input: {
                    subagent_type: "auton-worker",
                    worker_mode: "session",
                    description: "encargo largo",
                    prompt: "trabaja sin parar",
                    run_in_background: true,
                  },
                },
              ],
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          }
          return {
            finishReason: "stop" as const,
            providerMetadata: undefined,
            text: "detenido",
            toolCalls: [],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        }
        workerStarted = true;
        await workerGate;
        return {
          finishReason: "stop" as const,
          providerMetadata: undefined,
          text: "terminé",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      },
    } as never;

    const sessionId = createSessionId("auton-session-worker-stop");
    const parent = createTestAgentRuntime(
      sessionId,
      { mode: "build", autonWorkerMode: "session" },
      { eventStore: createTestSessionEventStore(), modelAdapter },
    );
    const trace = createRootTraceContext({
      sessionId,
      turnId: createTurnId("turn-session-worker-stop"),
    });

    const turn = parent.executeTurn("lanza un worker de fondo y páralo", undefined, {
      traceContext: trace,
    });
    await vi.waitFor(() => expect(workerStarted).toBe(true), { timeout: 10_000 });

    const registry = (
      parent as unknown as { runtimeTaskRegistry: { all(): Record<string, { taskId: string }> } }
    ).runtimeTaskRegistry;
    const task = Object.values(registry.all()).find((entry) => entry.taskId.startsWith("agent_"));
    expect(task).toBeTruthy();

    // La parada entra por la vía del usuario, la misma que usa el botón del panel.
    const stopped = await parent.stopBackgroundTask(task!.taskId, {
      initiator: "user",
      traceContext: trace,
    });
    expect(stopped.ok).toBe(true);

    releaseWorker();
    await turn;
  }, 30_000);

  it("el worker de sesión responde al orquestador y levanta el candado", async () => {
    const parentRequests: unknown[][] = [];
    const parent = createTestAgentRuntime(
      createSessionId("auton-session-channel-parent"),
      { mode: "build" },
      {
        eventStore: createTestSessionEventStore(),
        modelAdapter: {
          async generateText(request: { messages?: unknown[] }): Promise<ModelResult> {
            parentRequests.push(request.messages ?? []);
            return {
              finishReason: "stop" as const,
              providerMetadata: undefined,
              text: "recibido",
              toolCalls: [],
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          },
        } as never,
      },
    );

    const agentId = "agent_channel";
    parent.runtimeTaskRegistry.register({
      taskId: agentId,
      agentId,
      agentType: "auton-worker",
      description: "canal",
      status: "running",
      startedAt: new Date(),
      type: "local_agent",
      taskType: "local_agent",
      waitingForAnswer: true,
    } as never);

    let workerCalls = 0;
    const workerSessionId = createSessionId("sess_auton_channel");
    const worker = createTestAgentRuntime(
      workerSessionId,
      { mode: "build", taskType: "auton_worker_session" },
      {
        eventStore: createTestSessionEventStore(),
        modelAdapter: {
          async generateText(): Promise<ModelResult> {
            workerCalls += 1;
            if (workerCalls === 1) {
              return {
                finishReason: "tool-calls" as const,
                providerMetadata: undefined,
                text: "",
                toolCalls: [
                  {
                    id: "call_respond",
                    name: "RespondToCoordinator",
                    input: { summary: "avance", message: "voy por el CSS" },
                  },
                ],
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              };
            }
            return {
              finishReason: "stop" as const,
              providerMetadata: undefined,
              text: "sigo",
              toolCalls: [],
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          },
        } as never,
        coordinatorResponsePort: createCoordinatorResponsePort({
          agentId,
          agentType: "auton-worker",
          childSessionId: workerSessionId,
          enqueue: (input) => parent.enqueueSubagentMessage(input),
        }) as never,
      },
    );

    // El worker de sesión tiene la herramienta y su llamada no es rechazada.
    expect(worker.getTools().map((tool) => tool.name)).toContain("RespondToCoordinator");
    await worker.executeTurn("reporta tu avance");
    await parent.executeTurn("recibe el avance");

    expect(JSON.stringify(parentRequests)).toContain("voy por el CSS");
    expect(JSON.stringify(parentRequests)).toContain("<subagent-message>");
    // El candado que puso el orquestador se levanta con la respuesta.
    expect(parent.runtimeTaskRegistry.get(agentId)?.waitingForAnswer).toBe(false);
  }, 30_000);

  it("el candado se marca por el puerto real y lo levanta la respuesta del worker", async () => {
    let releaseWorker: () => void = () => {};
    const workerGate = new Promise<void>((resolve) => {
      releaseWorker = resolve;
    });
    let workerStarted = false;
    let workerCalls = 0;

    const modelAdapter = {
      async generateText(): Promise<ModelResult> {
        workerCalls += 1;
        if (workerCalls === 1) {
          workerStarted = true;
          await workerGate;
          return {
            finishReason: "tool-calls" as const,
            providerMetadata: undefined,
            text: "",
            toolCalls: [
              {
                id: "call_respond_lock",
                name: "RespondToCoordinator",
                input: { summary: "respuesta", message: "uso la paleta nueva" },
              },
            ],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        }
        return {
          finishReason: "stop" as const,
          providerMetadata: undefined,
          text: "sigo",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      },
    } as never;

    const parentSession = createSessionId("auton-lock-parent");
    const parent = createTestAgentRuntime(
      parentSession,
      { mode: "build", autonWorkerMode: "session" },
      { eventStore: createTestSessionEventStore(), modelAdapter },
    );
    const port = (
      parent as unknown as {
        autonSessionWorkerPort?: {
          launch(request: unknown, options?: unknown): Promise<{ agentId: string }>;
          sendMessage(request: unknown): Promise<{ status: string; waitingForAnswer?: boolean }>;
          getTask(id: string): Promise<{ waitingForAnswer?: boolean } | undefined>;
        };
      }
    ).autonSessionWorkerPort;
    expect(port).toBeTruthy();

    const trace = createRootTraceContext({
      sessionId: parentSession,
      turnId: createTurnId("turn-lock-parent"),
    });
    const output = await port!.launch({
      sessionId: parentSession,
      parentToolCallId: "tool_lock",
      agentType: "auton-worker",
      description: "candado",
      prompt: "espera la decisión",
      workingDirectory: process.cwd(),
      workspaceRoot: process.cwd(),
      trace,
      runInBackground: true,
    });
    await vi.waitFor(() => expect(workerStarted).toBe(true), { timeout: 10_000 });

    const sent = await port!.sendMessage({
      sessionId: parentSession,
      parentToolCallId: "tool_lock_2",
      to: output.agentId,
      summary: "decisión",
      message: "¿uso la paleta nueva?",
      requiresAnswer: true,
      workingDirectory: process.cwd(),
      workspaceRoot: process.cwd(),
      trace,
    });
    expect(sent.status).toBe("success");
    expect(sent.waitingForAnswer).toBe(true);
    expect((await port!.getTask(output.agentId))?.waitingForAnswer).toBe(true);

    releaseWorker();
    await vi.waitFor(
      async () => expect((await port!.getTask(output.agentId))?.waitingForAnswer).toBe(false),
      { timeout: 10_000 },
    );
  }, 30_000);
});
