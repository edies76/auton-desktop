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
  type AutonWorkerGroup,
  type AutonWorkerView,
} from "./model.js";

export interface AutonWorkerPanelProps {
  /** Lista plana (espacio del proyecto). */
  workers?: readonly AutonWorkerView[];
  /** Canales agrupados por rol/motor (sidebar del proyecto). */
  groups?: readonly AutonWorkerGroup[];
  now: number;
  selectedWorkerId?: string;
  onOpenWorker: (workerId: string) => void;
  onStopWorker: (workerId: string) => void;
  /** En un panel de solo lectura no se ofrece una parada que no puede ejecutarse. */
  canStop?: boolean;
  /** Dentro del sidebar existente no pinta otra superficie ni borde propio. */
  embedded?: boolean;
}

function WorkerRow({
  worker,
  now,
  selected,
  canStop,
  onOpenWorker,
  onStopWorker,
}: {
  worker: AutonWorkerView;
  now: number;
  selected: boolean;
  canStop: boolean;
  onOpenWorker: (workerId: string) => void;
  onStopWorker: (workerId: string) => void;
}) {
  const meta = AUTON_WORKER_STATUS_META[worker.status];
  const silent = isWorkerSilent(worker, now);

  return (
    <li
      data-testid="auton-worker-row"
      data-worker-id={worker.id}
      data-worker-kind={worker.kind ?? "agent"}
      data-status={worker.status}
      data-role="worker"
      data-silent={silent ? "true" : "false"}
      className={cn(
        "flex w-full min-w-0 items-start gap-2 overflow-hidden rounded-lg px-2 py-2.5 transition-colors",
        selected ? "bg-selected" : "hover:bg-surface-hover",
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onClick={() => onOpenWorker(worker.id)}
        aria-label={`Abrir ${worker.name}`}
        data-testid="auton-worker-open"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/40 text-foreground-subtle">
          <Wrench className="size-4" />
        </span>
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-ui-base font-medium text-foreground">
              {worker.name}
            </span>
            <span className="shrink-0 text-ui-sm text-foreground-subtlest tabular-nums" data-testid="auton-worker-clock">
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
            <span className="mt-0.5 block truncate text-ui-sm text-foreground-subtle">
              {worker.lastLine}
            </span>
          ) : null}
        </span>
      </button>
      {canStop && worker.status !== "terminado" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-foreground-subtlest hover:text-destructive"
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
}

/**
 * El panel izquierdo del proyecto: una fila por worker, en vivo.
 * El orquestador no vive aquí; él es la conversación del centro.
 */
export function AutonWorkerPanel({
  workers = [],
  groups,
  now,
  selectedWorkerId,
  onOpenWorker,
  onStopWorker,
  canStop = true,
  embedded = false,
}: AutonWorkerPanelProps) {
  const total = groups ? groups.reduce((count, group) => count + group.workers.length, 0) : workers.length;

  return (
    <aside
      className={
        embedded
          ? "flex h-full min-h-0 flex-col bg-transparent"
          : "flex h-full min-h-0 flex-col border-border border-r bg-card/40"
      }
      data-testid="auton-worker-panel"
      aria-label="Workers"
    >
      <header className="flex items-center justify-between gap-2 border-border border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Wrench className="size-3" />
          </span>
          <h2 className="text-ui-base font-semibold text-foreground">Workers</h2>
        </div>
        <span className="text-ui-sm text-foreground-subtlest" data-testid="auton-worker-count">
          {total}
        </span>
      </header>

      {total === 0 ? (
        <p className="px-3 py-4 text-ui-sm text-foreground-subtlest">
          Sin workers todavía. El orquestador abre uno cuando reparte trabajo.
        </p>
      ) : groups ? (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-1.5" data-testid="auton-worker-list">
          {groups.map((group) => (
            <section
              key={group.kind}
              data-testid={`auton-worker-group-${group.kind}`}
              className="pt-1.5"
            >
              <h3 className="flex items-center justify-between px-2.5 pb-1 text-ui-sm font-medium text-foreground-subtlest">
                <span>{group.label}</span>
                <span className="tabular-nums">{group.workers.length}</span>
              </h3>
              {group.workers.length > 0 ? (
                <ul className="space-y-0.5 px-1.5">
                  {group.workers.map((worker) => (
                    <WorkerRow
                      key={worker.id}
                      worker={worker}
                      now={now}
                      selected={selectedWorkerId === worker.id}
                      canStop={group.canStop ?? canStop}
                      onOpenWorker={onOpenWorker}
                      onStopWorker={onStopWorker}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-2.5 py-1 text-ui-sm text-foreground-subtlest">
                  {group.kind === "muse" ? "Próximamente" : "Sin workers todavía."}
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-1.5" data-testid="auton-worker-list">
          {workers.map((worker) => (
            <WorkerRow
              key={worker.id}
              worker={worker}
              now={now}
              selected={selectedWorkerId === worker.id}
              canStop={canStop}
              onOpenWorker={onOpenWorker}
              onStopWorker={onStopWorker}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
