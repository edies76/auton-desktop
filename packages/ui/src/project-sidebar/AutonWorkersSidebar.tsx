import type { ProjectTask } from "@zcode/services";
import { useCallback, useMemo } from "react";
import { AutonWorkerPanel } from "@/auton/project-space/WorkerPanel.js";
import { projectAgentWorkers } from "@/auton/project-space/agentProjection.js";
import { useAutonClock } from "@/auton/project-space/clock.js";
import { useBaseWorkspaceServices } from "@/hooks/useWorkspaceServices.js";
import { logger } from "@/logger.js";
import type { ProjectSidebarProps } from "@/project-sidebar/contract.js";
import { useZCodeSessionStore } from "@/store/zcodeSessionStore.js";

export interface AutonWorkersSidebarProps {
  tasks: readonly ProjectTask[];
  workspacePath: string;
  workspaceIdentity?: string;
  onSelectTask: ProjectSidebarProps["onSelectTask"];
}

/**
 * Vista `workers` de la barra lateral existente: el proyecto activo muestra
 * su orquestador y, debajo, una fila viva por cada agente completo.
 */
export function AutonWorkersSidebar({
  tasks,
  workspacePath,
  workspaceIdentity,
  onSelectTask,
}: AutonWorkersSidebarProps) {
  const activeTaskId = useZCodeSessionStore(
    (state) =>
      state.getWorkspaceState(workspacePath, workspaceIdentity).activeTaskId,
  );
  const now = useAutonClock();
  const services = useBaseWorkspaceServices();

  const { orchestrator, workers, taskById } = useMemo(() => {
    const activeTask = tasks.find((task) => task.taskId === activeTaskId);
    const projectId =
      activeTask?.projectId ?? tasks.find((task) => !task.archived)?.projectId ?? null;
    const projectTasks = tasks
      .filter((task) => task.projectId === projectId && !task.archived)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    return {
      orchestrator: projectTasks[0],
      workers: projectAgentWorkers(projectTasks.slice(1), now),
      taskById: new Map(projectTasks.map((task) => [task.taskId, task])),
    };
  }, [activeTaskId, now, tasks]);

  const openWorker = useCallback(
    (workerId: string) => {
      const task = taskById.get(workerId);
      if (!task) return;
      onSelectTask(
        task.workspacePath,
        task.taskId,
        task.workspaceIdentity ?? workspaceIdentity,
      );
    },
    [onSelectTask, taskById, workspaceIdentity],
  );

  const stopWorker = useCallback(
    (workerId: string) => {
      const task = taskById.get(workerId);
      const service = services.zcodeTaskService;
      if (!service) return;
      void service
        .stopGeneration({
          taskId: workerId,
          workspacePath: task?.workspacePath ?? workspacePath,
          ...(task?.workspaceIdentity ?? workspaceIdentity
            ? { workspaceIdentity: task?.workspaceIdentity ?? workspaceIdentity }
            : {}),
        })
        .catch((error: unknown) => logger.warn("auton.worker.stop.failed", error));
    },
    [services, taskById, workspaceIdentity, workspacePath],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="auton-workers-sidebar">
      {orchestrator ? (
        <button
          type="button"
          data-testid="auton-orchestrator-row"
          className="mx-2 mb-1 flex min-w-0 flex-col rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() =>
            onSelectTask(
              orchestrator.workspacePath,
              orchestrator.taskId,
              orchestrator.workspaceIdentity ?? workspaceIdentity,
            )
          }
        >
          <span className="text-ui-xs font-medium uppercase tracking-wide text-foreground-subtlest">
            Orquestador
          </span>
          <span className="truncate text-ui-sm text-foreground">{orchestrator.title}</span>
        </button>
      ) : null}
      <div className="min-h-0 flex-1">
        <AutonWorkerPanel
          workers={workers}
          now={now}
          selectedWorkerId={activeTaskId ?? undefined}
          onOpenWorker={openWorker}
          onStopWorker={stopWorker}
        />
      </div>
    </div>
  );
}
