import { describe, expect, it } from "vitest";
import {
  channelClock,
  channelElapsedMs,
  channelStatusLabel,
  formatElapsed,
  wakeEventForSubagent,
} from "../src/auton/subagentChannel.js";
import type { SubagentRow } from "@zcode/shared/zcode-protocol-v4";

function row(overrides: Partial<SubagentRow> = {}): SubagentRow {
  return {
    kind: "subagent",
    rowId: 1,
    subagentType: "auton-worker",
    status: "running",
    summaryText: "Construir la landing",
    startedAt: "2026-11-02T20:00:00.000Z",
    ...overrides,
  } as SubagentRow;
}

describe("canal del programador en el hilo", () => {
  it("formatea el reloj del canal", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(62_000)).toBe("01:02");
    expect(formatElapsed(3_600_000)).toBe("60:00");
  });

  it("calcula el tiempo transcurrido con y sin cierre", () => {
    const start = Date.parse("2026-11-02T20:00:00.000Z");

    expect(channelElapsedMs(row(), start + 90_000)).toBe(90_000);
    expect(channelElapsedMs(row({ endedAt: "2026-11-02T20:02:14.000Z" }), start + 999_000)).toBe(
      134_000,
    );
    expect(channelClock(row({ endedAt: "2026-11-02T20:02:14.000Z" }), start)).toBe("02:14");
    expect(channelClock(row({ startedAt: undefined }), start)).toBeNull();
  });

  it("etiqueta los cuatro estados", () => {
    expect(channelStatusLabel("running")).toBe("en marcha");
    expect(channelStatusLabel("success")).toBe("terminó");
    expect(channelStatusLabel("failed")).toBe("falló");
    expect(channelStatusLabel("cancelled")).toBe("detenido");
  });

  it("mientras corre no hay fila de evento; al cerrar sale centrada con su estado", () => {
    expect(wakeEventForSubagent(row(), Date.parse("2026-11-02T20:01:00.000Z"), "Landing")).toBeNull();

    const closed = wakeEventForSubagent(
      row({
        status: "success",
        endedAt: "2026-11-02T20:02:14.000Z",
        summaryText: "index.html creado y verificado",
      }),
      Date.parse("2026-11-02T20:03:00.000Z"),
      "Landing",
    );

    expect(closed).toMatchObject({
      kind: "closed",
      title: "Landing terminó",
      detail: "index.html creado y verificado",
      at: "02:14",
      actionLabel: "Abrir",
    });
  });

  it("recorta el detalle largo y marca el fallo", () => {
    const closed = wakeEventForSubagent(
      row({ status: "failed", endedAt: "2026-11-02T20:00:30.000Z", summaryText: "x".repeat(120) }),
      Date.parse("2026-11-02T20:01:00.000Z"),
      "Landing",
    );

    expect(closed?.title).toBe("Landing falló");
    expect(closed?.detail?.length).toBeLessThanOrEqual(80);
    // El recorte conserva la cola: ahí está lo último que dijo el worker.
    expect(closed?.detail?.startsWith("…")).toBe(true);
  });
});
