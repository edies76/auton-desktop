import type { ZCodeTaskMeta } from "@zcode/shared";
import { isWorkerSessionTaskId } from "./session.js";
import type { AutonWorkerStatus, AutonWorkerView } from "./model.js";

/** De dónde salió el worker seleccionado. El panel manda sobre la sesión. */
export type CenterSelectionOrigin = "panel" | "session" | null;

export interface CenterViewInput {
  activeTaskId: string | null;
  selectedWorkerId: string | null;
  selectionOrigin: CenterSelectionOrigin;
  orchestratorTaskId: string | null;
  /** La fila elegida sigue existiendo en la proyección viva. */
  selectedWorkerExists?: boolean;
}

export type CenterView =
  | { kind: "orchestrator" }
  | {
      kind: "worker-focus";
      workerId: string;
      /** La vuelta navega al orquestador, no a la sesión de worker activa. */
      backToOrchestrator: boolean;
      canGoBack: boolean;
    }
  | {
      kind: "worker-session";
      taskId: string;
      canGoBack: boolean;
    };

/**
 * Una sola regla decide qué ocupa el centro: la selección explícita del panel
 * gana; si no hay, una sesión de worker activa; si no, el orquestador. El
 * orquestador nunca se trata como worker. La parada vive en el panel, cuyo
 * `stopTaskId` es solo el orquestador publicado.
 */
export function resolveCenterView(input: CenterViewInput): CenterView {
  const {
    activeTaskId,
    selectedWorkerId,
    selectionOrigin,
    orchestratorTaskId,
    selectedWorkerExists = true,
  } = input;
  const panelSelection =
    selectionOrigin !== "session" &&
    selectedWorkerId !== null &&
    selectedWorkerId !== orchestratorTaskId &&
    selectedWorkerExists;

  if (panelSelection) {
    const activeWorkerSession = Boolean(
      activeTaskId &&
        activeTaskId !== orchestratorTaskId &&
        isWorkerSessionTaskId(activeTaskId),
    );
    return {
      kind: "worker-focus",
      workerId: selectedWorkerId,
      backToOrchestrator: activeWorkerSession && Boolean(orchestratorTaskId),
      canGoBack: Boolean(orchestratorTaskId) || !activeWorkerSession,
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
