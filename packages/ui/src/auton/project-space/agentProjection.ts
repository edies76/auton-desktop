// ============================================================
// Workers de Auton: agentes completos de ZCode
// ============================================================
// La transición es esta: el worker deja de ser un subagente y pasa a ser una
// sesión/agente completa del workspace (ZCodeTaskMeta). Los subagentes se
// siguen proyectando como compatibilidad mientras existan.

import type { ZCodeTaskMeta } from "@zcode/shared";
import type {
  AutonWorkerGroup,
  AutonWorkTramo,
  AutonWorkerView,
  AutonWorkerStatus,
} from "./model.js";

function statusOf(task: ZCodeTaskMeta): AutonWorkerStatus {
  if (task.status === "completed") return "terminado";
  if (task.status === "error") return "bloqueado";
  if (task.status === "running") return "trabajando";
  return "esperando";
}

function lastLineOf(task: ZCodeTaskMeta): string {
  if (task.lastError?.message) return task.lastError.message;
  const summary = task.changeSummary;
  if (summary && summary.fileCount > 0) {
    return `${summary.fileCount} archivos · +${summary.added}/-${summary.removed}`;
  }
  return task.title;
}

/** Una fila de worker por agente completo del workspace. */
export function projectAgentWorkers(
  tasks: readonly ZCodeTaskMeta[],
  now = Date.now(),
): AutonWorkerView[] {
  return tasks.map((task) => {
    const status = statusOf(task);
    const startedAt = task.createdAt || now;
    const lastSignalAt = task.updatedAt || startedAt;
    const transcript: AutonWorkerView["transcript"] = [
      { id: `agent-${task.taskId}-start`, at: startedAt, kind: "message", text: task.title },
    ];
    if (task.changeSummary && task.changeSummary.fileCount > 0) {
      transcript.push({
        id: `agent-${task.taskId}-files`,
        at: lastSignalAt,
        kind: "tool",
        text: `${task.changeSummary.fileCount} archivos, +${task.changeSummary.added}/-${task.changeSummary.removed}`,
      });
    }
    if (task.lastError?.message) {
      transcript.push({
        id: `agent-${task.taskId}-error`,
        at: lastSignalAt,
        kind: "close",
        text: task.lastError.message,
      });
    } else if (status === "terminado") {
      transcript.push({
        id: `agent-${task.taskId}-done`,
        at: lastSignalAt,
        kind: "close",
        text: "Terminado.",
      });
    }

    return {
      id: task.taskId,
      name: task.title || `Agente ${task.taskId.slice(0, 6)}`,
      status,
      startedAt,
      lastSignalAt,
      lastLine: lastLineOf(task),
      transcript,
      kind: "agent" as const,
      engine: "zcode" as const,
    };
  });
}

/**
 * Agrupa los canales del proyecto por motor/rol. El orquestador no entra aquí:
 * él es el hilo, no un worker. Muse Code queda declarado aunque aún no tenga
 * adaptador, para que el lugar exista en la UI.
 */
export function buildAutonWorkerGroups(params: {
  agentWorkers: readonly AutonWorkerView[];
  subagentWorkers: readonly AutonWorkerView[];
  museWorkers?: readonly AutonWorkerView[];
}): AutonWorkerGroup[] {
  return [
    {
      kind: "agent",
      label: "Agentes ZCode",
      workers: [...params.agentWorkers],
      canStop: true,
    },
    {
      kind: "subagent",
      label: "Subagentes",
      workers: [...params.subagentWorkers],
      canStop: false,
    },
    {
      kind: "muse",
      label: "Muse Code",
      workers: [...(params.museWorkers ?? [])],
      canStop: false,
    },
  ];
}

/**
 * Agentes del proyecto sin el orquestador. El orquestador se excluye por su
 * taskId (la sesión del humano), nunca por “el task más reciente”.
 */
export function projectProjectAgentWorkers(
  tasks: readonly ZCodeTaskMeta[],
  orchestratorTaskId: string | null,
  now = Date.now(),
): AutonWorkerView[] {
  return projectAgentWorkers(
    tasks.filter((task) => task.taskId !== orchestratorTaskId),
    now,
  );
}

/** Los agentes completos forman el tramo vivo del workspace. */
export function agentTramo(workers: readonly AutonWorkerView[]): AutonWorkTramo | null {
  if (workers.length === 0) return null;
  return {
    id: "tramo-agentes",
    startedAt: Math.min(...workers.map((worker) => worker.startedAt)),
    workerIds: workers.map((worker) => worker.id),
  };
}
