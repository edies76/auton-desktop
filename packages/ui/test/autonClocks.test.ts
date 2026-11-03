// packages/ui/test/autonClocks.test.ts
import { describe, expect, it } from "vitest";
import { unionTotalMs, sprintSplitMs, silenceMs } from "../src/auton/clocks.js";

describe("relojes", () => {
  it("total cuenta solapamientos una vez: 2 workers 60s solapados + 30s secuencial = 90s", () => {
    const t0 = Date.parse("2026-11-03T10:00:00.000Z");
    const total = unionTotalMs([
      { startMs: t0, endMs: t0 + 60_000 },
      { startMs: t0 + 30_000, endMs: t0 + 90_000 },
      { startMs: t0 + 90_000, endMs: t0 + 120_000 },
    ], t0 + 120_000);
    expect(total).toBe(120_000);
  });

  it("sprint separa trabajo y espera", () => {
    const t0 = Date.parse("2026-11-03T10:00:00.000Z");
    const split = sprintSplitMs(
      [{ startMs: t0, endMs: t0 + 100_000 }, { startMs: t0 + 140_000, endMs: t0 + 160_000 }],
      [{ startMs: t0 + 100_000, endMs: t0 + 140_000 }],
      t0 + 160_000
    );
    expect(split).toEqual({ workMs: 120_000, waitMs: 40_000 });
  });

  it("silencio nulo sin señal, 90s con señal vieja", () => {
    expect(silenceMs(null, 1000)).toBeNull();
    expect(silenceMs(1000, 91_000)).toBe(90_000);
  });

  it("intervalo abierto usa now, fin anterior a inicio vale 0", () => {
    const t0 = 1_000_000;
    expect(unionTotalMs([{ startMs: t0, endMs: null }], t0 + 30_000)).toBe(30_000);
    expect(unionTotalMs([{ startMs: t0 + 50_000, endMs: t0 }], t0 + 60_000)).toBe(0);
  });
});
