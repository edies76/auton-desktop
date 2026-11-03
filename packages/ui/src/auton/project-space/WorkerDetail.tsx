import { ArrowLeft, CheckCircle2, HelpCircle, MessageSquare, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import {
  AUTON_WORKER_STATUS_META,
  formatClock,
  formatWorkerSilence,
  isWorkerSilent,
  workerElapsed,
  type AutonWorkerEvent,
  type AutonWorkerView,
} from "./model.js";

const EVENT_ICON: Record<AutonWorkerEvent["kind"], typeof MessageSquare> = {
  message: MessageSquare,
  tool: Wrench,
  question: HelpCircle,
  close: CheckCircle2,
};

export interface AutonWorkerDetailProps {
  worker: AutonWorkerView;
  now: number;
  onBack: () => void;
}

/**
 * El detalle de un worker: su conversación y lo que hace en vivo.
 * Es de solo lectura; al worker no se le escribe.
 */
export function AutonWorkerDetail({ worker, now, onBack }: AutonWorkerDetailProps) {
  const meta = AUTON_WORKER_STATUS_META[worker.status];
  const silent = isWorkerSilent(worker, now);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="auton-worker-detail">
      <header className="flex items-center gap-3 border-border border-b px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="auton-worker-back"
          aria-label="Volver al hilo del orquestador"
        >
          <ArrowLeft className="size-3.5" />
          Atrás
        </Button>
        <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Wrench className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-ui-sm font-medium text-foreground">{worker.name}</p>
          <p className="text-ui-xs text-foreground-subtlest">
            Worker · {formatClock(workerElapsed(worker, now))}
          </p>
        </div>
        <Badge className={cn("rounded-sm", meta.badgeClass)} data-testid="auton-worker-detail-status">
          {meta.label}
        </Badge>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2">
          <span className={cn("size-1.5 shrink-0 rounded-full", meta.dotClass, silent && "animate-pulse")} />
          <p className="min-w-0 flex-1 truncate text-ui-xs text-foreground-subtle">
            {silent
              ? formatWorkerSilence(worker.lastSignalAt, now)
              : worker.lastLine ?? "Esperando la próxima señal del worker."}
          </p>
        </div>

        {worker.transcript.length === 0 ? (
          <p className="text-ui-sm text-foreground-subtlest">Sin actividad registrada todavía.</p>
        ) : (
          <ol className="space-y-2" data-testid="auton-worker-transcript">
            {worker.transcript.map((event) => {
              const Icon = EVENT_ICON[event.kind];
              return (
                <li key={event.id} className="flex gap-2" data-event-kind={event.kind}>
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Icon className="size-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ui-xs text-foreground-subtlest">
                      {formatClock(event.at - worker.startedAt)}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-ui-sm text-foreground">
                      {event.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="border-border border-t px-4 py-2">
        <p className="text-ui-xs text-foreground-subtlest">
          Solo lectura. El worker habla con el orquestador; tú le hablas al orquestador.
        </p>
      </div>
    </div>
  );
}
