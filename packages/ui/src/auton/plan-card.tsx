import { ListChecks } from "lucide-react";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge.js";
import { ToolOutput } from "@/components/ai-elements/tool.js";
import { getToolCallErrorText } from "@/lib/toolError.js";
import { ToolLayout } from "@/ToolCallBlocks/ToolLayout.js";
import type { ToolCallBlockRenderContext } from "@/ToolCallBlocks/shared.js";

const AUTON_PLAN_TOOL_ICON = <ListChecks className="size-4 shrink-0 text-foreground-subtle" />;

type PlanToolCall = ToolCallBlockRenderContext["toolCallNode"]["toolCall"];

interface PlanItemView {
  id: string;
  title: string;
  detail?: string;
  status: string;
  effort?: string;
  owner?: string;
  files: string[];
  evidenceCount: number;
  questions: string[];
}

interface LimitChangeView {
  at: string;
  field: string;
  from?: string;
  to?: string;
  reason: string;
  approvedBy?: string;
}

interface LimitsView {
  version: number;
  maxAttempts?: number;
  unknownHandling?: string;
  approvalAsk: string[];
  history: LimitChangeView[];
}

interface PlanView {
  goalTitle?: string;
  goalStatement?: string;
  constraints: string[];
  limits?: LimitsView;
  items: PlanItemView[];
  total: number;
  done: number;
  running: number;
  waiting: number;
  blocked: number;
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

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

const APPROVAL_LABELS: Record<string, string> = {
  deleteMove: "delete/move",
  outsideProject: "outside project",
  pushMergeRebase: "push/merge/rebase",
  installDependencies: "install dependencies",
  outsideScope: "outside scope",
};

function readLimitsView(plan: Record<string, unknown>): LimitsView | undefined {
  const history: LimitChangeView[] = [];
  if (Array.isArray(plan.limitHistory)) {
    for (const raw of plan.limitHistory) {
      if (!isRecord(raw)) continue;
      const at = readString(raw.at);
      const field = readString(raw.field);
      const reason = readString(raw.reason);
      if (!at || !field || !reason) continue;
      history.push({
        at,
        field,
        from: typeof raw.from === "string" ? raw.from : undefined,
        to: typeof raw.to === "string" ? raw.to : undefined,
        reason,
        approvedBy: readString(raw.approvedBy),
      });
    }
  }
  if (!isRecord(plan.limits)) {
    return history.length > 0
      ? { version: 0, approvalAsk: [], history }
      : undefined;
  }
  const approval = isRecord(plan.limits.approval) ? plan.limits.approval : {};
  const approvalAsk = Object.keys(APPROVAL_LABELS).filter((key) => approval[key] === true);
  return {
    version: typeof plan.limits.version === "number" ? plan.limits.version : 1,
    maxAttempts: typeof plan.limits.maxAttempts === "number" ? plan.limits.maxAttempts : undefined,
    unknownHandling: readString(plan.limits.unknownHandling),
    approvalAsk,
    history,
  };
}

function readPlanView(value: unknown): PlanView | null {
  const record = parseJsonCandidate(value);
  if (!isRecord(record) || !isRecord(record.plan)) return null;

  const goal = isRecord(record.plan.goal) ? record.plan.goal : {};
  const rawItems = Array.isArray(record.plan.items) ? record.plan.items : [];
  const items: PlanItemView[] = [];
  for (const raw of rawItems) {
    if (!isRecord(raw)) continue;
    const id = readString(raw.id);
    const title = readString(raw.title);
    const status = readString(raw.status);
    if (!id || !title || !status) continue;
    items.push({
      id,
      title,
      detail: readString(raw.detail),
      status,
      effort: readString(raw.effort),
      owner: readString(raw.owner),
      files: readStringArray(raw.files),
      evidenceCount: Array.isArray(raw.evidence) ? raw.evidence.length : 0,
      questions: readStringArray(raw.questions),
    });
  }

  const summary = isRecord(record.summary) ? record.summary : {};
  const count = (key: string) =>
    typeof summary[key] === "number" ? (summary[key] as number) : items.filter((i) => i.status === key).length;

  return {
    goalTitle: readString(goal.title),
    goalStatement: readString(goal.statement),
    constraints: readStringArray(goal.constraints),
    limits: readLimitsView(record.plan),
    items,
    total: count("total") || items.length,
    done: count("done"),
    running: count("running"),
    waiting: count("waiting"),
    blocked: count("blocked"),
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

function itemMeta(item: PlanItemView): string[] {
  const meta: string[] = [];
  if (item.owner === "orchestrator") meta.push("you");
  if (item.files.length > 0) meta.push(item.files.length === 1 ? "1 file" : `${item.files.length} files`);
  if (item.evidenceCount > 0) {
    meta.push(item.evidenceCount === 1 ? "1 proof" : `${item.evidenceCount} proofs`);
  }
  if (item.questions.length > 0) {
    meta.push(item.questions.length === 1 ? "1 question" : `${item.questions.length} questions`);
  }
  return meta;
}

export function AutonPlanToolCallBlock(context: ToolCallBlockRenderContext) {
  const { toolCall } = context.toolCallNode;
  const errorText = getToolCallErrorText(toolCall);
  const view = readAutonPlanView(toolCall);

  const renderContent = useCallback(() => {
    if (errorText) return <ToolOutput errorText={errorText} output={undefined} />;
    if (!view) return <ToolOutput errorText={undefined} output={toolCall.output} />;

    return (
      <div className="ml-2 space-y-2 border-border border-l pl-3.5">
        {view.goalStatement ? (
          <p className="text-ui-sm text-foreground-subtle">{view.goalStatement}</p>
        ) : null}
        {view.constraints.length > 0 ? (
          <p className="text-ui-xs text-foreground-subtlest">
            Constraints: {view.constraints.join(" · ")}
          </p>
        ) : null}
        {view.limits ? (
          <div className="space-y-1">
            <p className="text-ui-xs text-foreground-subtlest">
              {view.limits.version > 0 ? `Limits v${view.limits.version}` : "Limits: unversioned"}
              {view.limits.maxAttempts !== undefined
                ? ` · up to ${view.limits.maxAttempts} attempts`
                : ""}
              {view.limits.unknownHandling
                ? ` · when undecided: ${view.limits.unknownHandling}`
                : ""}
              {view.limits.approvalAsk.length > 0
                ? ` · asks before: ${view.limits.approvalAsk
                    .map((key) => APPROVAL_LABELS[key] ?? key)
                    .join(", ")}`
                : ""}
            </p>
            {view.limits.history.length > 0 ? (
              <div className="space-y-0.5">
                {view.limits.history.map((change, index) => (
                  <p
                    key={`${change.at}-${change.field}-${index}`}
                    className="text-ui-xs text-foreground-subtlest"
                  >
                    {change.at} · {change.field}: {change.from ?? "—"} → {change.to ?? "—"} ·{" "}
                    {change.reason}
                    {change.approvedBy ? ` (${change.approvedBy})` : ""}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {view.items.length === 0 ? (
          <p className="text-ui-sm text-foreground-subtle">This project has no plan yet.</p>
        ) : (
          <div className="space-y-2">
            {view.items.map((item) => {
              const meta = itemMeta(item);
              return (
                <div key={item.id} className="min-w-0 space-y-0.5">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <Badge
                      variant="outline"
                      className={`h-4 px-1.5 text-ui-xs ${STATUS_BADGE_CLASS[item.status] ?? ""}`}
                    >
                      {item.status}
                    </Badge>
                    <span className="min-w-0 truncate text-ui-sm text-foreground" title={item.title}>
                      {item.title}
                    </span>
                    {item.effort ? (
                      <span className="shrink-0 text-ui-xs text-foreground-subtlest">
                        {item.effort}
                      </span>
                    ) : null}
                  </div>
                  {item.detail ? (
                    <p className="line-clamp-2 text-ui-xs text-foreground-subtle">{item.detail}</p>
                  ) : null}
                  {meta.length > 0 ? (
                    <p className="text-ui-xs text-foreground-subtlest">{meta.join(" · ")}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [errorText, toolCall.output, view]);

  const counts = view
    ? [
        view.total > 0 ? `${view.done}/${view.total} done` : null,
        view.running > 0 ? `${view.running} running` : null,
        view.waiting > 0 ? `${view.waiting} waiting` : null,
        view.blocked > 0 ? `${view.blocked} blocked` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

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
      secondaryText={counts || undefined}
      statusLabel={toolCall.status === "failed" ? context.statusLabel : undefined}
      statusTooltip={toolCall.status === "failed" ? errorText : undefined}
      showFailureStatus={toolCall.status === "failed"}
      isRunning={context.isRunning}
      title={toolCall.title}
      renderContent={renderContent}
    />
  );
}
