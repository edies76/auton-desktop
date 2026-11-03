import type { ToolCallBlockRenderContext } from "@/ToolCallBlocks/shared.js";
import { AutonPlanToolCallBlock } from "../plan-card.js";
import type { AutonPlanView } from "./model.js";

export interface AutonPlanBlockProps {
  plan: AutonPlanView;
}

/**
 * El plan del proyecto dentro del hilo. Reutiliza la tarjeta de plan existente
 * en vez de inventar una segunda forma de contarlo.
 */
export function AutonPlanBlock({ plan }: AutonPlanBlockProps) {
  const output = JSON.stringify({
    path: ".auton/plan.json",
    plan: {
      version: 1,
      limitHistory: [],
      limitReports: [],
      goal: plan.goalTitle ? { title: plan.goalTitle } : undefined,
      items: plan.items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        ...(item.owner ? { owner: item.owner } : {}),
        attempts: 0,
      })),
    },
    summary: {
      total: plan.items.length,
      done: plan.items.filter((item) => item.status === "done").length,
      running: plan.items.filter((item) => item.status === "running").length,
      waiting: plan.items.filter((item) => item.status === "waiting").length,
      blocked: plan.items.filter((item) => item.status === "blocked").length,
      notEvaluable: plan.items.filter((item) => item.status === "not_evaluable").length,
    },
  });

  const context = {
    toolCallNode: {
      toolCall: {
        toolId: "auton-plan-block",
        toolName: "AutonPlan",
        kind: "tool",
        status: "success",
        title: plan.goalTitle,
        output,
      },
    },
    showIcon: false,
    canToggle: true,
    forceOpen: true,
    statusLabel: "Plan",
    isRunning: false,
  } as unknown as ToolCallBlockRenderContext;

  return (
    <section
      className="animate-in fade-in-0 slide-in-from-bottom-1 overflow-hidden rounded-lg border border-border duration-200"
      data-testid="auton-plan-block"
    >
      <AutonPlanToolCallBlock {...context} />
    </section>
  );
}
