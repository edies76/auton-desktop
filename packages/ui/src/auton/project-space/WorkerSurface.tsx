import type { ZCodeTaskMeta } from "@zcode/shared";
import { useMemo } from "react";
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

  if (!worker || view.kind === "orchestrator") return null;

  const close = useAutonWorkerFocusStore.getState().close;
  const backToOrchestrator =
    view.kind === "worker-session" ||
    (view.kind === "worker-focus" && view.backToOrchestrator);
  const onBack = backToOrchestrator
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
      isDesktop={isDesktop}
      onBack={onBack}
      canGoBack={view.canGoBack}
      backLabel="Volver"
    />
  );
}
