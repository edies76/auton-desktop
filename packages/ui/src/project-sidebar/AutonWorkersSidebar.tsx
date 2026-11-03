import type { ProjectTask } from "@zcode/services";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAutonWorkerGroups } from "@/auton/project-space/agentProjection.js";
import { useAutonClock } from "@/auton/project-space/clock.js";
import { projectAutonWorkers } from "@/auton/project-space/projection.js";
import { AutonWorkerPanel } from "@/auton/project-space/WorkerPanel.js";
import { useAutonWorkerFocusStore } from "@/auton/project-space/workerFocusStore.js";
import { useBaseWorkspaceServices } from "@/hooks/useWorkspaceServices.js";
import { logger } from "@/logger.js";
import { useZCodeSessionStore } from "@/store/zcodeSessionStore.js";
import type { SessionLease } from "@/v4/sessionDataLayer.js";
import {
  V4PaneConversationProvider,
  useV4Conversation,
} from "@/v4/V4ConversationContext.js";
import { useConversationProjection } from "@/v4/useConversationProjection.js";

export interface AutonWorkersSidebarProps {
  tasks: readonly ProjectTask[];
  workspacePath: string;
  workspaceIdentity?: string;
  workspaceRemoteSessionId?: string;
  orchestratorTaskId?: string | null;
}

function AutonWorkersSidebarContents({
  tasks,
  workspacePath,
  workspaceIdentity,
  orchestratorTaskId,
}: AutonWorkersSidebarProps) {
  const activeTaskId = useZCodeSessionStore((state) => {
    const workspaceKey = workspaceIdentity?.trim() || workspacePath;
    return state.workspaces[workspaceKey]?.activeTaskId ?? null;
  });
  const { layer } = useV4Conversation();
  const [lease, setLease] = useState<SessionLease | null>(null);
  const focusedWorkerId = useAutonWorkerFocusStore((state) => state.selectedWorkerId);
  const projection = useConversationProjection(lease);
  const rows = projection.snapshot?.rows.window ?? [];
  const now = useAutonClock();
  const services = useBaseWorkspaceServices();

  const { orchestratorId, projectTasks } = useMemo(() => {
    const activeTask = tasks.find((task) => task.taskId === activeTaskId);
    const projectId =
      activeTask?.projectId ?? tasks.find((task) => !task.archived)?.projectId ?? null;
    const ordered = tasks
      .filter((task) => task.projectId === projectId && !task.archived)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    return {
      // El orquestador es la sesión del humano o la conversación persistida
      // del proyecto; nunca se elige por “el task más reciente”.
      orchestratorId: activeTaskId ?? orchestratorTaskId ?? null,
      projectTasks: ordered,
    };
  }, [activeTaskId, orchestratorTaskId, tasks]);

  useEffect(() => {
    if (!orchestratorId) {
      setLease(null);
      return;
    }
    const next = layer.acquire(orchestratorId);
    setLease(next);
    return () => next.release();
  }, [layer, orchestratorId]);

  const groups = useMemo(() => {
    const conversationWorkers = projectAutonWorkers(rows, now);
    return buildAutonWorkerGroups({
      agentWorkers: conversationWorkers.filter((worker) => worker.kind === "agent"),
      subagentWorkers: conversationWorkers.filter((worker) => worker.kind !== "agent"),
      canStop: Boolean(orchestratorId),
    });
  }, [now, orchestratorId, rows]);

  useEffect(() => {
    useAutonWorkerFocusStore
      .getState()
      .setLiveWorkers(groups.flatMap((group) => group.workers));
  }, [groups]);

  const openWorker = useCallback(
    (workerId: string) => {
      for (const group of groups) {
        const worker = group.workers.find((item) => item.id === workerId);
        if (worker) {
          useAutonWorkerFocusStore
            .getState()
            .select(worker.id, workspacePath, workspaceIdentity);
          return;
        }
      }
    },
    [groups, workspaceIdentity, workspacePath],
  );

  const stopWorker = useCallback(
    () => {
      // Los workers son canales hijos del turno del orquestador; parar uno
      // interrumpe ese turno. Sin orquestador no hay parada posible.
      const service = services.zcodeTaskService;
      if (!service || !orchestratorId) return;
      void service
        .stopGeneration({
          taskId: orchestratorId,
          workspacePath,
          ...(workspaceIdentity ? { workspaceIdentity } : {}),
        })
        .catch((error: unknown) => logger.warn("auton.worker.stop.failed", error));
    },
    [orchestratorId, services, workspaceIdentity, workspacePath],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="auton-workers-sidebar">
      <div className="min-h-0 flex-1">
        <AutonWorkerPanel
          groups={groups}
          now={now}
          selectedWorkerId={focusedWorkerId}
          onOpenWorker={openWorker}
          onStopWorker={stopWorker}
          embedded
        />
      </div>
    </div>
  );
}

/**
 * Vista `workers` de la barra lateral existente: el proyecto activo muestra
 * sus canales de trabajo. El orquestador es el hilo del centro y no se lista.
 */
export function AutonWorkersSidebar(props: AutonWorkersSidebarProps) {
  const scope = useMemo(
    () => ({
      workspacePath: props.workspacePath,
      ...(props.workspaceIdentity ? { workspaceIdentity: props.workspaceIdentity } : {}),
      ...(props.workspaceRemoteSessionId
        ? { remoteSessionId: props.workspaceRemoteSessionId }
        : {}),
    }),
    [props.workspaceIdentity, props.workspacePath, props.workspaceRemoteSessionId],
  );
  return (
    <V4PaneConversationProvider scope={scope}>
      <AutonWorkersSidebarContents {...props} />
    </V4PaneConversationProvider>
  );
}
