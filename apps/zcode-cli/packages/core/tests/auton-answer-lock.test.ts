import { describe, expect, it } from "vitest";
import type { TurnSteerInput, TurnSteerResult } from "@zcode/contracts";
import {
  ANSWER_REQUIRED_HEADER,
  clearWaitingForAnswer,
  isAnswerRequired,
  markWaitingForAnswer,
} from "../src/auton/answerLock.js";
import { createSubagentMessageSink } from "../src/subagent/message-steering.js";
import { InMemoryRuntimeTaskRegistry } from "../src/runtime-task/registry.js";

const TRACE = { traceId: "trace-1", sessionId: "sess_orchestrator" } as never;

function task(registry: InMemoryRuntimeTaskRegistry, taskId: string): void {
  registry.register({
    taskId,
    agentId: taskId,
    agentType: "auton-worker",
    description: "landing",
    isBackgrounded: true,
    status: "running",
    startedAt: new Date("2026-11-02T20:00:00.000Z"),
    taskType: "local_agent",
    type: "local_agent",
  });
}

describe("candado del orquestador", () => {
  it("marcar deja el task esperando y volver a marcar no lo rompe", () => {
    const registry = new InMemoryRuntimeTaskRegistry();
    task(registry, "agent_1");

    markWaitingForAnswer(registry, "agent_1", true);
    expect(registry.get("agent_1")?.waitingForAnswer).toBe(true);

    markWaitingForAnswer(registry, "agent_1", true);
    expect(registry.get("agent_1")?.waitingForAnswer).toBe(true);
  });

  it("sin candado no se marca nada", () => {
    const registry = new InMemoryRuntimeTaskRegistry();
    task(registry, "agent_1");
    markWaitingForAnswer(registry, "agent_1", undefined);
    expect(registry.get("agent_1")?.waitingForAnswer).toBeUndefined();
  });

  it("la respuesta del worker levanta el candado una sola vez", () => {
    const registry = new InMemoryRuntimeTaskRegistry();
    task(registry, "agent_1");
    markWaitingForAnswer(registry, "agent_1", true);

    expect(clearWaitingForAnswer(registry, "agent_1")).toBe(true);
    expect(registry.get("agent_1")?.waitingForAnswer).toBe(false);
    expect(clearWaitingForAnswer(registry, "agent_1")).toBe(false);
  });

  it("limpiar un task desconocido no explota", () => {
    const registry = new InMemoryRuntimeTaskRegistry();
    expect(clearWaitingForAnswer(registry, "agent_x")).toBe(false);
  });
});

describe("entrega del mensaje al worker", () => {
  function fakeRuntime(seen: TurnSteerInput[]): {
    steerTurn(input: string | TurnSteerInput): Promise<TurnSteerResult>;
  } {
    return {
      async steerTurn(input) {
        seen.push(input as TurnSteerInput);
        return { kind: "accepted" } as TurnSteerResult;
      },
    };
  }

  it("una guía normal llega como mensaje del orquestador, sin candado", async () => {
    const seen: TurnSteerInput[] = [];
    const sink = createSubagentMessageSink(fakeRuntime(seen), { traceContext: TRACE });

    await sink.send({ id: "m1", message: "usa la paleta nueva", summary: "dato", queuedAt: new Date() });

    const input = seen[0]?.input ?? "";
    expect(input).toContain("usa la paleta nueva");
    expect(isAnswerRequired(input)).toBe(false);
    expect(input).not.toContain(ANSWER_REQUIRED_HEADER);
  });

  it("una decisión requerida llega con el candado y el worker sabe que debe responder", async () => {
    const seen: TurnSteerInput[] = [];
    const sink = createSubagentMessageSink(fakeRuntime(seen), { traceContext: TRACE });

    await sink.send({
      id: "m2",
      message: "¿borro el archivo viejo?",
      summary: "decisión",
      requiresAnswer: true,
      queuedAt: new Date(),
    });

    const input = seen[0]?.input ?? "";
    expect(isAnswerRequired(input)).toBe(true);
    expect(input).toContain("RespondToCoordinator");
    expect(input).toContain("¿borro el archivo viejo?");
    expect(seen[0]).toMatchObject({ delivery: "guide", inputPresentation: "coordinator_steer" });
  });
});
