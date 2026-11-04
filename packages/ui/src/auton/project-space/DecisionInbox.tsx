import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import type { AutonPlanItemView, AutonPlanView } from "./model.js";

export interface AutonDecisionInboxProps {
  plan: AutonPlanView;
  onReply?: (item: AutonPlanItemView) => void;
}

/** Las decisiones que el plan dejó pendientes de una respuesta humana. */
export function AutonDecisionInbox({ plan, onReply }: AutonDecisionInboxProps) {
  const pending = plan.items.filter(
    (item) => item.status === "waiting" || item.status === "not_evaluable",
  );
  if (pending.length === 0) return null;

  return (
    <section
      className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5"
      data-testid="auton-decision-inbox"
    >
      <div className="flex items-center gap-2">
        <HelpCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <p className="text-ui-sm font-medium text-foreground">
          {pending.length === 1 ? "Una decisión pendiente" : `${pending.length} decisiones pendientes`}
        </p>
      </div>
      <ul className="mt-2 space-y-2">
        {pending.map((item) => {
          const questions =
            item.questions && item.questions.length > 0
              ? item.questions
              : [item.detail ?? item.title];
          return (
            <li key={item.id} className="min-w-0" data-decision-status={item.status}>
              <p className="text-ui-sm text-foreground">{item.title}</p>
              {questions.map((question, index) => (
                <p key={`${item.id}-q-${index}`} className="text-ui-xs text-foreground-subtle">
                  {question}
                </p>
              ))}
              {onReply ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 px-1.5 text-ui-xs"
                  data-testid="auton-decision-reply"
                  onClick={() => onReply(item)}
                >
                  Responder
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
