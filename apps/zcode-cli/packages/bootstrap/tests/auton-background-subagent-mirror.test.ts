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
      turnId: "turn_worker",
      traceId: "trace",
      timestamp: new Date(1_700_000_000_000 + sequence * 1000),
      sequenceNumber: sequence,
      type,
      payload,
    } as SessionEvent;
    return projection.applyEvent(event);
  };
  apply(SessionEventType.SessionCreated, { mode: "auton", contextWindow: 200_000 });
  apply(SessionEventType.TurnStarted, { turnNumber: 1, input: "despacha un worker" });
  // La llamada al tool `Agent` con su input real: de ahí sale el tipo de agente.
  apply(SessionEventType.ToolCallScheduled, {
    toolCallId: "call_agent_1",
    toolName: "Agent",
    input: { subagent_type: "auton-worker", description: "Build cosas" },
    schedule: { kind: "immediate" },
  });
  return { projection, apply };
}

function subagentRows(projection: ProductProjection): SubagentRow[] {
  return projection.getSnapshot().rows.window.filter((row): row is SubagentRow => row.kind === "subagent");
}

describe("el worker de sesión aparece por su tarea de fondo", () => {
  it("sin evento de spawn, la tarea de fondo espeja la fila del subagente", () => {
    const { projection, apply } = fixture();

    apply(SessionEventType.BackgroundTaskStarted, {
      taskId: "agent_de452a64",
      toolCallId: "call_agent_1",
      toolName: "Agent",
      taskKind: "subagent",
      childSessionId: "sess_auton_agent_de452a64",
      description: "Build cosas",
      status: "running",
      cancellable: true,
    });

    const rows = subagentRows(projection);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.subagentType).toBe("auton-worker");
    expect(row.childSessionId).toBe("sess_auton_agent_de452a64");
    expect(row.parentToolCallId).toBe("call_agent_1");
    expect(row.status).toBe("running");
    expect(row.summaryText).toBe("Build cosas");
    expect(row.backgrounded).toBe(true);
    expect(row.workId).toBe("agent_de452a64");
    // El directorio de subagentes lee el resumen en vivo, no un segundo camino.
    const running = projection.getSnapshot().subagents?.running ?? [];
    expect(running.map((item) => item.childSessionId)).toEqual(["sess_auton_agent_de452a64"]);

    apply(SessionEventType.BackgroundTaskCompleted, {
      taskId: "agent_de452a64",
      toolCallId: "call_agent_1",
      toolName: "Agent",
      taskKind: "subagent",
      childSessionId: "sess_auton_agent_de452a64",
      description: "Build cosas",
      status: "completed",
      cancellable: false,
    });

    const ended = subagentRows(projection)[0]!;
    expect(ended.status).toBe("success");
    expect(typeof ended.endedAt).toBe("number");
    expect(projection.getSnapshot().subagents?.running ?? []).toHaveLength(0);
  });

  it("una tarea de bash no inventa fila de subagente", () => {
    const { projection, apply } = fixture();

    apply(SessionEventType.BackgroundTaskStarted, {
      taskId: "exec_1",
      toolCallId: "call_bash_1",
      toolName: "Bash",
      taskKind: "bash",
      command: "sleep 5",
      description: "esperar",
      status: "running",
      cancellable: true,
    });

    expect(subagentRows(projection)).toHaveLength(0);
  });
});
