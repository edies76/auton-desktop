import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AutonSprintBoardLive,
  AutonWorkerPanel,
  buildAutonWorkerGroups,
  projectAutonWorkers,
  projectSessionWorkerView,
  useAutonClock,
  useAutonSubagentCounts,
  useAutonWorkerFocusStore,
  useSessionWorkerConversations,
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
  const [showPlan, setShowPlan] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);
  const planCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planProject = useMemo(
    () => ({
      id: workspacePath,
      name: workspacePath.split(/[\\/]/).filter(Boolean).at(-1) ?? workspacePath,
      path: workspacePath,
      lastActiveAt: 0,
    }),
    [workspacePath],
  );
  // El tablero no cabe en los 264px del sidebar: se desliza desde su borde
  // derecho como panel expansible (portal, para escapar del overflow del
  // sidebar) con transicion de ancho. El shell conserva su ancho; el panel
  // se cierra con la misma animacion en reversa.
  useEffect(() => {
    if (!showPlan) return;
    setPlanExpanded(false);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPlanExpanded(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [showPlan]);

  useEffect(
    () => () => {
      if (planCloseTimer.current) clearTimeout(planCloseTimer.current);
    },
    [],
  );

  const openPlan = useCallback(() => {
    if (planCloseTimer.current) clearTimeout(planCloseTimer.current);
    setShowPlan(true);
  }, []);

  const closePlan = useCallback(() => {
    setPlanExpanded(false);
    if (planCloseTimer.current) clearTimeout(planCloseTimer.current);
    planCloseTimer.current = setTimeout(() => setShowPlan(false), 280);
  }, []);

  const togglePlan = useCallback(() => {
    if (showPlan) closePlan();
    else openPlan();
  }, [closePlan, openPlan, showPlan]);

  // Clic fuera del panel o Escape: se repliega con la misma animacion.
  useEffect(() => {
    if (!showPlan) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePlan();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePlan, showPlan]);

  const planPanel = showPlan
    ? (() => {
        const sidebarRight =
          typeof document !== "undefined"
            ? (document
                .querySelector('[data-testid="sidebar"]')
                ?.getBoundingClientRect().right ?? 264)
            : 264;
        const targetWidth =
          typeof window !== "undefined"
            ? Math.max(320, Math.min(1480, window.innerWidth - sidebarRight - 16))
            : 1480;
        return createPortal(
          <>
            {/* Captura el clic fuera del panel para replegarlo. */}
            <div
              className="fixed inset-0 z-30"
              data-testid="auton-workers-sidebar-plan-backdrop"
              onClick={closePlan}
              aria-hidden="true"
            />
            <div
              className="fixed inset-y-0 z-40 overflow-hidden border-r border-border bg-background shadow-2xl transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ left: sidebarRight, width: planExpanded ? targetWidth : 0 }}
              data-testid="auton-workers-sidebar-plan"
              aria-hidden={!planExpanded}
            >
              <div className="h-full" style={{ width: targetWidth }}>
                <AutonSprintBoardLive project={planProject} onBack={closePlan} />
              </div>
            </div>
          </>,
          document.body,
        );
      })()
    : null;

  const projection = useConversationProjection(lease);
  const workerProjection = useConversationProjection(workerLease);
  const rows = projection.snapshot?.rows.window ?? [];
  const workerRows = listWorkerId ? (workerProjection.snapshot?.rows.window ?? []) : [];
  const now = useAutonClock();
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

  // Los workers en modo sesión no aparecen como filas de subagente en la
  // conversación del orquestador: viven en `.auton/workers/index.json`.
  // Sin leer ese índice el panel decía 0 aunque hubiera workers corriendo.
  const sessionWorkers = useSessionWorkerConversations(workspacePath);
  const agentWorkers = useMemo(() => {
    const fromConversation = projectAutonWorkers(rows, now).filter(
      (worker) => worker.kind === "agent",
    );
    const known = new Set(fromConversation.map((worker) => worker.id));
    const fromIndex = sessionWorkers
      .map((snapshot) => ({
        ...projectSessionWorkerView(snapshot),
        kind: "agent" as const,
        engine: "zcode" as const,
      }))
      .filter((worker) => !known.has(worker.id));
    return [...fromConversation, ...fromIndex];
  }, [now, rows, sessionWorkers]);
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
      ? projectAutonWorkers(workerRows, now).filter((worker) => worker.kind !== "agent")
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
  }, [agentWorkers, listWorkerId, now, stopTaskId, subagentCounts, workerRows]);

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
          now={now}
          selectedWorkerId={focusedWorkerId}
          onOpenWorker={openWorker}
          onOpenSubagent={openSubagent}
          onStopWorker={stopWorker}
          onOpenPlan={togglePlan}
          planActive={showPlan}
          embedded
        />
      </div>
      {planPanel}
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
