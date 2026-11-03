import { describe, expect, it } from "vitest";
import type { ZCodeTaskMeta } from "@zcode/shared";
import { agentTramo, projectAgentWorkers } from "../src/auton/project-space/agentProjection.js";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

function task(
  taskId: string,
  title: string,
  status: ZCodeTaskMeta["status"],
  offset: number,
): ZCodeTaskMeta {
  return {
    taskId,
    traceId: `trace-${taskId}`,
    title,
    workspacePath: "C:\\proyectos\\lunar",
    createdAt: NOW + offset,
    updatedAt: NOW + offset + 30_000,
    mode: "zcode",
    status,
  } as unknown as ZCodeTaskMeta;
}

describe("workers = agentes completos de ZCode", () => {
  it("proyecta una fila por task con estado, nombre y reloj", () => {
    const workers = projectAgentWorkers(
      [
        task("s1", "Revisar el diseño", "running", -120_000),
        task("s2", "Arreglar el login", "completed", -300_000),
        task("s3", "Romper el build", "error", -60_000),
      ],
      NOW,
    );

    expect(workers.map((worker) => worker.id)).toEqual(["s1", "s2", "s3"]);
    expect(workers.map((worker) => worker.name)).toEqual([
      "Revisar el diseño",
      "Arreglar el login",
      "Romper el build",
    ]);
    expect(workers.map((worker) => worker.status)).toEqual([
      "trabajando",
      "terminado",
      "bloqueado",
    ]);
    expect(workers[0]?.startedAt).toBe(NOW - 120_000);
    expect(workers[0]?.lastSignalAt).toBe(NOW - 90_000);
    expect(workers[0]?.transcript.length).toBeGreaterThan(0);
  });

  it("sin tasks no inventa workers y el tramo agrupa a los agentes", () => {
    expect(projectAgentWorkers([], NOW)).toEqual([]);
    expect(agentTramo([])).toBeNull();

    const workers = projectAgentWorkers([task("s1", "A", "running", -10_000)], NOW);
    const tramo = agentTramo(workers);
    expect(tramo?.workerIds).toEqual(["s1"]);
    expect(tramo?.startedAt).toBe(NOW - 10_000);
  });

  it("el error y el resumen de archivos se ven en la actividad del worker", () => {
    const withFiles = {
      ...task("s1", "A", "running", -10_000),
      changeSummary: { fileCount: 2, added: 8, removed: 3, files: [] },
    } as ZCodeTaskMeta;
    const failed = {
      ...task("s2", "B", "error", -20_000),
      lastError: { message: "el build falló" },
    } as unknown as ZCodeTaskMeta;

    const workers = projectAgentWorkers([withFiles, failed], NOW);
    expect(workers[0]?.lastLine).toContain("2 archivos");
    expect(workers[1]?.lastLine).toBe("el build falló");
    expect(workers[1]?.transcript.at(-1)?.kind).toBe("close");
  });
});
