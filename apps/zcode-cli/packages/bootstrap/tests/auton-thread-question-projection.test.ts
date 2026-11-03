import { describe, expect, it } from "vitest";
import { SessionEventType, type SessionEvent } from "@zcode/contracts";
import type { SubagentRow } from "@zcode/shared/zcode-protocol-v4";
import { ProductProjection } from "../src/zcode-protocol-v4/index.js";

function fixture() {
  const projection = new ProductProjection("session", "epoch");
  let sequence = 0;
  const apply = (type: SessionEvent["type"], payload: unknown) => {
    const event = {
      id: `event-${++sequence}`,
      sessionId: "session",
      turnId: "turn_auton",
      traceId: "trace",
      timestamp: new Date(1_700_000_000_000 + sequence * 1000),
      sequenceNumber: sequence,
      type,
      payload,
    } as SessionEvent;
    projection.applyEvent(event);
  };
  apply(SessionEventType.SessionCreated, { mode: "auton", contextWindow: 200_000 });
  apply(SessionEventType.TurnStarted, { turnNumber: 1, input: "sprint", messageId: "user-1" });
  return { projection, apply };
}

function subagentRow(projection: ProductProjection): SubagentRow | undefined {
  return projection
    .getSnapshot()
    .rows.window.find((row): row is SubagentRow => row.kind === "subagent");
}

function spawn(apply: (type: SessionEvent["type"], payload: unknown) => void) {
  apply(SessionEventType.ToolCallScheduled, {
    toolCallId: "call-agent",
    toolName: "Agent",
    input: { description: "Landing de Auton", subagent_type: "auton-worker" },
    schedule: { parallelGroups: [["call-agent"]], executionOrder: ["call-agent"] },
  });
  apply(SessionEventType.SubagentSpawned, {
    agentId: "agent_1",
    parentToolCallId: "call-agent",
    agentType: "auton-worker",
    description: "Landing de Auton",
    childSessionId: "child_1",
  });
}

function sendMessage(
  apply: (type: SessionEvent["type"], payload: unknown) => void,
  input: Record<string, unknown>,
  id: string,
) {
  apply(SessionEventType.ToolCallScheduled, {
    toolCallId: id,
    toolName: "SendMessage",
    input,
    schedule: { parallelGroups: [[id]], executionOrder: [id] },
  });
  apply(SessionEventType.ToolCallStarted, { toolCallId: id, toolName: "SendMessage" });
  apply(SessionEventType.ToolCallResult, {
    toolCallId: id,
    toolName: "SendMessage",
    result: { success: true, content: "Message steered." },
    duration: 1,
  });
}

describe("proyección de la pregunta pendiente del worker", () => {
  it("requires_answer marca la fila del subagente y la respuesta del worker la levanta", () => {
    const { projection, apply } = fixture();
    spawn(apply);

    sendMessage(
      apply,
      {
        to: "agent_1",
        summary: "decision de paleta",
        message: "¿uso la paleta nueva?",
        requires_answer: true,
      },
      "call-ask",
    );

    expect(subagentRow(projection)?.waitingForAnswer).toBe(true);
    expect(typeof subagentRow(projection)?.lastActivityAt).toBe("number");
    const activityBefore = subagentRow(projection)?.lastActivityAt ?? 0;

    apply(SessionEventType.SubagentMessage, {
      agentId: "agent_1",
      childSessionId: "child_1",
      summaryText: "Sí, uso la paleta nueva.",
    });

    const answered = subagentRow(projection);
    expect(answered?.waitingForAnswer).toBe(false);
    expect(answered?.summaryText).toContain("Sí, uso la paleta nueva.");
    expect(answered?.lastActivityAt).toBeGreaterThan(activityBefore);
  });

  it("un mensaje sin requires_answer no abre pregunta", () => {
    const { projection, apply } = fixture();
    spawn(apply);

    sendMessage(
      apply,
      { to: "agent_1", summary: "guía", message: "sigue por la izquierda" },
      "call-guide",
    );

    expect(subagentRow(projection)?.waitingForAnswer).toBeUndefined();
  });

  it("el cierre del worker deja la pregunta resuelta", () => {
    const { projection, apply } = fixture();
    spawn(apply);
    sendMessage(
      apply,
      {
        to: "agent_1",
        summary: "decision de paleta",
        message: "¿uso la paleta nueva?",
        requires_answer: true,
      },
      "call-ask",
    );
    expect(subagentRow(projection)?.waitingForAnswer).toBe(true);

    apply(SessionEventType.SubagentStopped, {
      agentId: "agent_1",
      parentToolCallId: "call-agent",
      status: "success",
      summaryText: "landing lista",
    });

    const closed = subagentRow(projection);
    expect(closed?.status).toBe("success");
    expect(closed?.waitingForAnswer).toBe(false);
  });
});
