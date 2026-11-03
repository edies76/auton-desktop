import { FileCheck2 } from "lucide-react";
import type { AutonEvidence } from "./model.js";

export interface AutonEvidenceBlockProps {
  evidence: AutonEvidence;
}

/**
 * La prueba de que el sprint cerró: el comando, su salida y los archivos.
 * Un "listo" sin esto no es evidencia.
 */
export function AutonEvidenceBlock({ evidence }: AutonEvidenceBlockProps) {
  return (
    <section
      className="animate-in fade-in-0 slide-in-from-bottom-1 overflow-hidden rounded-lg border border-border bg-card/60 duration-200"
      data-testid="auton-evidence-block"
    >
      <header className="flex items-center gap-2 border-border border-b px-3 py-2">
        <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
          <FileCheck2 className="size-3" />
        </span>
        <span className="text-ui-sm font-medium text-foreground">Evidencia</span>
      </header>
      <div className="space-y-2 px-3 py-2">
        <div>
          <p className="text-ui-xs text-foreground-subtlest">Comando</p>
          <code
            className="mt-0.5 block overflow-x-auto rounded-sm bg-input/30 px-2 py-1 text-ui-xs text-foreground"
            data-testid="auton-evidence-command"
          >
            {evidence.command}
          </code>
        </div>
        <div>
          <p className="text-ui-xs text-foreground-subtlest">Salida</p>
          <pre
            className="mt-0.5 max-h-48 overflow-auto rounded-sm bg-input/30 px-2 py-1 text-ui-xs text-foreground-subtle"
            data-testid="auton-evidence-output"
          >
            {evidence.output}
          </pre>
        </div>
        {evidence.files.length > 0 ? (
          <div>
            <p className="text-ui-xs text-foreground-subtlest">Archivos tocados</p>
            <ul className="mt-0.5 flex flex-wrap gap-1" data-testid="auton-evidence-files">
              {evidence.files.map((file) => (
                <li
                  key={file}
                  className="rounded-sm bg-secondary px-1.5 py-0.5 text-ui-xs text-secondary-foreground"
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
