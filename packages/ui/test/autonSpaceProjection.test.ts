import { describe, expect, it } from "vitest";
import type { ConversationRow } from "@zcode/shared/zcode-protocol-v4";
import {
  projectAutonEvidence,
  projectAutonMessages,
  projectAutonPlan,
  projectAutonSpace,
  projectAutonTramos,
  projectAutonWorkers,
} from "../src/auton/project-space/projection.js";
import { sampleConversationRows } from "../src/auton/project-space/sample.js";

function subagent(
  rowId: number,
  status: "running" | "success" | "failed" | "cancelled",
  summary: string,
): ConversationRow {
  return {
    rowId,
    createdAtSeq: rowId,
    createdAt: new Date(Date.UTC(2026, 10, 2, 12, 0, 0)).toISOString(),
    turnId: "t1",
    kind: "subagent",
    parentToolCallId: "agent-1",
    subagentType: "auton-worker",
    status,
    summaryText: summary,
    childSessionId: `worker-${rowId}`,
    startedAt: new Date(Date.UTC(2026, 10, 2, 11, 58, 0)).toISOString(),
  } as unknown as ConversationRow;
}

describe("proyección del espacio desde filas reales", () => {
  it("convierte la conversación en hilo, workers, tramo, plan y evidencia", () => {
    const rows = sampleConversationRows();
    const data = projectAutonSpace({ rows });

    expect(data.messages).toHaveLength(3);
    expect(data.messages.map((message) => message.role)).toEqual([
      "human",
      "orchestrator",
      "orchestrator",
    ]);
    expect(data.messages[0]?.text).toContain("Mejora el diseño del chat");

    expect(data.workers.map((worker) => worker.name)).toEqual(["worker 1", "worker 2", "worker 3"]);
    expect(data.workers.map((worker) => worker.status)).toEqual([
      "trabajando",
      "preguntando",
      "terminado",
    ]);
    expect(data.workers[1]?.lastLine).toContain("¿el login");

    expect(data.tramos).toHaveLength(1);
    expect(data.tramos[0]?.workerIds).toEqual(["worker-1", "worker-2", "worker-3"]);

    expect(data.plan?.goalTitle).toBe("Lunar móvil");
    expect(data.plan?.items.map((item) => item.title)).toEqual([
      "Revisar el diseño del chat",
      "Diagnosticar el inicio de sesión",
      "Cerrar con evidencia",
    ]);

    expect(data.evidence?.command).toBe("pnpm --filter @zcode/ui test");
    expect(data.evidence?.output).toContain("3 passed");
    expect(data.evidence?.files).toEqual([
      "packages/ui/src/chat/MessageBubble.tsx",
      "packages/ui/src/chat/messageSpacing.ts",
    ]);
  });

  it("sin filas devuelve un espacio vacío, no datos inventados", () => {
    const data = projectAutonSpace({ rows: [] });
    expect(data.messages).toEqual([]);
    expect(data.workers).toEqual([]);
    expect(data.tramos).toEqual([]);
    expect(data.plan).toBeUndefined();
    expect(data.evidence).toBeUndefined();
  });

  it("mapea los estados reales del subagente a los cinco de la UI", () => {
    const rows = [
      subagent(1, "running", "trabajando"),
      subagent(2, "running", "¿qué criterio uso?"),
      subagent(3, "failed", "falló la compilación"),
      subagent(4, "cancelled", "cancelado por el orquestador"),
      subagent(5, "success", "terminado"),
    ];
    const workers = projectAutonWorkers(rows, Date.UTC(2026, 10, 2, 12, 0, 0));
    expect(workers.map((worker) => worker.status)).toEqual([
      "trabajando",
      "preguntando",
      "bloqueado",
      "bloqueado",
      "terminado",
    ]);
  });

  it("los tramos agrupan por encargo y cierran cuando todos cerraron", () => {
    const rows = sampleConversationRows();
    const tramos = projectAutonTramos(rows);
    expect(tramos[0]?.startedAt).toBeLessThanOrEqual(tramos[0]?.endedAt ?? Infinity);
    expect(projectAutonTramos([])).toEqual([]);
  });

  it("el plan sale del último AutonPlan y la evidencia del último comando", () => {
    const rows = sampleConversationRows();
    expect(projectAutonPlan(rows)?.items).toHaveLength(3);
    expect(projectAutonEvidence(rows)?.command).toContain("test");
    expect(projectAutonMessages(rows).every((message) => message.text.length > 0)).toBe(true);
  });
});
