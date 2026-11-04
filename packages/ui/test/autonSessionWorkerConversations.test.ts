import { describe, expect, it } from "vitest";
import {
  parseWorkerIndex,
  parseWorkerTranscript,
  sessionWorkerSnapshotFromIndex,
} from "../src/auton/project-space/sessionWorkerConversations.js";

const INDEX = JSON.stringify([
  {
    workerId: "agent_muse",
    taskId: "agent_muse",
    engine: "muse",
    engineSessionId: "muse-session-1",
    workspace: "C:\\proyectos\\lunar\\.auton\\workers\\agent_muse",
    status: "completed",
    startedAt: "2026-11-02T12:00:00.000Z",
    endedAt: "2026-11-02T12:00:10.000Z",
    transcriptFile: "C:\\proyectos\\lunar\\.auton\\workers\\agent_muse\\worker-transcript.json",
    description: "landing",
  },
]);

const TRANSCRIPT = JSON.stringify([
  { id: "t1", at: 1, kind: "message", role: "orchestrator", text: "primer encargo" },
  { id: "t2", at: 2, kind: "message", role: "worker", text: "primera respuesta" },
  { id: "t3", at: 3, kind: "close", text: "Turno completado.", status: "completed" },
]);

describe("lectura de la conversación durable del worker", () => {
  it("convierte la entrada del índice en la instantánea del panel", () => {
    const [entry] = parseWorkerIndex(INDEX);
    const transcript = parseWorkerTranscript(TRANSCRIPT);
    const snapshot = sessionWorkerSnapshotFromIndex(entry!, transcript, 9_000);

    expect(snapshot).toMatchObject({
      agentId: "agent_muse",
      description: "landing",
      status: "completed",
      childSessionId: "muse-session-1",
      startedAt: Date.parse("2026-11-02T12:00:00.000Z"),
      completedAt: Date.parse("2026-11-02T12:00:10.000Z"),
      lastLine: "Turno completado.",
    });
    expect(snapshot.transcript).toHaveLength(3);
  });

  it("marca como pendiente un worker en espera y usa el reloj de respaldo", () => {
    const entry = parseWorkerIndex(
      JSON.stringify([
        {
          workerId: "agent_zcode",
          engine: "zcode",
          status: "waiting",
          startedAt: "no-es-fecha",
          description: "revisión",
        },
      ]),
    )[0]!;
    const snapshot = sessionWorkerSnapshotFromIndex(entry, [], 7_000);

    expect(snapshot).toMatchObject({
      status: "running",
      waitingForAnswer: true,
      startedAt: 7_000,
    });
  });

  it("un índice o una transcripción corruptos no rompen la vista", () => {
    expect(parseWorkerIndex("{")).toEqual([]);
    expect(parseWorkerTranscript("[] x")).toEqual([]);
    expect(
      parseWorkerTranscript(
        JSON.stringify([
          { id: "ok", at: 1, kind: "message", text: "válido" },
          { id: "bad", at: 2, kind: "otro", text: "descartado" },
        ]),
      ),
    ).toEqual([{ id: "ok", at: 1, kind: "message", text: "válido" }]);
  });
});
