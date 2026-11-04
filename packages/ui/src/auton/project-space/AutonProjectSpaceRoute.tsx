import { useEffect, useState } from "react";
import type { SessionLease } from "@/v4/sessionDataLayer.js";
import { V4PaneConversationProvider, useV4Conversation } from "@/v4/V4ConversationContext.js";
import { AutonSpaceLive } from "./AutonSpaceLive.js";
import { useAutonClock } from "./clock.js";
import { emptySpaceData, type AutonProject } from "./model.js";
import { AutonProjectSpace } from "./ProjectSpaceScreen.js";

export interface AutonProjectSpaceRouteProps {
  project: AutonProject;
  sessionId: string;
  onBack: () => void;
}

function LeaseSpace({
  project,
  sessionId,
  onBack,
}: AutonProjectSpaceRouteProps) {
  const { layer } = useV4Conversation();
  const [lease, setLease] = useState<SessionLease | null>(null);

  useEffect(() => {
    const next = layer.acquire(sessionId);
    setLease(next);
    return () => next.release();
  }, [layer, sessionId]);

  return (
    <AutonSpaceLive
      lease={lease}
      project={project}
      onBack={onBack}
      showComposer={false}
      backLabel="Proyectos"
    />
  );
}

/**
 * El espacio del proyecto en el área principal: conecta la sesión activa v4 y
 * monta la superficie con el panel de workers a la izquierda.
 */
/**
 * Espacio sin sesión: el proyecto aún no tiene hilo del orquestador, pero su
 * plan en disco ya se puede ver. Sin compositor ni workers que parar; el
 * tablero lee `.auton/plan.json` del workspace.
 */
export function AutonProjectSpaceWithoutSession({
  project,
  onBack,
}: {
  project: AutonProject;
  onBack: () => void;
}) {
  const now = useAutonClock();
  return (
    <AutonProjectSpace
      project={project}
      data={emptySpaceData()}
      now={now}
      onBack={onBack}
      onStopWorker={() => undefined}
      showComposer={false}
      canStopWorkers={false}
      backLabel="Proyectos"
    />
  );
}

export function AutonProjectSpaceRoute(props: AutonProjectSpaceRouteProps) {
  return (
    <V4PaneConversationProvider
      scope={{ workspacePath: props.project.path }}
      sessionId={props.sessionId}
    >
      <LeaseSpace {...props} />
    </V4PaneConversationProvider>
  );
}
