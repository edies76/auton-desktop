import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { V4ChatPane } from "@/v4/V4ChatPane.js";
import type { AutonWorkerView } from "./model.js";

export interface AutonWorkerFocusPaneProps {
  worker: AutonWorkerView;
  workspacePath: string;
  workspaceIdentity?: string;
  isDesktop?: boolean;
  onBack: () => void;
  canGoBack?: boolean;
  backLabel?: string;
}

/**
 * Conversación completa del worker o subagente, sin resumen ni cabecera
 * separadora. La vuelta es un botón flotante sobre el chat nativo.
 *
 * Un worker es un agente ZCode completo: conserva el compositor, el modelo,
 * los permisos y las acciones normales del chat. Un subagente se observa, no
 * se controla desde aquí.
 */
export function AutonWorkerFocusPane({
  worker,
  workspacePath,
  workspaceIdentity,
  isDesktop = false,
  onBack,
  canGoBack = true,
  backLabel = "Volver",
}: AutonWorkerFocusPaneProps) {
  const readOnly = worker.kind === "subagent" || worker.kind === "muse";
  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-background"
      data-testid="auton-worker-chat"
    >
      {canGoBack ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onBack}
          data-testid="auton-worker-focus-back"
          className="absolute left-3 top-3 z-20 gap-1 rounded-full border border-border bg-background/85 px-2.5 shadow-sm backdrop-blur hover:bg-background"
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Button>
      ) : null}
      <div className="min-h-0 flex-1">
        <V4ChatPane
          workspacePath={workspacePath}
          {...(workspaceIdentity ? { workspaceIdentity } : {})}
          sessionId={worker.id}
          readOnly={readOnly}
          isDesktop={isDesktop}
        />
      </div>
    </div>
  );
}
