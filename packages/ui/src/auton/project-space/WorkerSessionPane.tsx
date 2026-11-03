import type { ZCodeTaskMeta } from "@zcode/shared";
import { useEffect, useMemo } from "react";
import type { AutonWorkerStatus, AutonWorkerView } from "./model.js";
import { AutonWorkerFocusPane } from "./WorkerFocusPane.js";
import { useAutonWorkerFocusStore } from "./workerFocusStore.js";

export interface AutonWorkerSessionPaneProps {
  taskId: string;
  title: string;
  meta?: ZCodeTaskMeta | null;
  workspacePath: string;
  workspaceIdentity?: string;
  isDesktop?: boolean;
  /** El turno del orquestador que controla al worker; parar lo interrumpe. */
  stopTaskId?: string;
  onBack?: () => void;
  canGoBack?: boolean;
}

function statusFromMeta(meta: ZCodeTaskMeta | null | undefined): AutonWorkerStatus {
  if (meta?.status === "running") return "trabajando";
  if (meta?.status === "error") return "bloqueado";
  return "terminado";
}

/**
 * Una sesión `auton-worker`/subagente abierta como tarea activa (restauración o
 * enlace externo) se muestra como worker de solo lectura, nunca como el chat
 * editable del orquestador.
 */
export function AutonWorkerSessionPane({
  taskId,
  title,
  meta,
  workspacePath,
  workspaceIdentity,
  isDesktop = false,
  stopTaskId,
  onBack,
  canGoBack = true,
}: AutonWorkerSessionPaneProps) {
  const liveWorker = useAutonWorkerFocusStore((state) =>
    state.liveWorkers.find((worker) => worker.id === taskId),
  );
  const openedWorkerId = useAutonWorkerFocusStore((state) => state.workerId);
  const fallback = useMemo<AutonWorkerView>(() => {
    const startedAt = meta?.createdAt ?? Date.now();
    const lastSignalAt = meta?.updatedAt ?? startedAt;
    const lastLine = meta?.lastError?.message;
    return {
      id: taskId,
      name: title.trim() || "Worker",
      status: statusFromMeta(meta),
      startedAt,
      lastSignalAt,
      kind: "agent",
      engine: "zcode",
      ...(lastLine ? { lastLine } : {}),
      transcript: [],
    };
  }, [meta, taskId, title]);

  useEffect(() => {
    if (openedWorkerId === taskId) return;
    useAutonWorkerFocusStore
      .getState()
      .open(liveWorker ?? fallback, workspacePath, workspaceIdentity, stopTaskId);
  }, [
    fallback,
    liveWorker,
    openedWorkerId,
    stopTaskId,
    taskId,
    workspaceIdentity,
    workspacePath,
  ]);

  // Al volver, se cierra el foco para que el shell caiga en el chat del
  // orquestador y no vuelva a pintar el resumen del worker.
  const handleBack = onBack
    ? () => {
        useAutonWorkerFocusStore.getState().close();
        onBack();
      }
    : undefined;

  return (
    <AutonWorkerFocusPane
      isDesktop={isDesktop}
      {...(handleBack ? { onBack: handleBack } : {})}
      canGoBack={canGoBack}
    />
  );
}
