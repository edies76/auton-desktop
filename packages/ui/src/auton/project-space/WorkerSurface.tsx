import type { ZCodeTaskMeta } from "@zcode/shared";
import { isWorkerSessionTaskId } from "@/project-sidebar/projectConversation.js";
import { AutonWorkerFocusPane } from "./WorkerFocusPane.js";
import { AutonWorkerSessionPane } from "./WorkerSessionPane.js";
import { useAutonWorkerFocusStore } from "./workerFocusStore.js";

export interface AutonWorkerSurfaceProps {
  activeTaskId: string | null;
  activeTaskTitle: string;
  activeTaskMeta?: ZCodeTaskMeta | null;
  workspacePath: string;
  workspaceIdentity?: string;
  isDesktop?: boolean;
  orchestratorTaskId: string | null;
  onSelectOrchestrator: () => void;
}

/** Condición que usa el shell para decidir si el centro es un worker. */
export function shouldRenderAutonWorkerSurface(
  activeTaskId: string | null,
  focusedWorkerId: string | null,
): boolean {
  return Boolean((activeTaskId && isWorkerSessionTaskId(activeTaskId)) || focusedWorkerId);
}

/**
 * La superficie del área central cuando el proyecto muestra un worker: una
 * sesión de worker abierta como tarea activa o el foco elegido en el panel.
 * Devuelve null cuando el centro debe ser el chat del orquestador.
 */
export function AutonWorkerSurface({
  activeTaskId,
  activeTaskTitle,
  activeTaskMeta,
  workspacePath,
  workspaceIdentity,
  isDesktop = false,
  orchestratorTaskId,
  onSelectOrchestrator,
}: AutonWorkerSurfaceProps) {
  const focusedWorker = useAutonWorkerFocusStore((state) => state.workerId);

  if (activeTaskId && isWorkerSessionTaskId(activeTaskId)) {
    return (
      <AutonWorkerSessionPane
        taskId={activeTaskId}
        title={activeTaskTitle}
        meta={activeTaskMeta}
        workspacePath={workspacePath}
        workspaceIdentity={workspaceIdentity}
        isDesktop={isDesktop}
        stopTaskId={orchestratorTaskId ?? undefined}
        canGoBack={Boolean(orchestratorTaskId)}
        {...(orchestratorTaskId ? { onBack: onSelectOrchestrator } : {})}
      />
    );
  }

  if (focusedWorker) {
    return <AutonWorkerFocusPane isDesktop={isDesktop} />;
  }

  return null;
}
