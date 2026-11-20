import { describe, expect, it, vi } from "vitest";
import { createRootTraceContext, createSessionId } from "@zcode/contracts";
import { autonNotificationRegistryFor } from "@zcode/shared/auton-notifications";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { AutonLiveLoop, registerAutonLiveLoop } from "../src/auton/live-loop.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Modelo falso: responde y termina en una sola vuelta. */
function stopModel(generateText: ReturnType<typeof vi.fn>) {
  return {
    generateText,
  } as never;
}

/**
 * El turno termina aunque queden workers vivos: el humano puede escribir y
 * enviar. El evento del worker entra por la cola de comandos y abre un turno
 * nuevo; el latido sigue vivo mientras el canal existe.
 */
describe("turno vivo sobre una sesión real", () => {
  it("cierra para dejar escribir y el evento del worker abre un turno nuevo", async () => {
    const sessionId = createSessionId("auton-live-turn");
    const onHeartbeat = vi.fn();
    const generateText = vi.fn(async () => ({
      finishReason: "stop" as const,
      providerMetadata: undefined,
      text: "listo",
      toolCalls: [],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    }));
    const testLoop = new AutonLiveLoop({ heartbeatMs: 80, onHeartbeat });
    registerAutonLiveLoop(String(sessionId), testLoop);
    testLoop.dispatch();

    const runtime = createTestAgentRuntime(
      sessionId,
      { mode: "build" },
      {
        eventStore: createTestSessionEventStore(),
        modelAdapter: stopModel(generateText),
      },
    );

    let settled = false;
    const turn = runtime.executeTurn("hola").then(() => {
      settled = true;
    });

    // El turno cierra: el compositor queda libre para otro mensaje.
    await wait(40);
    expect(settled).toBe(true);
    await turn;

    // El latido sigue vivo mientras el canal existe, aunque el turno haya cerrado.
    await wait(120);
    expect(onHeartbeat).toHaveBeenCalled();
    const callsBeforeNotification = generateText.mock.calls.length;

    // La ruta externa encola una notificación; no arranca otro turno. El
    // orquestador la leerá cuando decida.
    runtime.enqueueBackgroundTaskNotification({
      text: "el worker terminó",
      traceContext: createRootTraceContext({
        sessionId,
        turnId: "turn-live" as never,
      }),
    });
    await wait(60);
    expect(generateText.mock.calls.length).toBe(callsBeforeNotification);
    expect(
      autonNotificationRegistryFor(String(sessionId)).unread("external"),
    ).toHaveLength(1);

    testLoop.close();
  }, 10_000);
});
