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
  const isMuse = worker.kind === "muse" || worker.engine === "muse";
  const readOnly = worker.kind === "subagent" || isMuse;
  const backButton = canGoBack ? (
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
  ) : null;
  if (isMuse) {
    return (
      <div
        className="relative flex h-full min-h-0 flex-col bg-background"
        data-testid="auton-worker-chat"
      >
        {backButton}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-16">
          <div className="flex items-center gap-2 text-ui-xs text-foreground-subtlest">
            <span className="rounded border border-border px-1.5 py-0.5 uppercase tracking-wide">
              Muse Code
            </span>
            <span>{worker.status}</span>
          </div>
          <h2 className="text-ui-xl font-semibold tracking-tight text-foreground">
            {worker.name}
          </h2>
          {worker.lastLine ? (
            <p className="text-ui-sm text-foreground-subtle">{worker.lastLine}</p>
          ) : null}
          <p className="text-ui-sm text-foreground-subtlest">
            Este worker corre en el motor Muse. Su chat completo se habilitará cuando el adaptador
            exponga la sesión.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-background"
      data-testid="auton-worker-chat"
    >
      {backButton}
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
