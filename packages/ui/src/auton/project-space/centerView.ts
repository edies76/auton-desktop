import type { ZCodeTaskMeta } from "@zcode/shared";
import { isWorkerSessionTaskId } from "@/project-sidebar/projectConversation.js";
import type { AutonWorkerStatus, AutonWorkerView } from "./model.js";

/** De dónde salió el worker seleccionado. El panel manda sobre la sesión. */
export type CenterSelectionOrigin = "panel" | "session" | null;

export interface CenterViewInput {
  activeTaskId: string | null;
  selectedWorkerId: string | null;
  selectionOrigin: CenterSelectionOrigin;
  orchestratorTaskId: string | null;
}

export type CenterView =
  | { kind: "orchestrator" }
  | {
      kind: "worker-focus";
      workerId: string;
      stopTaskId: string | null;
      canStop: boolean;
    }
  | {
      kind: "worker-session";
      taskId: string;
      stopTaskId: string | null;
      canStop: boolean;
      canGoBack: boolean;
    };

/**
 * Una sola regla decide qué ocupa el centro: la selección explícita del panel
 * gana; si no hay, una sesión de worker activa; si no, el orquestador. El
 * orquestador nunca se trata como worker. Parar exige el turno del orquestador:
 * sin él no hay `stopTaskId` y la UI no ofrece parada.
 */
export function resolveCenterView(input: CenterViewInput): CenterView {
  const { activeTaskId, selectedWorkerId, selectionOrigin, orchestratorTaskId } = input;
  const panelSelection =
    selectionOrigin !== "session" &&
    selectedWorkerId !== null &&
    selectedWorkerId !== orchestratorTaskId;

  if (panelSelection) {
    return {
      kind: "worker-focus",
      workerId: selectedWorkerId,
      stopTaskId: orchestratorTaskId,
      canStop: Boolean(orchestratorTaskId),
    };
  }

  if (
    activeTaskId &&
    activeTaskId !== orchestratorTaskId &&
    isWorkerSessionTaskId(activeTaskId)
  ) {
    return {
      kind: "worker-session",
      taskId: activeTaskId,
      stopTaskId: orchestratorTaskId,
      canStop: Boolean(orchestratorTaskId),
      canGoBack: Boolean(orchestratorTaskId),
    };
  }

  return { kind: "orchestrator" };
}

function statusFromMeta(meta: ZCodeTaskMeta | null | undefined): AutonWorkerStatus {
  if (meta?.status === "running") return "trabajando";
  if (meta?.status === "error") return "bloqueado";
  if (meta?.status === "completed") return "terminado";
  return "esperando";
}

/** Un worker restaurado desde una sesión de tarea se deriva de su meta. */
export function workerFromTaskMeta(input: {
  taskId: string;
  title: string;
  meta?: ZCodeTaskMeta | null;
  now?: number;
}): AutonWorkerView {
  const now = input.now ?? Date.now();
  const startedAt = input.meta?.createdAt ?? now;
  const lastSignalAt = input.meta?.updatedAt ?? startedAt;
  const lastLine = input.meta?.lastError?.message;
  return {
    id: input.taskId,
    name: input.title.trim() || "Worker",
    status: statusFromMeta(input.meta),
    startedAt,
    lastSignalAt,
    kind: "agent",
    engine: "zcode",
    ...(lastLine ? { lastLine } : {}),
    transcript: [],
  };
}
