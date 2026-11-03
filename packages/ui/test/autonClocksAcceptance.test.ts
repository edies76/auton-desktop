// packages/ui/test/autonClocksAcceptance.test.ts
import { describe, expect, it } from "vitest";
import { unionTotalMs, sprintSplitMs } from "../src/auton/clocks.js";

describe("aceptacion B: 2 workers en paralelo + espera", () => {
  it("da los tres numeros correctos", () => {
    const t0 = Date.parse("2026-11-03T10:00:00.000Z");
    // worker1 0-100s, worker2 30-90s solapado, espera sprint 100-140s, worker1 retoma 140-160s
    const worker1Ms = 100_000 + 20_000;
    const worker2Ms = 60_000;
    const split = sprintSplitMs(
      [{ startMs: t0, endMs: t0 + 100_000 }, { startMs: t0 + 140_000, endMs: t0 + 160_000 }],
      [{ startMs: t0 + 100_000, endMs: t0 + 140_000 }],
      t0 + 160_000
    );
    const total = unionTotalMs(
      [{ startMs: t0, endMs: t0 + 100_000 }, { startMs: t0 + 30_000, endMs: t0 + 90_000 }, { startMs: t0 + 140_000, endMs: t0 + 160_000 }],
      t0 + 160_000
    );
    expect(worker1Ms).toBe(120_000);
    expect(worker2Ms).toBe(60_000);
    expect(split).toEqual({ workMs: 120_000, waitMs: 40_000 });
    expect(total).toBe(120_000);
  });
});
