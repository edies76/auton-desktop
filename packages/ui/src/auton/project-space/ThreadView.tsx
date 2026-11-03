import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Textarea } from "@/components/ui/textarea.js";
import { cn } from "@/components/lib/utils.js";
import { AutonEvidenceBlock } from "./EvidenceBlock.js";
import { AutonPlanBlock } from "./PlanBlock.js";
import { AutonWorkBlock } from "./WorkBlock.js";
import { formatClock, type AutonProject, type AutonProjectSpaceData } from "./model.js";

export interface AutonThreadViewProps {
  project: AutonProject;
  data: AutonProjectSpaceData;
  now: number;
  onBack: () => void;
  onStopWorker: (workerId: string) => void;
  onSend?: (text: string) => void;
  /** El espacio de solo lectura oculta el compositor; el hilo principal lo muestra. */
  showComposer?: boolean;
  backLabel?: string;
}

/**
 * El hilo del orquestador: la única conversación del espacio, con los bloques
 * de trabajo anidados en orden. El humano solo escribe aquí.
 */
export function AutonThreadView({
  project,
  data,
  now,
  onBack,
  onStopWorker,
  onSend,
  showComposer = true,
  backLabel = "Proyectos",
}: AutonThreadViewProps) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend?.(text);
    setDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="auton-thread">
      <header className="flex items-center gap-3 border-border border-b px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="auton-project-back"
          aria-label={`Volver a ${backLabel.toLowerCase()}`}
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-ui-sm font-medium text-foreground">{project.name}</p>
          <p className="truncate text-ui-xs text-foreground-subtlest">{project.path}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 gap-1 rounded-full" data-testid="auton-orchestrator-badge">
          <Sparkles className="size-2.5" />
          Orquestador
        </Badge>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-testid="auton-thread-scroll">
        <ol className="mx-auto max-w-3xl space-y-4">
          {data.messages.length === 0 &&
          data.tramos.length === 0 &&
          !data.plan &&
          !data.evidence ? (
            <li
              data-testid="auton-thread-empty"
              className="rounded-lg border border-border border-dashed px-4 py-8 text-center text-ui-sm text-foreground-subtle"
            >
              El orquestador todavía no ha abierto trabajo en este proyecto.
            </li>
          ) : null}
          {data.messages.map((message) => {
            const orchestrator = message.role === "orchestrator";
            return (
              <li
                key={message.id}
                className={cn("flex gap-2.5", orchestrator ? "justify-start" : "justify-end")}
                data-testid="auton-thread-message"
                data-role={message.role}
              >
                {orchestrator ? (
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Sparkles className="size-3" />
                  </span>
                ) : null}
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2",
                    orchestrator
                      ? "border border-border bg-card/70"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {orchestrator ? (
                    <p className="mb-0.5 text-ui-xs text-foreground-subtlest">
                      Orquestador · {formatClock(message.at - data.messages[0]!.at)}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-ui-sm">{message.text}</p>
                </div>
              </li>
            );
          })}

          {data.tramos.map((tramo) => (
            <li key={tramo.id}>
              <AutonWorkBlock tramo={tramo} workers={data.workers} now={now} />
            </li>
          ))}

          {data.plan ? (
            <li>
              <AutonPlanBlock plan={data.plan} />
            </li>
          ) : null}

          {data.evidence ? (
            <li>
              <AutonEvidenceBlock evidence={data.evidence} />
            </li>
          ) : null}
        </ol>
      </div>

      {showComposer ? (
        <div className="border-border border-t px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Escríbele al orquestador…"
              aria-label="Mensaje al orquestador"
              data-testid="auton-composer"
              className="min-h-10 flex-1"
              rows={1}
            />
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={!draft.trim()}
              aria-label="Enviar al orquestador"
              data-testid="auton-composer-send"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
