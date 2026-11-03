import { describe, expect, it } from "vitest";
import {
  LOOP_HEARTBEAT_MS,
  applyLoopEvent,
  initialLoopState,
  resolveQuestion,
  type LoopState,
} from "../src/auton/loop.js";

const T0 = 1_700_000_000_000;

function working(running = 1, lastNarrationAt: number | null = T0): LoopState {
  return { running, openQuestions: 0, lastNarrationAt, phase: running > 0 ? "working" : "idle" };
}

describe("bucle vivo", () => {
  it("el humano siempre tiene la voz y corta lo que hubiera", () => {
    const decision = applyLoopEvent(working(2), { kind: "human_message", at: T0 + 5_000 });

    expect(decision.narrate).toBe(true);
    expect(decision.interrupt).toBe(true);
    expect(decision.reason).toBe("human_message");
    expect(decision.state.running).toBe(2);
  });

  it("abrir un canal se narra siempre y sube el contador", () => {
    const decision = applyLoopEvent(initialLoopState(), {
      kind: "dispatch",
      at: T0,
      workerId: "prog1",
    });

    expect(decision.narrate).toBe(true);
    expect(decision.state.running).toBe(1);
    expect(decision.state.phase).toBe("working");
    expect(decision.interrupt).toBe(false);
  });

  it("cerrar un canal baja el contador y vuelve a idle cuando no queda nada", () => {
    const closed = applyLoopEvent(working(1), {
      kind: "worker_closed",
      at: T0 + 1_000,
      workerId: "prog1",
      status: "done",
    });

    expect(closed.narrate).toBe(true);
    expect(closed.state.running).toBe(0);
    expect(closed.state.phase).toBe("idle");
  });

  it("una pregunta de worker deja el bucle en waiting_human y no se pierde", () => {
    const asked = applyLoopEvent(working(2), {
      kind: "worker_question",
      at: T0 + 2_000,
      workerId: "prog2",
    });

    expect(asked.narrate).toBe(true);
    expect(asked.interrupt).toBe(true);
    expect(asked.state.openQuestions).toBe(1);
    expect(asked.state.phase).toBe("waiting_human");

    const resolved = resolveQuestion(asked.state);
    expect(resolved.openQuestions).toBe(0);
    expect(resolved.phase).toBe("working");
  });

  it("el latido solo habla si hay trabajo y hace silencio suficiente", () => {
    const early = applyLoopEvent(working(1, T0), { kind: "heartbeat", at: T0 + 30_000 });
    expect(early.narrate).toBe(false);
    expect(early.reason).toBeNull();

    const due = applyLoopEvent(working(1, T0), { kind: "heartbeat", at: T0 + LOOP_HEARTBEAT_MS });
    expect(due.narrate).toBe(true);
    expect(due.interrupt).toBe(false);
    expect(due.reason).toBe("heartbeat");

    const idle = applyLoopEvent(working(0, T0), { kind: "heartbeat", at: T0 + 10 * LOOP_HEARTBEAT_MS });
    expect(idle.narrate).toBe(false);
  });

  it("narrar reinicia el reloj del silencio", () => {
    const dispatched = applyLoopEvent(initialLoopState(), { kind: "dispatch", at: T0 });
    const soon = applyLoopEvent(dispatched.state, { kind: "heartbeat", at: T0 + 60_000 });
    expect(soon.narrate).toBe(false);

    const closed = applyLoopEvent(dispatched.state, {
      kind: "worker_closed",
      at: T0 + 80_000,
      status: "done",
    });
    const later = applyLoopEvent(closed.state, { kind: "heartbeat", at: T0 + 80_000 + 90_000 });
    // Ya no hay trabajo en curso: el latido calla aunque haya pasado el tiempo.
    expect(later.narrate).toBe(false);
  });
});
