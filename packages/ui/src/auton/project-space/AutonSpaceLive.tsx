import { useMemo } from "react";
import type { SessionLease } from "@/v4/sessionDataLayer.js";
import { useConversationProjection } from "@/v4/useConversationProjection.js";
import { useWorkspaceSessionsIndexItems } from "@/v4/useWorkspaceSessionsIndexItems.js";
import { useAutonClock } from "./clock.js";
import { AutonProjectSpace } from "./ProjectSpaceScreen.js";
import { projectAutonSpace } from "./projection.js";
import { agentTramo, projectAgentWorkers } from "./agentProjection.js";
import { mergeSessionWorkers } from "./sessionWorker.js";
import { useSessionWorkerConversations } from "./sessionWorkerConversations.js";
import type { AutonProject } from "./model.js";

export interface AutonSpaceLiveProps {
  /** Lease de la sesión del orquestador; de ahí salen las filas reales. */
  lease: SessionLease | null;
  project: AutonProject;
  now?: number;
  onBack: () => void;
  onStopWorker?: (workerId: string) => void;
  onSend?: (text: string) => void;
  showComposer?: boolean;
  backLabel?: string;
}

/**
 * El espacio del proyecto conectado a la sesión real: proyecta las filas del
 * orquestador y los subagentes al modelo de la superficie. No hay datos de
 * demostración en este camino.
 */
export function AutonSpaceLive({
  lease,
  project,
  now: injectedNow,
  onBack,
  onStopWorker,
  onSend,
  showComposer = true,
  backLabel,
}: AutonSpaceLiveProps) {
  const projection = useConversationProjection(lease);
  const rows = projection.snapshot?.rows.window ?? [];
  const now = useAutonClock(injectedNow);
  const agents = useWorkspaceSessionsIndexItems([{ workspacePath: project.path }]);
  const sessionWorkers = useSessionWorkerConversations(project.path);
  const data = useMemo(() => {
    const base = projectAutonSpace({ rows, now });
    // Transición: los agentes completos son los workers; los subagentes se
    // conservan como compatibilidad mientras existan.
    const agentWorkers = projectAgentWorkers(agents.items, now).filter(
      // El task del orquestador no es un worker: es quien dirige.
      (worker) => worker.id !== project.id,
    );
    const agentIds = new Set(agentWorkers.map((worker) => worker.id));
    const workers = [
      ...agentWorkers,
      ...base.workers.filter((worker) => !agentIds.has(worker.id)),
    ];
    const tramo = agentTramo(agentWorkers);
    return mergeSessionWorkers(
      {
        ...base,
        workers,
        tramos: tramo ? [tramo, ...base.tramos] : base.tramos,
      },
      sessionWorkers,
    );
  }, [agents.items, now, rows, sessionWorkers]);

  return (
    <AutonProjectSpace
      project={project}
      data={data}
      now={now}
      onBack={onBack}
      onStopWorker={onStopWorker ?? (() => undefined)}
      onSend={onSend}
      showComposer={showComposer}
      canStopWorkers={Boolean(onStopWorker)}
      {...(backLabel ? { backLabel } : {})}
    />
  );
}
