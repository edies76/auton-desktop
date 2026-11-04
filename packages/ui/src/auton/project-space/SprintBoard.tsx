import { ArrowLeft, FileCheck2, FolderGit2, ListTodo, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button.js";
import { AutonEvidenceInspector } from "./EvidenceInspector.js";
import type { AutonProject } from "./model.js";
import {
  AUTON_SPRINT_STATUS_META,
  groupSprints,
  summarizePlan,
  type AutonPlanFile,
  type AutonSprintItem,
} from "./planFile.js";
import { useAutonPlan } from "./useAutonPlan.js";

export interface AutonSprintBoardProps {
  project: AutonProject;
  plan: AutonPlanFile | null;
  loading?: boolean;
  onBack: () => void;
}

function SprintCard({
  item,
  selected,
  onSelect,
}: {
  item: AutonSprintItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const meta = AUTON_SPRINT_STATUS_META[item.status];
  const facts = [
    item.owner ? `dueño ${item.owner}` : undefined,
    item.effort ? `esfuerzo ${item.effort}` : undefined,
    item.mode ? `modo ${item.mode}` : undefined,
    item.engine ? `motor ${item.engine}` : undefined,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <li>
      <button
        type="button"
        data-testid="auton-sprint-card"
        data-sprint-id={item.id}
        data-status={item.status}
        aria-pressed={selected}
        onClick={() => onSelect(item.id)}
        className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-border-focused ${
          selected
            ? "border-border bg-selected"
            : "border-border bg-card hover:bg-surface-hover"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 shrink-0 rounded-full ${meta.dotClass}`} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-mono text-ui-xs text-foreground-subtlest">
            {item.id}
          </span>
          <span className="shrink-0 text-ui-xs text-foreground-subtlest">{meta.label}</span>
          {item.attempts > 0 ? (
            <span
              className="flex shrink-0 items-center gap-0.5 text-ui-xs tabular-nums text-foreground-subtlest"
              title={`${item.attempts} intentos`}
            >
              <RotateCcw className="size-2.5" aria-hidden="true" />
              {item.attempts}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 line-clamp-2 text-ui-sm font-medium leading-snug text-foreground">
          {item.title}
        </p>
        {facts.length > 0 ? (
          <p className="mt-1 text-ui-xs leading-relaxed break-words text-foreground-subtlest">
            {facts.join(" · ")}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-3 text-ui-xs tabular-nums text-foreground-subtlest">
          <span className="flex items-center gap-1" title="Evidencia declarada">
            <FileCheck2 className="size-3" aria-hidden="true" />
            {item.evidence.length}
          </span>
          <span className="flex items-center gap-1" title="Archivos declarados">
            <FolderGit2 className="size-3" aria-hidden="true" />
            {item.files.length}
          </span>
        </div>
      </button>
    </li>
  );
}

function BoardColumn({
  status,
  label,
  items,
  selectedId,
  onSelect,
}: {
  status: AutonSprintItem["status"];
  label: string;
  items: AutonSprintItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const meta = AUTON_SPRINT_STATUS_META[status];
  return (
    <section
      className="flex flex-col rounded-lg bg-secondary/40"
      data-testid={`auton-sprint-column-${status}`}
      data-count={items.length}
      aria-label={label}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={`size-1.5 shrink-0 rounded-full ${meta.dotClass}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-ui-sm font-medium text-foreground-subtle">
          {label}
        </span>
        <span className="shrink-0 text-ui-xs tabular-nums text-foreground-subtlest">
          {items.length}
        </span>
      </header>
      {items.length > 0 ? (
        <ul className="space-y-2 px-2 pb-2">
          {items.map((item) => (
            <SprintCard
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : (
        <p className="px-3 pt-1 pb-4 text-ui-xs text-foreground-subtlest">Sin sprints</p>
      )}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-foreground-subtlest">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </span>
  );
}

/**
 * El tablero del plan: una columna por estado, con el objetivo arriba y el
 * inspector de evidencia a la derecha. Lee el plan que el orquestador ya
 * escribió; no lo edita.
 */
export function AutonSprintBoard({
  project,
  plan,
  loading = false,
  onBack,
}: AutonSprintBoardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [goalDetailOpen, setGoalDetailOpen] = useState(false);
  const selected = useMemo(
    () => plan?.items.find((item) => item.id === selectedId) ?? null,
    [plan, selectedId],
  );
  const summary = useMemo(() => (plan ? summarizePlan(plan) : null), [plan]);
  const columns = useMemo(() => (plan ? groupSprints(plan) : []), [plan]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="auton-sprint-board">
      <header className="flex items-center gap-3 border-border border-b px-4 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="auton-sprint-board-back"
          aria-label="Volver al hilo"
        >
          <ArrowLeft className="size-3.5" />
          Hilo
        </Button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-ui-sm font-medium text-foreground">
            <ListTodo className="size-3.5 text-foreground-subtlest" aria-hidden="true" />
            Plan
          </p>
          <p className="truncate text-ui-xs text-foreground-subtlest">{project.path}</p>
        </div>
        {plan?.updatedAt ? (
          <p
            className="shrink-0 text-ui-xs tabular-nums text-foreground-subtlest"
            data-testid="auton-sprint-updated-at"
          >
            Actualizado {plan.updatedAt}
          </p>
        ) : null}
      </header>

      {loading ? (
        <div className="px-5 py-8" data-testid="auton-sprint-board-loading">
          <p className="text-ui-sm text-foreground-subtle">Leyendo el plan del proyecto…</p>
        </div>
      ) : !plan ? (
        <div className="px-5 py-10" data-testid="auton-sprint-board-empty">
          <div className="mx-auto max-w-md px-4 py-8 text-center">
            <p className="text-ui-sm font-medium text-foreground">
              Este proyecto no tiene plan todavía.
            </p>
            <p className="mt-1.5 text-ui-sm leading-relaxed text-foreground-subtle">
              El orquestador escribe <span className="font-mono text-ui-xs">.auton/plan.json</span>{" "}
              cuando convierte el objetivo en sprints.
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="border-border border-b px-5 py-4" data-testid="auton-sprint-goal">
            <p className="text-ui-xs text-foreground-subtlest">Objetivo</p>
            <p className="mt-1 text-ui-base font-medium text-foreground">
              {plan.goalTitle ?? "Sin título de objetivo"}
            </p>
            {plan.statement || plan.done.length > 0 || plan.constraints.length > 0 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1.5 -ml-2"
                  onClick={() => setGoalDetailOpen((open) => !open)}
                  aria-expanded={goalDetailOpen}
                  data-testid="auton-sprint-goal-toggle"
                >
                  {goalDetailOpen ? "Ocultar detalle" : "Ver detalle del objetivo"}
                </Button>
                {goalDetailOpen ? (
                  <div data-testid="auton-sprint-goal-detail">
                    {plan.statement ? (
                      <p className="mt-1 max-w-3xl text-ui-sm leading-relaxed text-foreground-subtle">
                        {plan.statement}
                      </p>
                    ) : null}
                    {plan.done.length > 0 ? (
                      <p className="mt-2 text-ui-xs leading-relaxed text-foreground-subtle">
                        <span className="text-foreground-subtlest">Se sabrá terminado por: </span>
                        {plan.done.join(" · ")}
                      </p>
                    ) : null}
                    {plan.constraints.length > 0 ? (
                      <p className="mt-1 text-ui-xs leading-relaxed text-foreground-subtle">
                        <span className="text-foreground-subtlest">Restricciones: </span>
                        {plan.constraints.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
            {summary ? (
              <div
                className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-ui-xs"
                data-testid="auton-sprint-summary"
              >
                <SummaryStat label="Total" value={summary.total} />
                <SummaryStat label="Activos" value={summary.running} />
                <SummaryStat label="Pendientes" value={summary.ready} />
                <SummaryStat label="Bloqueados" value={summary.blocked} />
                <SummaryStat label="No evaluables" value={summary.notEvaluable} />
                <SummaryStat label="Terminados" value={summary.done} />
                {plan.limitReportsCount > 0 ? (
                  <SummaryStat label="Reportes de límites" value={plan.limitReportsCount} />
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="flex min-h-0 flex-col gap-4 px-4 py-4">
            {/* Sin scroll horizontal ni inspector lateral que robe ancho:
                las 7 columnas usan todo el ancho y el inspector va debajo,
                a lo ancho, solo cuando se elige un sprint. */}
            <div
              className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-3 pb-2"
              data-testid="auton-sprint-columns"
            >
              {columns.map((column) => (
                <BoardColumn
                  key={column.status}
                  status={column.status}
                  label={column.label}
                  items={column.items}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
            <div data-testid="auton-sprint-inspector-below">
              <AutonEvidenceInspector item={selected} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** La variante viva: lee `.auton/plan.json` del proyecto. */
export function AutonSprintBoardLive({
  project,
  onBack,
}: {
  project: AutonProject;
  onBack: () => void;
}) {
  const { plan, loading } = useAutonPlan(project.path);
  return <AutonSprintBoard project={project} plan={plan} loading={loading} onBack={onBack} />;
}
