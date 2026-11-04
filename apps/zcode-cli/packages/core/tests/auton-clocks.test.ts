import { describe, expect, it } from "vitest";
import { silenceMs, sprintSplitMs, unionTotalMs } from "../src/auton/clocks.js";

describe("relojes: union con solapamientos una vez", () => {
  it("dos workers solapados 60s mas 30s secuencial cuentan 90s", () => {
    const t0 = Date.parse("2026-11-04T10:00:00.000Z");
    expect(
      unionTotalMs(
        [
          { startMs: t0, endMs: t0 + 60_000 },
          { startMs: t0 + 30_000, endMs: t0 + 90_000 },
          { startMs: t0 + 90_000, endMs: t0 + 120_000 },
        ],
        t0 + 120_000,
      ),
    ).toBe(120_000);
  });

  it("sprint separa trabajo 120s y espera 40s", () => {
    const t0 = Date.parse("2026-11-04T10:00:00.000Z");
    expect(
      sprintSplitMs(
        [
          { startMs: t0, endMs: t0 + 100_000 },
          { startMs: t0 + 140_000, endMs: t0 + 160_000 },
        ],
        [{ startMs: t0 + 100_000, endMs: t0 + 140_000 }],
        t0 + 160_000,
      ),
    ).toEqual({ workMs: 120_000, waitMs: 40_000 });
  });

  it("fin anterior a inicio vale 0; intervalo abierto usa now", () => {
    const t0 = 1_000_000;
    expect(unionTotalMs([{ startMs: t0 + 50_000, endMs: t0 }], t0 + 60_000)).toBe(0);
    expect(unionTotalMs([{ startMs: t0, endMs: null }], t0 + 30_000)).toBe(30_000);
  });

  it("silencio nulo sin senal, segundos con senal vieja", () => {
    expect(silenceMs(null, 1000)).toBeNull();
    expect(silenceMs(1000, 91_000)).toBe(90_000);
  });
});
