import { ChevronDown, ChevronRight, Workflow } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge.js";
import { cn } from "@/components/lib/utils.js";
import {
  AUTON_WORKER_STATUS_META,
  formatClock,
  formatTramoDuration,
  workerElapsed,
  type AutonWorkTramo,
  type AutonWorkerView,
} from "./model.js";

export interface AutonWorkBlockProps {
  tramo: AutonWorkTramo;
  workers: readonly AutonWorkerView[];
  now: number;
}

/**
 * Bloque de trabajo dentro del hilo: los workers de este tramo, con su reloj.
 * La cabecera es el tiempo del tramo; el cuerpo se expande y se contrae.
 */
export function AutonWorkBlock({ tramo, workers, now }: AutonWorkBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const inTramo = tramo.workerIds
    .map((id) => workers.find((worker) => worker.id === id))
    .filter((worker): worker is AutonWorkerView => Boolean(worker));

  return (
    <section
      className="animate-in fade-in-0 slide-in-from-bottom-1 overflow-hidden rounded-lg border border-border bg-card/60 duration-200"
      data-testid="auton-work-block"
      data-expanded={expanded ? "true" : "false"}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        data-testid="auton-work-block-toggle"
      >
        <span className="flex size-5 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Workflow className="size-3" />
        </span>
        <span className="text-ui-sm font-medium text-foreground">Trabajo</span>
        <span className="text-ui-xs text-foreground-subtlest tabular-nums" data-testid="auton-work-block-clock">
          {formatTramoDuration(tramo, now)}
        </span>
        <span className="min-w-0 flex-1" />
        <span className="text-ui-xs text-foreground-subtlest">
          {inTramo.length === 1 ? "1 worker" : `${inTramo.length} workers`}
        </span>
        {expanded ? (
          <ChevronDown className="size-3.5 text-foreground-subtlest" />
        ) : (
          <ChevronRight className="size-3.5 text-foreground-subtlest" />
        )}
      </button>

      {expanded ? (
        <ul className="divide-y divide-border border-border border-t" data-testid="auton-work-block-workers">
          {inTramo.map((worker) => {
            const meta = AUTON_WORKER_STATUS_META[worker.status];
            return (
              <li key={worker.id} className="flex items-center gap-2 px-3 py-2">
                <span className={cn("size-1.5 shrink-0 rounded-full", meta.dotClass)} />
                <span className="shrink-0 text-ui-sm text-foreground">{worker.name}</span>
                <Badge className={cn("h-4 shrink-0 rounded-sm px-1.5 text-ui-xs", meta.badgeClass)}>
                  {meta.label}
                </Badge>
                <span className="shrink-0 text-ui-xs text-foreground-subtlest tabular-nums">
                  {formatClock(workerElapsed(worker, now))}
                </span>
                {worker.lastLine ? (
                  <span className="hidden min-w-0 flex-1 truncate text-right text-ui-xs text-foreground-subtlest md:block">
                    {worker.lastLine}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
