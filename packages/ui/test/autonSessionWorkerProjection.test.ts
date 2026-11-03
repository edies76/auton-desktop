import { describe, expect, it } from "vitest";
import {
  mergeSessionWorkers,
  projectSessionWorkerView,
  sessionWorkerStatus,
  type AutonSessionWorkerSnapshot,
} from "../src/auton/project-space/sessionWorker.js";

function snapshot(overrides: Partial<AutonSessionWorkerSnapshot> = {}): AutonSessionWorkerSnapshot {
  return {
    agentId: "agent_1",
    description: "landing",
    status: "running",
    startedAt: 1_000,
    childSessionId: "sess_auton_agent_1",
    ...overrides,
  };
}

describe("worker de sesión en el espacio del proyecto", () => {
  it("produce la misma forma que consume el panel", () => {
    const view = projectSessionWorkerView(
      snapshot({ lastLine: "revisando el formulario", completedAt: 2_500 }),
    );

    expect(view).toEqual({
      id: "sess_auton_agent_1",
      agentId: "agent_1",
      name: "worker landing",
      status: "trabajando",
      startedAt: 1_000,
      lastSignalAt: 2_500,
      lastLine: "revisando el formulario",
      transcript: [
        { id: "agent_1-last", at: 2_500, kind: "message", text: "revisando el formulario" },
      ],
    });
  });

  it("traduce los estados reales a los del panel", () => {
    expect(sessionWorkerStatus(snapshot())).toBe("trabajando");
    expect(sessionWorkerStatus(snapshot({ waitingForAnswer: true }))).toBe("preguntando");
    expect(sessionWorkerStatus(snapshot({ status: "completed" }))).toBe("terminado");
    expect(sessionWorkerStatus(snapshot({ status: "failed" }))).toBe("bloqueado");
    expect(sessionWorkerStatus(snapshot({ status: "stopped" }))).toBe("esperando");
  });

  it("un fallo deja el motivo en la transcripción", () => {
    const view = projectSessionWorkerView(
      snapshot({ status: "failed", completedAt: 3_000, error: "no compila" }),
    );

    expect(view.status).toBe("bloqueado");
    expect(view.transcript.at(-1)).toMatchObject({ kind: "close", text: "no compila" });
  });

  it("reemplaza la fila del agente con la conversación real del worker", () => {
    const space = {
      messages: [],
      workers: [
        {
          id: "sess_auton_agent_1",
          name: "worker 1",
          status: "trabajando" as const,
          startedAt: 900,
          lastSignalAt: 900,
          transcript: [{ id: "agent-1-start", at: 900, kind: "message" as const, text: "landing" }],
        },
      ],
      tramos: [],
    };

    const merged = mergeSessionWorkers(space, [
      snapshot({
        transcript: [
          {
            id: "t1",
            at: 1_000,
            kind: "message",
            role: "orchestrator",
            text: "primer encargo",
          },
          { id: "t2", at: 1_100, kind: "message", role: "worker", text: "listo" },
        ],
      }),
      snapshot({ agentId: "agent_2", childSessionId: "sess_auton_agent_2" }),
    ]);

    expect(merged.workers.map((worker) => worker.id)).toEqual([
      "sess_auton_agent_1",
      "sess_auton_agent_2",
    ]);
    expect(merged.workers[0]?.name).toBe("worker 1");
    expect(merged.workers[0]?.transcript).toEqual([
      { id: "t1", at: 1_000, kind: "message", text: "Orquestador: primer encargo" },
      { id: "t2", at: 1_100, kind: "message", text: "listo" },
    ]);
  });

  it("pinta la conversación del motor en la transcripción, con voces y herramientas", () => {
    const view = projectSessionWorkerView(
      snapshot({
        transcript: [
          {
            id: "t1",
            at: 1_000,
            kind: "message",
            role: "orchestrator",
            text: "primer encargo",
          },
          { id: "t2", at: 1_100, kind: "tool", text: "leyendo el proyecto", status: "completed" },
          { id: "t3", at: 1_200, kind: "message", role: "worker", text: "listo, revisé todo" },
          { id: "t4", at: 1_300, kind: "close", text: "turno completado", status: "completed" },
        ],
      }),
    );

    expect(view.transcript).toEqual([
      { id: "t1", at: 1_000, kind: "message", text: "Orquestador: primer encargo" },
      { id: "t2", at: 1_100, kind: "tool", text: "leyendo el proyecto" },
      { id: "t3", at: 1_200, kind: "message", text: "listo, revisé todo" },
      { id: "t4", at: 1_300, kind: "close", text: "turno completado" },
    ]);
  });
});
