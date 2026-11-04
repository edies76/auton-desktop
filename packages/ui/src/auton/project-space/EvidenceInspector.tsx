import { FileCheck2, HelpCircle, ListChecks, RotateCcw } from "lucide-react";
import { AUTON_SPRINT_STATUS_META, type AutonSprintItem } from "./planFile.js";

export interface AutonEvidenceInspectorProps {
  item: AutonSprintItem | null;
}

/**
 * La prueba de un sprint, sin adornos: qué se pretendía, qué archivos toca,
 * qué evidencia declaró y qué sigue sin demostrarse. Si no hay evidencia, se
 * dice; el inspector no la inventa.
 */
export function AutonEvidenceInspector({ item }: AutonEvidenceInspectorProps) {
  if (!item) {
    return (
      <aside
        className="flex h-full min-h-0 flex-col border-border border-l bg-card/40"
        data-testid="auton-evidence-inspector"
        data-empty="true"
        aria-label="Inspector de evidencia"
      >
        <header className="border-border border-b px-4 py-3">
          <p className="text-ui-sm font-medium text-foreground">Evidencia</p>
          <p className="text-ui-xs text-foreground-subtlest">Elige un sprint del tablero.</p>
        </header>
        <p className="px-4 py-4 text-ui-sm text-foreground-subtle">
          El inspector muestra el requisito, los archivos, la evidencia declarada y lo que sigue
          sin demostrarse.
        </p>
      </aside>
    );
  }

  const meta = AUTON_SPRINT_STATUS_META[item.status];

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-y-auto border-border border-l bg-card/40"
      data-testid="auton-evidence-inspector"
      data-sprint-id={item.id}
      aria-label="Inspector de evidencia"
    >
      <header className="border-border border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <FileCheck2 className="size-3.5" aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1 truncate text-ui-sm font-medium text-foreground">
            Evidencia del sprint
          </p>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-ui-xs ${meta.badgeClass}`}
            data-testid="auton-evidence-status"
            data-status={item.status}
          >
            {meta.label}
          </span>
        </div>
        <p className="mt-2 truncate text-ui-xs text-foreground-subtlest" data-testid="auton-evidence-id">
          {item.id}
        </p>
      </header>

      <div className="space-y-4 px-4 py-4">
        <section data-testid="auton-evidence-requirement">
          <p className="text-ui-xs text-foreground-subtlest">Requisito</p>
          <p className="mt-0.5 text-ui-sm font-medium text-foreground">{item.title}</p>
          {item.detail ? (
            <p className="mt-1 whitespace-pre-wrap text-ui-sm text-foreground-subtle">{item.detail}</p>
          ) : null}
        </section>

        <section data-testid="auton-evidence-files">
          <p className="flex items-center gap-1.5 text-ui-xs text-foreground-subtlest">
            <ListChecks className="size-3" aria-hidden="true" />
            Archivos declarados
          </p>
          {item.files.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-1">
              {item.files.map((file) => (
                <li
                  key={file}
                  className="max-w-full truncate rounded-sm bg-secondary px-1.5 py-0.5 text-ui-xs text-secondary-foreground"
                  title={file}
                >
                  {file}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-ui-sm text-foreground-subtle">Sin archivos declarados.</p>
          )}
        </section>

        <section data-testid="auton-evidence-list">
          <p className="flex items-center gap-1.5 text-ui-xs text-foreground-subtlest">
            <FileCheck2 className="size-3" aria-hidden="true" />
            Evidencia declarada
          </p>
          {item.evidence.length > 0 ? (
            <ul className="mt-1 space-y-1.5">
              {item.evidence.map((evidence, index) => (
                <li
                  key={`${evidence.kind}-${index}`}
                  className="rounded-md border border-border bg-card/60 px-2 py-1.5"
                  data-testid="auton-evidence-entry"
                >
                  <p className="text-ui-xs uppercase tracking-wide text-foreground-subtlest">
                    {evidence.kind}
                  </p>
                  <p className="text-ui-sm text-foreground">{evidence.label}</p>
                  {evidence.ref ? (
                    <p className="mt-0.5 break-all font-mono text-ui-xs text-foreground-subtle">
                      {evidence.ref}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p
              className="mt-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-ui-sm text-amber-700 dark:text-amber-300"
              data-testid="auton-evidence-missing"
            >
              Sin evidencia declarada. Un “listo” sin esto no está demostrado.
            </p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-2" data-testid="auton-evidence-counters">
          <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
            <p className="flex items-center gap-1 text-ui-xs text-foreground-subtlest">
              <RotateCcw className="size-3" aria-hidden="true" />
              Intentos
            </p>
            <p className="text-ui-sm tabular-nums text-foreground">{item.attempts}</p>
          </div>
          <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
            <p className="flex items-center gap-1 text-ui-xs text-foreground-subtlest">
              <HelpCircle className="size-3" aria-hidden="true" />
              Preguntas
            </p>
            <p className="text-ui-sm tabular-nums text-foreground">{item.questions.length}</p>
          </div>
        </section>

        {item.questions.length > 0 ? (
          <section data-testid="auton-evidence-questions">
            <p className="text-ui-xs text-foreground-subtlest">Preguntas abiertas</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ui-sm text-foreground-subtle">
              {item.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {item.status === "done" && item.evidence.length === 0 ? (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-ui-sm text-destructive"
            data-testid="auton-evidence-undemonstrated"
          >
            El sprint está marcado como terminado sin evidencia. Falta demostrar que cerró.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
