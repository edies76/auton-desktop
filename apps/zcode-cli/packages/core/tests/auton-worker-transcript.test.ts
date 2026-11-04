import { describe, expect, it } from "vitest";
import type { MuseMspTurn } from "../src/auton/museMspClient.js";
import { transcriptFromMuseTurns } from "../src/auton/workerTranscript.js";

function turn(overrides: Partial<MuseMspTurn> = {}): MuseMspTurn {
  return {
    turnId: "turn-1",
    userText: "primer encargo",
    assistantText: "primera respuesta",
    items: [
      { itemId: "u1", kind: "userMessage", status: "completed", text: "primer encargo" },
      {
        itemId: "tool-1",
        kind: "toolCall",
        status: "completed",
        summary: "leyendo el proyecto",
      },
      {
        itemId: "a1",
        kind: "agentMessage",
        status: "completed",
        text: "primera respuesta",
      },
    ],
    terminal: "completed",
    ...overrides,
  };
}

describe("transcripción de Muse", () => {
  it("mapea mensajes, herramientas y el cierre de un turno completado", () => {
    const entries = transcriptFromMuseTurns([turn()], 1_000);

    expect(entries).toEqual([
      { id: "muse-0", at: 1_000, kind: "message", role: "orchestrator", text: "primer encargo" },
      { id: "muse-1", at: 1_001, kind: "tool", text: "leyendo el proyecto", status: "completed" },
      {
        id: "muse-2",
        at: 1_002,
        kind: "message",
        role: "worker",
        text: "primera respuesta",
      },
      {
        id: "muse-3",
        at: 1_003,
        kind: "close",
        text: "Turno completado.",
        status: "completed",
      },
    ]);
  });

  it("conserva el motivo cuando el turno falla o se cancela", () => {
    const failed = transcriptFromMuseTurns(
      [turn({ terminal: "failed", reason: "sin cuota" })],
      2_000,
    );
    expect(failed.at(-1)).toMatchObject({
      kind: "close",
      text: "sin cuota",
      status: "failed",
    });

    const cancelled = transcriptFromMuseTurns([turn({ terminal: "cancelled" })], 3_000);
    expect(cancelled.at(-1)).toMatchObject({
      kind: "close",
      text: "turno cancelled",
      status: "cancelled",
    });
  });

  it("cierra cada turno de una conversación de varias entradas", () => {
    const entries = transcriptFromMuseTurns(
      [
        turn(),
        turn({
          turnId: "turn-2",
          userText: "segunda entrada",
          assistantText: "segunda respuesta",
          items: [
            { itemId: "a2", kind: "agentMessage", status: "completed", text: "segunda respuesta" },
          ],
        }),
      ],
      4_000,
    );

    expect(entries.filter((entry) => entry.kind === "close")).toHaveLength(2);
    expect(entries.at(-1)).toMatchObject({ kind: "close", status: "completed" });
    const text = entries.map((entry) => entry.text).join("\n");
    expect(text.indexOf("primera respuesta")).toBeLessThan(text.indexOf("segunda entrada"));
    expect(text.indexOf("segunda entrada")).toBeLessThan(text.indexOf("segunda respuesta"));
  });
});
