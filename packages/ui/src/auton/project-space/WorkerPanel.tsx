import { useState } from "react";
import {
  CheckCircle2Icon,
  ChevronDown,
  CircleAlertIcon,
  GitBranch,
  LoaderCircleIcon,
  PauseCircleIcon,
  Square,
} from "lucide-react";
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
  selectedWorkerId?: string | null;
  onOpenWorker: (workerId: string) => void;
  onOpenSubagent?: (workerId: string) => void;
  onStopWorker: (workerId: string) => void;
  /** En un panel de solo lectura no se ofrece una parada que no puede ejecutarse. */
  canStop?: boolean;
  /** Dentro del sidebar existente no pinta otra superficie ni borde propio. */
  embedded?: boolean;
}

function WorkerStatusIcon({ status }: { status: AutonWorkerView["status"] }) {
  const className = "size-4 shrink-0 text-foreground-subtle";
  switch (status) {
    case "trabajando":
      return <LoaderCircleIcon aria-hidden className={`${className} animate-spin`} />;
    case "terminado":
      return <CheckCircle2Icon aria-hidden className={className} />;
    case "bloqueado":
      return <CircleAlertIcon aria-hidden className={className} />;
    case "preguntando":
    case "esperando":
      return <PauseCircleIcon aria-hidden className={className} />;
  }
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
      title={worker.lastLine ?? meta.label}
      className={cn(
        "group/worker-row flex min-h-7 w-full min-w-0 items-center rounded-lg border border-transparent pl-2.5 pr-1 py-1 text-ui-base transition-colors",
        selected ? "bg-selected" : "hover:bg-surface-hover",
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-border-focused"
        onClick={() => onOpenWorker(worker.id)}
        aria-label={`Abrir ${worker.name}`}
        title={worker.name}
        data-testid="auton-worker-open"
      >
        <WorkerStatusIcon status={worker.status} />
        <span className="min-w-0 flex-1 truncate text-ui-base text-foreground">{worker.name}</span>
        {worker.kind === "muse" || worker.engine === "muse" ? (
          <span
            className="shrink-0 rounded border border-border px-1 py-0.5 text-ui-xs uppercase tracking-wide text-foreground-subtlest"
            data-testid="auton-worker-muse-badge"
          >
            Muse
          </span>
        ) : null}
      </button>
      <span className="ml-2 flex shrink-0 items-center gap-1.5 text-ui-xs text-foreground-subtle">
        {(worker.subagentCount ?? 0) > 0 ? (
          <span
            className="flex items-center gap-0.5 tabular-nums text-foreground-subtlest"
            data-testid="auton-worker-subagent-count"
            title={`${worker.subagentCount} subagentes`}
          >
            <GitBranch className="size-3" aria-hidden="true" />
            {worker.subagentCount}
          </span>
        ) : null}
        {silent ? (
          <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground animate-pulse" />
        ) : null}
        <span
          className="shrink-0 tabular-nums"
          data-testid="auton-worker-clock"
          title={silent ? formatWorkerSilence(worker.lastSignalAt, now) : meta.label}
        >
          {formatClock(workerElapsed(worker, now))}
        </span>
        <span data-testid="auton-worker-status" data-status={worker.status} className="sr-only">
          {meta.label}
        </span>
        {silent ? (
          <span
            className="sr-only animate-pulse"
            data-testid="auton-worker-silence"
          >
            {formatWorkerSilence(worker.lastSignalAt, now)}
          </span>
        ) : null}
      </span>
      {canStop && worker.status !== "terminado" && worker.status !== "bloqueado" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-1 size-6 shrink-0 text-foreground-subtlest opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/worker-row:opacity-100"
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

function GroupHeader({
  label,
  count,
  expanded,
  onToggle,
  testId,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-expanded={expanded}
      onClick={onToggle}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-left text-ui-base font-medium text-foreground-subtle transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-input-border-focused"
    >
      <ChevronDown
        className={cn("size-3.5 shrink-0 transition-transform", !expanded && "-rotate-90")}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-ui-sm tabular-nums text-foreground-subtlest">{count}</span>
    </button>
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
  onOpenSubagent,
  onStopWorker,
  canStop = true,
  embedded = false,
}: AutonWorkerPanelProps) {
  const total = groups
    ? groups.reduce((count, group) => count + group.workers.length, 0)
    : workers.length;
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = (kind: string) => {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

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
      <header className="flex items-center gap-1 px-2 pb-1 pt-1">
        <button
          type="button"
          data-testid="auton-workers-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-ui-base font-medium text-foreground-subtle transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-input-border-focused"
        >
          <ChevronDown
            className={cn("size-3.5 shrink-0 transition-transform", collapsed && "-rotate-90")}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">Workers</span>
          <span
            className="shrink-0 text-ui-sm tabular-nums text-foreground-subtlest"
            data-testid="auton-worker-count"
          >
            {total}
          </span>
        </button>
      </header>

      {collapsed ? null : total === 0 ? (
        <p className="px-3 py-3 text-ui-sm text-foreground-subtlest">
          Sin workers todavía. El orquestador abre uno cuando reparte trabajo.
        </p>
      ) : groups ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-1.5"
          data-testid="auton-worker-list"
        >
          {groups.map((group) => {
            const expanded = !collapsedGroups.has(group.kind);
            return (
              <section key={group.kind} data-testid={`auton-worker-group-${group.kind}`}>
                <GroupHeader
                  label={group.label}
                  count={group.workers.length}
                  expanded={expanded}
                  onToggle={() => toggleGroup(group.kind)}
                  testId={`auton-worker-group-toggle-${group.kind}`}
                />
                {expanded && group.workers.length > 0 ? (
                  <ul className="px-1.5">
                    {group.workers.map((worker) => (
                      <WorkerRow
                        key={worker.id}
                        worker={worker}
                        now={now}
                        selected={selectedWorkerId === worker.id}
                        canStop={group.canStop ?? canStop}
                        onOpenWorker={
                          group.kind === "subagent"
                            ? (onOpenSubagent ?? onOpenWorker)
                            : onOpenWorker
                        }
                        onStopWorker={onStopWorker}
                      />
                    ))}
                  </ul>
                ) : expanded ? (
                  <p className="px-3 py-1 text-ui-sm text-foreground-subtlest">
                    {group.kind === "muse"
                      ? "Sin workers Muse."
                      : group.kind === "subagent"
                        ? "Sin subagentes"
                        : "Sin workers todavía."}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <ul
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5"
          data-testid="auton-worker-list"
        >
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
