import { describe, expect, it, vi } from "vitest";
import { createRootTraceContext, createSessionId } from "@zcode/contracts";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { AutonLiveLoop, registerAutonLiveLoop } from "../src/auton/live-loop.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Modelo falso: responde y termina en una sola vuelta. */
function stopModel() {
  return {
    async generateText() {
      return {
        finishReason: "stop" as const,
        providerMetadata: undefined,
        text: "listo",
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
    },
  } as never;
}

/**
 * Camino real del turno: `executeTurn` en un AgentRuntime de verdad. Con un
 * canal vivo el turno no termina; el mensaje del worker reinicia el reloj; el
 * latido sale a su hora; el cierre del canal libera el turno.
 */
describe("turno vivo sobre una sesión real", () => {
  it("no cierra con trabajo vivo, reinicia con la noticia y libera al cerrar", async () => {
    const sessionId = createSessionId("auton-live-turn");
    const onHeartbeat = vi.fn();
    const testLoop = new AutonLiveLoop({ heartbeatMs: 80, onHeartbeat });
    registerAutonLiveLoop(String(sessionId), testLoop);
    testLoop.dispatch();

    const runtime = createTestAgentRuntime(
      sessionId,
      { mode: "build" },
      {
        eventStore: createTestSessionEventStore(),
        modelAdapter: stopModel(),
      },
    );

    let settled = false;
    const turn = runtime.executeTurn("hola").then(() => {
      settled = true;
    });

    await wait(30);
    expect(settled).toBe(false);

    // Un mensaje del worker cuenta como noticia y reinicia el reloj.
    runtime.enqueueBackgroundTaskNotification({
      text: "pregunta del programador",
      traceContext: createRootTraceContext({
        sessionId,
        turnId: "turn-live" as never,
      }),
    });

    await wait(50);
    expect(onHeartbeat).not.toHaveBeenCalled();

    await wait(120);
    expect(onHeartbeat).toHaveBeenCalled();
    expect(settled).toBe(false);

    testLoop.close();
    await turn;
    expect(settled).toBe(true);
  }, 10_000);
});
