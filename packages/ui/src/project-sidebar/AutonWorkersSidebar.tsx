import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AutonWorkerPanel,
  buildAutonWorkerGroups,
  projectAutonWorkers,
  useAutonSubagentCounts,
  useAutonWorkerFocusStore,
  type AutonWorkerView,
} from "@/auton/index.js";
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
  workspacePath: string;
  workspaceIdentity?: string;
  workspaceRemoteSessionId?: string;
  orchestratorTaskId?: string | null;
}

function AutonWorkersSidebarContents({
  workspacePath,
  workspaceIdentity,
  workspaceRemoteSessionId,
  orchestratorTaskId,
}: AutonWorkersSidebarProps) {
  const activeTaskId = useZCodeSessionStore((state) => {
    const workspaceKey = workspaceIdentity?.trim() || workspacePath;
    return state.workspaces[workspaceKey]?.activeTaskId ?? null;
  });
  const { layer } = useV4Conversation();
  const [lease, setLease] = useState<SessionLease | null>(null);
  const [workerLease, setWorkerLease] = useState<SessionLease | null>(null);
  const focusedWorkerId = useAutonWorkerFocusStore((state) => state.selectedWorkerId);
  const listWorkerId = useAutonWorkerFocusStore((state) => state.listWorkerId);
  const projection = useConversationProjection(lease);
  const workerProjection = useConversationProjection(workerLease);
  const rows = projection.snapshot?.rows.window ?? [];
  const workerRows = listWorkerId ? (workerProjection.snapshot?.rows.window ?? []) : [];
  const services = useBaseWorkspaceServices();

  const { leaseTaskId, stopTaskId } = useMemo(
    () => ({
      // Leer la proyección puede caer en la sesión activa como respaldo, pero
      // parar pertenece solo al orquestador publicado.
      leaseTaskId: orchestratorTaskId ?? activeTaskId ?? null,
      stopTaskId: orchestratorTaskId ?? null,
    }),
    [activeTaskId, orchestratorTaskId],
  );

  // Solo filas: la lista se deriva sin reloj (el tiempo se pinta en las filas
  // del panel). Un tick no es una fuente de datos.
  const agentWorkers = useMemo(
    () => projectAutonWorkers(rows).filter((worker) => worker.kind === "agent"),
    [rows],
  );
  const subagentCounts = useAutonSubagentCounts({
    agents: agentWorkers,
    workspacePath,
    ...(workspaceIdentity ? { workspaceIdentity } : {}),
    ...(workspaceRemoteSessionId ? { remoteSessionId: workspaceRemoteSessionId } : {}),
    enabled: Boolean(leaseTaskId),
  });

  useEffect(() => {
    if (!leaseTaskId) {
      setLease(null);
      return;
    }
    const next = layer.acquire(leaseTaskId);
    setLease(next);
    return () => next.release();
  }, [layer, leaseTaskId]);

  useEffect(() => {
    if (!listWorkerId) {
      setWorkerLease(null);
      return;
    }
    const next = layer.acquire(listWorkerId);
    setWorkerLease(next);
    return () => next.release();
  }, [layer, listWorkerId]);

  const groups = useMemo(() => {
    const subagents = listWorkerId
      ? projectAutonWorkers(workerRows).filter((worker) => worker.kind !== "agent")
      : [];
    const agents = agentWorkers.map((worker) => {
      const liveCount = worker.id === listWorkerId ? subagents.length : undefined;
      const count = liveCount ?? subagentCounts[worker.id];
      return count === undefined ? worker : { ...worker, subagentCount: count };
    });
    const built = buildAutonWorkerGroups({
      agentWorkers: agents,
      subagentWorkers: subagents,
      canStop: Boolean(stopTaskId),
    });
    return listWorkerId
      ? built.filter((group) => group.kind !== "subagent" || group.workers.length > 0)
      : built.filter((group) => group.kind !== "subagent");
  }, [agentWorkers, listWorkerId, stopTaskId, subagentCounts, workerRows]);

  // Publicación coalescida: una ráfaga de cambios publica una vez con el último
  // estado (el store además ignora listas de contenido equivalente).
  const pendingWorkersRef = useRef<AutonWorkerView[] | null>(null);
  const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    pendingWorkersRef.current = groups.flatMap((group) => group.workers);
    if (publishTimerRef.current !== null) return;
    publishTimerRef.current = setTimeout(() => {
      publishTimerRef.current = null;
      const workers = pendingWorkersRef.current;
      if (workers) {
        useAutonWorkerFocusStore.getState().setLiveWorkers(workers);
      }
    }, 0);
  }, [groups]);
  useEffect(
    () => () => {
      if (publishTimerRef.current !== null) clearTimeout(publishTimerRef.current);
    },
    [],
  );

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

  const openSubagent = useCallback(
    (workerId: string) => {
      if (!listWorkerId) return;
      useAutonWorkerFocusStore
        .getState()
        .select(workerId, workspacePath, workspaceIdentity, listWorkerId);
    },
    [listWorkerId, workspaceIdentity, workspacePath],
  );

  const stopWorker = useCallback(
    () => {
      // Los workers son canales hijos del turno del orquestador; parar uno
      // interrumpe ese turno. Sin orquestador publicado no hay parada posible.
      const service = services.zcodeTaskService;
      if (!service || !stopTaskId) return;
      void service
        .stopGeneration({
          taskId: stopTaskId,
          workspacePath,
          ...(workspaceIdentity ? { workspaceIdentity } : {}),
        })
        .catch((error: unknown) => logger.warn("auton.worker.stop.failed", error));
    },
    [services, stopTaskId, workspaceIdentity, workspacePath],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="auton-workers-sidebar">
      <div className="min-h-0 flex-1">
        <AutonWorkerPanel
          groups={groups}
          selectedWorkerId={focusedWorkerId}
          onOpenWorker={openWorker}
          onOpenSubagent={openSubagent}
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
