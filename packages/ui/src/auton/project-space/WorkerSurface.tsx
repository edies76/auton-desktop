import type { ZCodeTaskMeta } from "@zcode/shared";
import { useEffect, useMemo } from "react";
import { workerFromTaskMeta, type CenterView } from "./centerView.js";
import type { AutonWorkerView } from "./model.js";
import { AutonWorkerFocusPane } from "./WorkerFocusPane.js";
import { useAutonWorkerFocusStore } from "./workerFocusStore.js";

export interface AutonWorkerSurfaceProps {
  view: CenterView;
  activeTaskTitle: string;
  activeTaskMeta?: ZCodeTaskMeta | null;
  workspacePath: string;
  workspaceIdentity?: string;
  isDesktop?: boolean;
  onSelectOrchestrator: () => void;
}

/**
 * Renderiza exactamente el tipo que devolvió `resolveCenterView`. El worker se
 * busca en la proyección viva o se deriva de la meta de la sesión; la
 * superficie no escribe selección ni reabre el worker por su cuenta.
 */
export function AutonWorkerSurface({
  view,
  activeTaskTitle,
  activeTaskMeta,
  workspacePath,
  workspaceIdentity,
  isDesktop = false,
  onSelectOrchestrator,
}: AutonWorkerSurfaceProps) {
  const liveWorkers = useAutonWorkerFocusStore((state) => state.liveWorkers);
  const worker = useMemo<AutonWorkerView | null>(() => {
    if (view.kind === "worker-session") {
      return (
        liveWorkers.find((entry) => entry.id === view.taskId) ??
        workerFromTaskMeta({
          taskId: view.taskId,
          title: activeTaskTitle,
          meta: activeTaskMeta,
        })
      );
    }
    if (view.kind === "worker-focus") {
      return liveWorkers.find((entry) => entry.id === view.workerId) ?? null;
    }
    return null;
  }, [activeTaskMeta, activeTaskTitle, liveWorkers, view]);

  const setMode = useAutonWorkerFocusStore((state) => state.setMode);
  const workerId = worker?.id ?? null;
  useEffect(() => {
    // Cambiar de worker vuelve al resumen; el chat es una decisión por worker.
    setMode("summary");
  }, [setMode, workerId]);

  if (!worker || view.kind === "orchestrator") return null;

  const close = useAutonWorkerFocusStore.getState().close;
  const onBack =
    view.kind === "worker-session"
      ? () => {
          close();
          onSelectOrchestrator();
        }
      : close;

  return (
    <AutonWorkerFocusPane
      worker={worker}
      workspacePath={workspacePath}
      workspaceIdentity={workspaceIdentity}
      stopTaskId={view.stopTaskId}
      canStop={view.canStop}
      isDesktop={isDesktop}
      onBack={onBack}
      canGoBack={view.kind === "worker-session" ? view.canGoBack : true}
    />
  );
}
