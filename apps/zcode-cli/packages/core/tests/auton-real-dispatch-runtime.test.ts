import { describe, expect, it } from "vitest";
import { createRootTraceContext, createSessionId } from "@zcode/contracts";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { createToolRegistry } from "../src/tool/registry.js";
import { registerBuiltInTools } from "../src/tool/handlers/index.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Camino real completo: el modelo pide `Agent` en background, el runtime lanza al
 * programador con su port real, el turno del orquestador queda abierto mientras el
 * worker vive y se libera cuando el worker termina.
 */
describe("despacho real de un programador en background", () => {
  it("el turno espera al worker lanzado por la herramienta Agent y se libera al cerrar", async () => {
    const sessionId = createSessionId("auton-real-dispatch");
    const eventStore = createTestSessionEventStore();
    const registry = createToolRegistry();
    registerBuiltInTools(registry, {});

    let modelCall = 0;
    let workerStarted = false;
    let workerFinished = false;

    const modelAdapter = {
      async generateText(request: { messages?: Array<{ role: string; content: unknown }> }) {
        modelCall += 1;
        // 1) el orquestador pide lanzar un programador en background
        if (modelCall === 1) {
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
                  run_in_background: true,
                  effort: "minimal",
                },
              },
            ],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        }
        // 2) el worker: tarda un poco para que el turno del orquestador lo espere
        if (!workerStarted) {
          workerStarted = true;
          await wait(300);
          workerFinished = true;
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

    const runtime = createTestAgentRuntime(
      sessionId,
      { mode: "yolo" },
      {
        eventStore,
        modelAdapter,
        toolRegistry: registry,
      },
    );

    let settled = false;
    const turn = runtime.executeTurn("lanza la landing").then(() => {
      settled = true;
    });

    await wait(120);
    expect(settled).toBe(false);

    await turn;
    expect(settled).toBe(true);
    expect(workerStarted).toBe(true);
    expect(workerFinished).toBe(true);
  }, 20_000);
});
