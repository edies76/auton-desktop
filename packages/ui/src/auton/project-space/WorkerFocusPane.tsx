import { ArrowLeft, Expand, Square } from "lucide-react";
import { useBaseWorkspaceServices } from "@/hooks/useWorkspaceServices.js";
import { logger } from "@/logger.js";
import { V4ChatPane } from "@/v4/V4ChatPane.js";
import { Button } from "@/components/ui/button.js";
import {
  AUTON_WORKER_STATUS_META,
  formatClock,
  formatWorkerSilence,
  isWorkerSilent,
  workerElapsed,
} from "./model.js";
import { useAutonWorkerFocusStore } from "./workerFocusStore.js";

export interface AutonWorkerFocusPaneProps {
  isDesktop?: boolean;
}

/**
 * El resumen del worker vive en el área del orquestador. Desde aquí se abre su
 * chat completo de solo lectura; el compositor del orquestador no se toca.
 */
export function AutonWorkerFocusPane({ isDesktop = false }: AutonWorkerFocusPaneProps) {
  const worker = useAutonWorkerFocusStore((state) => state.worker);
  const workspacePath = useAutonWorkerFocusStore((state) => state.workspacePath);
  const workspaceIdentity = useAutonWorkerFocusStore((state) => state.workspaceIdentity);
  const mode = useAutonWorkerFocusStore((state) => state.mode);
  const setMode = useAutonWorkerFocusStore((state) => state.setMode);
  const close = useAutonWorkerFocusStore((state) => state.close);
  const services = useBaseWorkspaceServices();

  if (!worker) return null;
  const meta = AUTON_WORKER_STATUS_META[worker.status];
  const now = Date.now();
  const silent = isWorkerSilent(worker, now);

  const stop = () => {
    const service = services.zcodeTaskService;
    if (!service) return;
    void service
      .stopGeneration({
        taskId: worker.id,
        workspacePath,
        ...(workspaceIdentity ? { workspaceIdentity } : {}),
      })
      .catch((error: unknown) => logger.warn("auton.worker.stop.failed", error));
  };

  if (mode === "chat") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background" data-testid="auton-worker-chat">
        <header className="flex shrink-0 items-center gap-2 border-border border-b px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("summary")}>
            <ArrowLeft className="size-3.5" />
            Resumen
          </Button>
          <span className="min-w-0 flex-1 truncate text-ui-sm font-medium text-foreground">
            {worker.name}
          </span>
          <span className="text-ui-sm text-foreground-subtlest">{meta.label}</span>
        </header>
        <div className="min-h-0 flex-1">
          <V4ChatPane
            workspacePath={workspacePath}
            {...(workspaceIdentity ? { workspaceIdentity } : {})}
            sessionId={worker.id}
            readOnly
            isDesktop={isDesktop}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="auton-worker-summary">
      <header className="flex shrink-0 items-center gap-2 border-border border-b px-3 py-2.5">
        <Button variant="ghost" size="sm" onClick={close} data-testid="auton-worker-focus-back">
          <ArrowLeft className="size-3.5" />
          Orquestador
        </Button>
        <span className="min-w-0 flex-1 truncate text-ui-sm font-medium text-foreground">
          {worker.name}
        </span>
        <span className="text-ui-sm text-foreground-subtlest">{meta.label}</span>
        {worker.status !== "terminado" ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground-subtle"
            onClick={stop}
            data-testid="auton-worker-focus-stop"
          >
            <Square className="size-3" />
            Parar
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => setMode("chat")}>
          <Expand className="size-3.5" />
          Ver chat completo
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto max-w-2xl">
          <p className="text-ui-xs uppercase tracking-wide text-foreground-subtlest">
            Estado actual
          </p>
          <p className="mt-1 flex items-center gap-2 text-ui-base text-foreground">
            <span className={silent ? "size-2 rounded-full bg-foreground-subtle animate-pulse" : "size-2 rounded-full bg-foreground-subtle"} />
            {meta.label}
            <span className="text-ui-sm text-foreground-subtlest">
              {silent
                ? formatWorkerSilence(worker.lastSignalAt, now)
                : formatClock(workerElapsed(worker, now))}
            </span>
          </p>

          <p className="mt-5 text-ui-xs uppercase tracking-wide text-foreground-subtlest">
            Resumen
          </p>
          <p className="mt-1 text-ui-sm leading-relaxed text-foreground-subtle">
            {worker.lastLine ?? "El worker todavía no dejó una señal."}
          </p>

          {worker.transcript.length > 0 ? (
            <ul className="mt-4 space-y-2" data-testid="auton-worker-focus-transcript">
              {worker.transcript.slice(-6).map((event) => (
                <li key={event.id} className="flex gap-2 text-ui-sm text-foreground-subtle">
                  <span className="shrink-0 text-ui-xs text-foreground-subtlest">
                    {formatClock(Math.max(0, event.at - worker.startedAt))}
                  </span>
                  <span className="min-w-0 flex-1">{event.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
