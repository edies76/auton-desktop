import { ListChecks } from "lucide-react";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge.js";
import { ToolOutput } from "@/components/ai-elements/tool.js";
import { getToolCallErrorText } from "@/lib/toolError.js";
import { ToolLayout } from "../ToolLayout.js";
import type { ToolCallBlockRenderContext } from "../shared.js";

const AUTON_PLAN_TOOL_ICON = <ListChecks className="size-4 shrink-0 text-foreground-subtle" />;

type PlanToolCall = ToolCallBlockRenderContext["toolCallNode"]["toolCall"];

interface PlanItemView {
  id: string;
  title: string;
  status: string;
  effort?: string;
  questions: string[];
}

interface PlanView {
  goalTitle?: string;
  items: PlanItemView[];
  total: number;
  done: number;
  running: number;
  waiting: number;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  ready: "bg-secondary text-secondary-foreground",
  running: "bg-primary/15 text-primary",
  waiting: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  blocked: "bg-destructive/10 text-destructive",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  dropped: "bg-muted text-muted-foreground line-through",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonCandidate(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function readPlanView(value: unknown): PlanView | null {
  const record = parseJsonCandidate(value);
  if (!isRecord(record) || !isRecord(record.plan)) return null;

  const goalTitle =
    isRecord(record.plan.goal) && typeof record.plan.goal.title === "string"
      ? record.plan.goal.title
      : undefined;

  const rawItems = Array.isArray(record.plan.items) ? record.plan.items : [];
  const items: PlanItemView[] = [];
  for (const raw of rawItems) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === "string" ? raw.id : undefined;
    const title = typeof raw.title === "string" ? raw.title : undefined;
    const status = typeof raw.status === "string" ? raw.status : undefined;
    if (!id || !title || !status) continue;
    items.push({
      id,
      title,
      status,
      effort: typeof raw.effort === "string" ? raw.effort : undefined,
      questions: Array.isArray(raw.questions)
        ? raw.questions.filter((q): q is string => typeof q === "string")
        : [],
    });
  }

  const summary = isRecord(record.summary) ? record.summary : {};
  const count = (key: string) => (typeof summary[key] === "number" ? (summary[key] as number) : 0);

  return {
    goalTitle,
    items,
    total: count("total") || items.length,
    done: count("done"),
    running: count("running"),
    waiting: count("waiting"),
  };
}

export function readAutonPlanView(toolCall: PlanToolCall): PlanView | null {
  const raw = isRecord(toolCall.raw) ? toolCall.raw : null;
  for (const candidate of [toolCall.output, raw?.rawOutput, raw?.output, raw?.result]) {
    const view = readPlanView(candidate);
    if (view) return view;
  }
  return null;
}

export function isAutonPlanToolCall(toolCall: PlanToolCall): boolean {
  return (toolCall.toolName ?? toolCall.kind) === "AutonPlan";
}

export function AutonPlanToolCallBlock(context: ToolCallBlockRenderContext) {
  const { toolCall } = context.toolCallNode;
  const errorText = getToolCallErrorText(toolCall);
  const view = readAutonPlanView(toolCall);

  const renderContent = useCallback(() => {
    if (errorText) return <ToolOutput errorText={errorText} output={undefined} />;
    if (!view) return <ToolOutput errorText={undefined} output={toolCall.output} />;
    if (view.items.length === 0) {
      return (
        <p className="ml-2 border-border border-l pl-3.5 text-ui-sm text-foreground-subtle">
          This project has no plan yet.
        </p>
      );
    }
    return (
      <div className="ml-2 space-y-1.5 border-border border-l pl-3.5">
        {view.items.map((item) => (
          <div key={item.id} className="flex min-w-0 items-baseline gap-2">
            <Badge
              variant="outline"
              className={`h-4 px-1.5 text-ui-xs ${STATUS_BADGE_CLASS[item.status] ?? ""}`}
            >
              {item.status}
            </Badge>
            <span className="min-w-0 truncate text-ui-sm text-foreground-subtle" title={item.title}>
              {item.title}
            </span>
            {item.effort ? (
              <span className="shrink-0 text-ui-xs text-foreground-subtlest">{item.effort}</span>
            ) : null}
            {item.questions.length > 0 ? (
              <span className="shrink-0 text-ui-xs text-amber-600 dark:text-amber-300">
                {item.questions.length === 1 ? "1 question" : `${item.questions.length} questions`}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }, [errorText, toolCall.output, view]);

  const secondaryText = view
    ? [view.done > 0 ? `${view.done}/${view.total} done` : null, view.running > 0 ? `${view.running} running` : null]
        .filter(Boolean)
        .join(" · ") || undefined
    : undefined;

  return (
    <ToolLayout
      toolId={toolCall.toolId}
      icon={AUTON_PLAN_TOOL_ICON}
      showIcon={context.showIcon !== false}
      canToggle={context.canToggle ?? true}
      forceOpen={context.forceOpen ?? false}
      kindLabel="Auton plan"
      sourceLabel={context.sourceLabel}
      primaryText={view?.goalTitle ?? null}
      secondaryText={secondaryText}
      statusLabel={toolCall.status === "failed" ? context.statusLabel : undefined}
      statusTooltip={toolCall.status === "failed" ? errorText : undefined}
      showFailureStatus={toolCall.status === "failed"}
      isRunning={context.isRunning}
      title={toolCall.title}
      renderContent={renderContent}
    />
  );
}
