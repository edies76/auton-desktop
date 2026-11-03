import { Square, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import {
  AUTON_WORKER_STATUS_META,
  formatClock,
  formatWorkerSilence,
  isWorkerSilent,
  workerElapsed,
  type AutonWorkerView,
} from "./model.js";

export interface AutonWorkerPanelProps {
  workers: readonly AutonWorkerView[];
  now: number;
  selectedWorkerId?: string;
  onOpenWorker: (workerId: string) => void;
  onStopWorker: (workerId: string) => void;
  /** En un panel de solo lectura no se ofrece una parada que no puede ejecutarse. */
  canStop?: boolean;
}

/**
 * El panel izquierdo del espacio del proyecto: una fila por worker, en vivo.
 * El orquestador no vive aquí; él es la conversación del centro.
 */
export function AutonWorkerPanel({
  workers,
  now,
  selectedWorkerId,
  onOpenWorker,
  onStopWorker,
  canStop = true,
}: AutonWorkerPanelProps) {
  return (
    <aside
      className="flex h-full min-h-0 flex-col border-border border-r bg-card/40"
      data-testid="auton-worker-panel"
      aria-label="Workers"
    >
      <header className="flex items-center justify-between gap-2 border-border border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Wrench className="size-3" />
          </span>
          <h2 className="text-ui-xs font-medium uppercase tracking-wide text-foreground-subtle">
            Workers
          </h2>
        </div>
        <span className="text-ui-xs text-foreground-subtlest" data-testid="auton-worker-count">
          {workers.length}
        </span>
      </header>

      {workers.length === 0 ? (
        <p className="px-3 py-4 text-ui-xs text-foreground-subtlest">
          Sin workers todavía. El orquestador abre uno cuando reparte trabajo.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-1.5" data-testid="auton-worker-list">
          {workers.map((worker) => {
            const meta = AUTON_WORKER_STATUS_META[worker.status];
            const silent = isWorkerSilent(worker, now);
            const selected = selectedWorkerId === worker.id;

            return (
              <li
                key={worker.id}
                data-testid="auton-worker-row"
                data-worker-id={worker.id}
                data-status={worker.status}
                data-role="worker"
                data-silent={silent ? "true" : "false"}
                className={cn(
                  "flex w-full items-start gap-1 overflow-hidden rounded-md px-1.5 py-1.5 transition-colors",
                  selected ? "bg-muted/70" : "hover:bg-muted/40",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  onClick={() => onOpenWorker(worker.id)}
                  aria-label={`Abrir ${worker.name}`}
                  data-testid="auton-worker-open"
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Wrench className="size-3" />
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-ui-sm text-foreground">{worker.name}</span>
                      <span className="shrink-0 text-ui-xs text-foreground-subtlest tabular-nums" data-testid="auton-worker-clock">
                        {formatClock(workerElapsed(worker, now))}
                      </span>
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
                      <Badge
                        data-testid="auton-worker-status"
                        data-status={worker.status}
                        className={cn("h-4 rounded-sm px-1.5 text-ui-xs", meta.badgeClass)}
                      >
                        {meta.label}
                      </Badge>
                      <span
                        className={cn("size-1.5 rounded-full", meta.dotClass, silent && "animate-pulse")}
                        aria-hidden="true"
                      />
                    </span>
                    {silent ? (
                      <span
                        className="mt-0.5 block text-ui-xs text-amber-600 animate-pulse dark:text-amber-300"
                        data-testid="auton-worker-silence"
                      >
                        {formatWorkerSilence(worker.lastSignalAt, now)}
                      </span>
                    ) : worker.lastLine ? (
                      <span className="mt-0.5 block truncate text-ui-xs text-foreground-subtlest">
                        {worker.lastLine}
                      </span>
                    ) : null}
                  </span>
                </button>
                {canStop ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-foreground-subtlest hover:text-destructive"
                    aria-label={`Parar ${worker.name}`}
                    data-testid="auton-worker-stop"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStopWorker(worker.id);
                    }}
                  >
                    <Square className="size-3" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
