// ============================================================
// Auton Plan Tool - the sprint plan the orchestrator owns
// ============================================================
// The plan lives at <workspace>/.auton/plan.json and is the single source of
// truth the Auton surfaces read. The orchestrator writes it; workers only
// report back to the orchestrator.

import { z } from "zod";
import type { ToolCallId, TraceId } from "../interfaces/shared.js";
import { toToolJsonSchema } from "../tools/json-schema.js";

export const AUTON_PLAN_TOOL_NAME = "AutonPlan";

export const AUTON_PLAN_FILE_VERSION = 1;

export const AutonPlanItemStatus = {
  Ready: "ready",
  Running: "running",
  Waiting: "waiting",
  Blocked: "blocked",
  Done: "done",
  Dropped: "dropped",
} as const;

export const AutonPlanItemStatusSchema = z.enum([
  "ready",
  "running",
  "waiting",
  "blocked",
  "done",
  "dropped",
]);

export const AutonEffortSchema = z.enum(["minimal", "standard", "thorough"]);

export const AutonStrengthSchema = z.enum(["explicit", "inferred"]);

export const AutonOwnerSchema = z.enum(["orchestrator", "programmer"]);

export const AutonPlanEvidenceSchema = z
  .object({
    kind: z.enum(["command", "test", "file", "url", "note"]).describe("Kind of evidence"),
    label: z.string().min(1).describe("What the evidence proves, in one line"),
    ref: z.string().optional().describe("Command, path or URL that produced it"),
  })
  .strict();

export const AutonPlanItemSchema = z
  .object({
    id: z.string().min(1).describe("Stable id, e.g. s1 or t-003"),
    title: z.string().min(1).describe("One line of work"),
    detail: z.string().optional().describe("Scope, definition of done and constraints"),
    status: AutonPlanItemStatusSchema.describe("Current state of this work item"),
    effort: AutonEffortSchema.optional().describe("How hard the programmer should work"),
    owner: AutonOwnerSchema
      .optional()
      .describe("Who does the work: orchestrator only for small single-file items"),
    strength: AutonStrengthSchema.optional().describe("Whether a human asked for it explicitly"),
    files: z.array(z.string()).optional().describe("Files this item is allowed to touch"),
    evidence: z.array(AutonPlanEvidenceSchema).optional(),
    questions: z.array(z.string()).optional().describe("Open questions for the human"),
  })
  .strict();

export const AutonGoalSchema = z
  .object({
    title: z.string().min(1).describe("The goal in one line"),
    statement: z.string().optional().describe("What the human wants, in their words"),
    constraints: z.array(z.string()).optional(),
    done: z.array(z.string()).optional().describe("How we know the goal is met"),
  })
  .strict();

/**
 * Los límites que gobiernan qué puede hacer un orquestador sin preguntar.
 * Son datos, no texto: viven junto al plan para que todos los consumidores
 * (UI, watcher, orquestador, registro de decisiones) lean la misma versión.
 */
export const AutonLimitsSchema = z
  .object({
    version: z.number().int().positive().default(1),
    maxAttempts: z
      .number()
      .int()
      .positive()
      .default(3)
      .describe("Retries per item before it passes to blocked"),
    approval: z
      .object({
        deleteMove: z.boolean().default(true).describe("Ask before deleting or moving files"),
        outsideProject: z.boolean().default(true).describe("Ask before touching paths outside the project"),
        pushMergeRebase: z
          .boolean()
          .default(true)
          .describe("Ask before git push, merge or rebase"),
        installDependencies: z
          .boolean()
          .default(true)
          .describe("Ask before installing global dependencies"),
        outsideScope: z
          .boolean()
          .default(true)
          .describe("Ask before acting outside the agreed scope"),
      })
      .default({}),
    unknownHandling: z
      .enum(["wait", "ask", "safe_default"])
      .default("wait")
      .describe("wait: item goes to waiting with a question; ask: ask immediately; safe_default: take the least risky option and note it"),
  })
  .strict();

export const AutonLimitChangeSchema = z
  .object({
    at: z.string().min(1).describe("ISO timestamp"),
    field: z.string().min(1).describe("What changed, e.g. approval.deleteMove or unknownHandling"),
    from: z.string().nullable(),
    to: z.string().nullable(),
    reason: z.string().min(1).describe("Why the limit changed, in one line"),
    approvedBy: z.enum(["human", "orchestrator"]).describe("Who approved the change"),
  })
  .strict();

/**
 * Un cambio de límites inválido no debe tirar un plan bueno.
 * Sin limits el plan queda "sin versión": las decisiones de escalación ya
 * tomadas no se inventan a posteriori.
 */
export function normalizeLegacyPlan(plan: AutonPlan): AutonPlan {
  return {
    version: plan.version ?? AUTON_PLAN_FILE_VERSION,
    goal: plan.goal,
    limits: plan.limits,
    limitHistory: plan.limitHistory ?? [],
    items: plan.items ?? [],
    updatedAt: plan.updatedAt,
  };
}

export const AutonPlanSchema = z
  .object({
    version: z.number().int().positive().default(AUTON_PLAN_FILE_VERSION),
    goal: AutonGoalSchema.optional(),
    limits: AutonLimitsSchema.optional(),
    limitHistory: z.array(AutonLimitChangeSchema).default([]),
    items: z.array(AutonPlanItemSchema).default([]),
    updatedAt: z.string().optional(),
  })
  .strict();

export type AutonPlan = z.infer<typeof AutonPlanSchema>;
export type AutonPlanItem = z.infer<typeof AutonPlanItemSchema>;
export type AutonPlanItemStatus = z.infer<typeof AutonPlanItemStatusSchema>;
export type AutonLimits = z.infer<typeof AutonLimitsSchema>;
export type AutonLimitChange = z.infer<typeof AutonLimitChangeSchema>;

export const AutonPlanInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read") }).strict(),
  z
    .object({
      action: z.literal("write"),
      goal: AutonGoalSchema.optional(),
      limits: AutonLimitsSchema.optional(),
      limitHistory: z.array(AutonLimitChangeSchema).optional(),
      items: z.array(AutonPlanItemSchema),
    })
    .strict(),
]);

export type AutonPlanInput = z.infer<typeof AutonPlanInputSchema>;

export const AutonPlanInputJsonSchema = toToolJsonSchema(AutonPlanInputSchema);

export const AutonPlanSummarySchema = z
  .object({
    total: z.number().int().nonnegative(),
    ready: z.number().int().nonnegative(),
    running: z.number().int().nonnegative(),
    waiting: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    done: z.number().int().nonnegative(),
    dropped: z.number().int().nonnegative(),
  })
  .strict();

export type AutonPlanSummary = z.infer<typeof AutonPlanSummarySchema>;

export const AutonPlanOutputSchema = z
  .object({
    path: z.string().min(1),
    plan: AutonPlanSchema,
    summary: AutonPlanSummarySchema,
  })
  .strict();

export type AutonPlanOutput = z.infer<typeof AutonPlanOutputSchema>;

export const AutonPlanOutputJsonSchema = toToolJsonSchema(AutonPlanOutputSchema);

export function isAutonPlanToolName(value: string | undefined): value is typeof AUTON_PLAN_TOOL_NAME {
  return value === AUTON_PLAN_TOOL_NAME;
}

export function summarizeAutonPlan(items: readonly AutonPlanItem[]): AutonPlanSummary {
  const count = (status: AutonPlanItemStatus) => items.filter((item) => item.status === status).length;
  return {
    total: items.length,
    ready: count("ready"),
    running: count("running"),
    waiting: count("waiting"),
    blocked: count("blocked"),
    done: count("done"),
    dropped: count("dropped"),
  };
}

export function formatAutonPlanForModel(plan: AutonPlan): string {
  const lines: string[] = [];
  if (plan.limits) {
    lines.push(
      `Limits v${plan.limits.version}: maxAttempts ${plan.limits.maxAttempts}, unknownHandling ${plan.limits.unknownHandling}`,
    );
    const approval = plan.limits.approval;
    const flags = [
      `deleteMove=${approval.deleteMove ? "ask" : "auto"}`,
      `outsideProject=${approval.outsideProject ? "ask" : "auto"}`,
      `pushMergeRebase=${approval.pushMergeRebase ? "ask" : "auto"}`,
      `installDependencies=${approval.installDependencies ? "ask" : "auto"}`,
      `outsideScope=${approval.outsideScope ? "ask" : "auto"}`,
    ];
    lines.push(`  approval: ${flags.join(", ")}`);
    if (plan.limitHistory.length > 0) {
      lines.push("Limit history:");
      for (const change of plan.limitHistory) {
        lines.push(
          `  - ${change.at} · ${change.field}: ${change.from ?? "—"} → ${change.to ?? "—"} · ${change.reason} (${change.approvedBy})`,
        );
      }
    }
  } else if (plan.limitHistory.length > 0) {
    lines.push(`Limits: sin versión vigente (${plan.limitHistory.length} cambios registrados)`);
  }
  if (plan.goal) {
    lines.push(`Goal: ${plan.goal.title}`);
    if (plan.goal.statement) lines.push(`Intent: ${plan.goal.statement}`);
    if (plan.goal.done?.length) lines.push(`Done when: ${plan.goal.done.join("; ")}`);
    if (plan.goal.constraints?.length) lines.push(`Constraints: ${plan.goal.constraints.join("; ")}`);
  }
  if (plan.items.length === 0) {
    lines.push("No work items yet.");
    return lines.join("\n");
  }
  lines.push("Work items (authoritative):");
  for (const item of plan.items) {
    const effort = item.effort ? ` [${item.effort}]` : "";
    lines.push(`- ${item.id} (${item.status})${effort} ${item.title}`);
    if (item.files?.length) lines.push(`    files: ${item.files.join(", ")}`);
    if (item.questions?.length) lines.push(`    open questions: ${item.questions.join(" | ")}`);
  }
  return lines.join("\n");
}

export interface AutonPlanToolCall {
  id: ToolCallId;
  name: typeof AUTON_PLAN_TOOL_NAME;
  input: AutonPlanInput;
  traceId: TraceId;
  startedAt: Date;
}
