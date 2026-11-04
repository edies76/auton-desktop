import { CircleAlert, FileCheck2, FileText, HelpCircle, RotateCcw } from "lucide-react";
import { AUTON_SPRINT_STATUS_META, type AutonSprintItem } from "./planFile.js";

export interface AutonEvidenceInspectorProps {
  item: AutonSprintItem | null;
}

const SECTION_LABEL = "text-ui-xs font-medium uppercase tracking-wider text-foreground-subtlest";

/**
 * La prueba de un sprint, sin adornos: qué se pretendía, qué archivos toca,
 * qué evidencia declaró y qué sigue sin demostrarse. Si no hay evidencia, se
 * dice; el inspector no la inventa.
 *
 * Panel casi monocromo: la falta de evidencia se comunica con borde, texto
 * y un icono en tono neutro, nunca con fondos de color.
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
        <header className="border-border border-b px-5 py-4">
          <p className="text-ui-sm font-medium text-foreground">Evidencia</p>
        </header>
        <div className="px-5 py-5">
          <p className="text-ui-sm text-foreground-subtle">Elige un sprint del tablero.</p>
          <p className="mt-2 text-ui-sm leading-relaxed text-foreground-subtlest">
            El inspector muestra el requisito, los archivos, la evidencia declarada y lo que sigue
            sin demostrarse.
          </p>
        </div>
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
      <header className="border-border border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 shrink-0 text-foreground-subtlest" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-ui-sm font-medium text-foreground">
            Evidencia del sprint
          </p>
          <span
            className="shrink-0 rounded-full border border-border bg-card/60 px-2 py-0.5 text-ui-xs text-foreground-subtle"
            data-testid="auton-evidence-status"
            data-status={item.status}
          >
            {meta.label}
          </span>
        </div>
        <p
          className="mt-2 truncate font-mono text-ui-xs text-foreground-subtlest"
          data-testid="auton-evidence-id"
        >
          {item.id}
        </p>
      </header>

      <div className="space-y-7 px-5 py-5">
        <section data-testid="auton-evidence-requirement">
          <p className={SECTION_LABEL}>Requisito</p>
          <p className="mt-2 text-ui-sm font-medium leading-relaxed text-foreground">
            {item.title}
          </p>
          {item.detail ? (
            <p className="mt-1.5 whitespace-pre-wrap text-ui-sm leading-relaxed text-foreground-subtle">
              {item.detail}
            </p>
          ) : null}
        </section>

        <section data-testid="auton-evidence-files">
          <p className={SECTION_LABEL}>Archivos declarados</p>
          {item.files.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {item.files.map((file) => (
                <li key={file} className="flex min-w-0 items-center gap-1.5" title={file}>
                  <FileText
                    className="size-3 shrink-0 text-foreground-subtlest"
                    aria-hidden="true"
                  />
                  <span className="truncate font-mono text-ui-xs text-foreground-subtle">
                    {file}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-ui-sm text-foreground-subtle">Sin archivos declarados.</p>
          )}
        </section>

        <section data-testid="auton-evidence-list">
          <p className={SECTION_LABEL}>Evidencia declarada</p>
          {item.evidence.length > 0 ? (
            <ul className="mt-1 divide-y divide-border">
              {item.evidence.map((evidence, index) => (
                <li
                  key={`${evidence.kind}-${index}`}
                  className="py-2.5 first:pt-2 last:pb-0"
                  data-testid="auton-evidence-entry"
                >
                  <p className="text-ui-xs uppercase tracking-wide text-foreground-subtlest">
                    {evidence.kind}
                  </p>
                  <p className="mt-0.5 text-ui-sm leading-relaxed text-foreground">
                    {evidence.label}
                  </p>
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
              className="mt-2 flex items-start gap-2 rounded-md border border-dashed border-border bg-card/60 px-3 py-2.5 text-ui-sm leading-relaxed text-foreground-subtle"
              data-testid="auton-evidence-missing"
            >
              <CircleAlert
                className="mt-0.5 size-3.5 shrink-0 text-foreground-subtlest"
                aria-hidden="true"
              />
              <span>Sin evidencia declarada. Un “listo” sin esto no está demostrado.</span>
            </p>
          )}
        </section>

        <section data-testid="auton-evidence-counters">
          <dl className="divide-y divide-border border-border border-y">
            <div className="flex items-center justify-between py-2.5">
              <dt className="flex items-center gap-1.5 text-ui-sm text-foreground-subtle">
                <RotateCcw className="size-3 text-foreground-subtlest" aria-hidden="true" />
                Intentos
              </dt>
              <dd className="text-ui-sm tabular-nums text-foreground">{item.attempts}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="flex items-center gap-1.5 text-ui-sm text-foreground-subtle">
                <HelpCircle className="size-3 text-foreground-subtlest" aria-hidden="true" />
                Preguntas
              </dt>
              <dd className="text-ui-sm tabular-nums text-foreground">{item.questions.length}</dd>
            </div>
          </dl>
        </section>

        {item.questions.length > 0 ? (
          <section data-testid="auton-evidence-questions">
            <p className={SECTION_LABEL}>Preguntas abiertas</p>
            <ul className="mt-2 space-y-1.5">
              {item.questions.map((question) => (
                <li
                  key={question}
                  className="flex items-start gap-1.5 text-ui-sm leading-relaxed text-foreground-subtle"
                >
                  <HelpCircle
                    className="mt-0.5 size-3 shrink-0 text-foreground-subtlest"
                    aria-hidden="true"
                  />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {item.status === "done" && item.evidence.length === 0 ? (
          <p
            className="flex items-start gap-2 rounded-md border border-border bg-card/60 px-3 py-2.5 text-ui-sm leading-relaxed text-foreground"
            data-testid="auton-evidence-undemonstrated"
          >
            <CircleAlert
              className="mt-0.5 size-3.5 shrink-0 text-foreground-subtlest"
              aria-hidden="true"
            />
            <span>
              El sprint está marcado como terminado sin evidencia. Falta demostrar que cerró.
            </span>
          </p>
        ) : null}
      </div>
    </aside>
  );
}
