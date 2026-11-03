import { useEffect, useState } from "react";
import type { SessionLease } from "@/v4/sessionDataLayer.js";
import { V4PaneConversationProvider, useV4Conversation } from "@/v4/V4ConversationContext.js";
import { AutonSpaceLive } from "./AutonSpaceLive.js";
import type { AutonProject } from "./model.js";

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
