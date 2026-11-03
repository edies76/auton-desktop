import type { ProjectTask } from "@zcode/services";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildAutonWorkerGroups,
  projectProjectAgentWorkers,
} from "@/auton/project-space/agentProjection.js";
import { useAutonClock } from "@/auton/project-space/clock.js";
import { projectAutonWorkers } from "@/auton/project-space/projection.js";
import { AutonWorkerDetail } from "@/auton/project-space/WorkerDetail.js";
import { AutonWorkerPanel } from "@/auton/project-space/WorkerPanel.js";
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
}

function AutonWorkersSidebarContents({
  tasks,
  workspacePath,
  workspaceIdentity,
}: AutonWorkersSidebarProps) {
  const activeTaskId = useZCodeSessionStore(
    (state) => state.getWorkspaceState(workspacePath, workspaceIdentity).activeTaskId,
  );
  const { layer } = useV4Conversation();
  const [lease, setLease] = useState<SessionLease | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
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
      orchestratorId: activeTaskId ?? ordered[0]?.taskId ?? null,
      projectTasks: ordered,
    };
  }, [activeTaskId, tasks]);

  useEffect(() => {
    if (!orchestratorId) {
      setLease(null);
      return;
    }
    const next = layer.acquire(orchestratorId);
    setLease(next);
    return () => next.release();
  }, [layer, orchestratorId]);

  const groups = useMemo(
    () =>
      buildAutonWorkerGroups({
        agentWorkers: projectProjectAgentWorkers(projectTasks, orchestratorId, now),
        subagentWorkers: projectAutonWorkers(rows, now),
      }),
    [now, orchestratorId, projectTasks, rows],
  );

  const selectedWorker = useMemo(() => {
    if (!selectedWorkerId) return undefined;
    for (const group of groups) {
      const worker = group.workers.find((item) => item.id === selectedWorkerId);
      if (worker) return worker;
    }
    return undefined;
  }, [groups, selectedWorkerId]);

  const stopWorker = useCallback(
    (workerId: string) => {
      const task = projectTasks.find((entry) => entry.taskId === workerId);
      const service = services.zcodeTaskService;
      if (!service || !task) return;
      void service
        .stopGeneration({
          taskId: workerId,
          workspacePath: task.workspacePath,
          ...(task.workspaceIdentity ? { workspaceIdentity: task.workspaceIdentity } : {}),
        })
        .catch((error: unknown) => logger.warn("auton.worker.stop.failed", error));
    },
    [projectTasks, services],
  );

  if (selectedWorker) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-testid="auton-worker-detail-pane">
        <AutonWorkerDetail
          worker={selectedWorker}
          now={now}
          onBack={() => setSelectedWorkerId(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="auton-workers-sidebar">
      <div className="min-h-0 flex-1">
        <AutonWorkerPanel
          groups={groups}
          now={now}
          selectedWorkerId={selectedWorkerId ?? undefined}
          onOpenWorker={setSelectedWorkerId}
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
