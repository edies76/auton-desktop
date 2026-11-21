import { useMemo } from "react";
import type { SessionLease } from "@/v4/sessionDataLayer.js";
import { useConversationProjection } from "@/v4/useConversationProjection.js";
import { useWorkspaceSessionsIndexItems } from "@/v4/useWorkspaceSessionsIndexItems.js";
import { useAutonClock } from "./clock.js";
import { AutonProjectSpace } from "./ProjectSpaceScreen.js";
import { createAutonSpaceProducer } from "./spaceProducer.js";
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
 *
 * El reloj NO es entrada de la composición: `now` solo viaja a las hojas que
 * pintan tiempos. Con las mismas filas/agentes/snapshots, el productor devuelve
 * el mismo objeto y un tick o un chunk sin cambios no recompone la pantalla.
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
  const produce = useMemo(() => createAutonSpaceProducer(project.id), [project.id]);
  const data = useMemo(
    () => produce({ rows, agents: agents.items, sessionWorkers }),
    [produce, agents.items, rows, sessionWorkers],
  );

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
