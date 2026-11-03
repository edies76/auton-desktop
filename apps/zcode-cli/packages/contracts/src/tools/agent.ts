// ============================================================
// Agent Tool - Subagent orchestration tool
// ============================================================
// 支持基于配置的子代理和异步启动。

import { z } from "zod";
import type { ToolCallId, TraceId } from "../interfaces/shared.js";
import type { ModelUsage } from "../model/index.js";
import { toToolJsonSchema } from "./json-schema.js";
import {
  AutonWorkerTaskModeSchema,
  DEFAULT_AUTON_WORKER_TASK_MODE,
} from "../auton/task-mode.js";

export const AgentType = {
  GeneralPurpose: "general-purpose",
  Explore: "Explore",
} as const;

export type AgentType = string;

export const AgentEffortSchema = z.enum(["minimal", "standard", "thorough"]);

export type AgentEffort = z.infer<typeof AgentEffortSchema>;

export const AgentInputSchema = z.object({
  description: z.string().describe("A short (3-5 word) description of the task"),
  effort: AgentEffortSchema.optional().describe(
    "Effort policy for subagent_type=auton-worker. minimal = only the requested change, no " +
      "refactors, no extra features, nothing outside scope; standard = the full brief with its DoD " +
      "and the root cause of what it touches; thorough = the brief plus sensible adjacent work, " +
      "announced first. This parameter rules the worker's scope.",
  ),
  thinking_level: z.string().min(1).max(80).optional().describe(
    "Thinking level for subagent_type=auton-worker, e.g. low, medium, high, max. " +
      "This travels apart from effort: effort sets how much adjacent work is allowed, " +
      "thinking_level sets how hard the worker reasons before acting.",
  ),
  mode: AutonWorkerTaskModeSchema.catch(DEFAULT_AUTON_WORKER_TASK_MODE)
    .optional()
    .describe(
      "Class of work for subagent_type=auton-worker, separate from effort. " +
        "build (default) writes the code; read explores and reports with file paths, never writing; " +
        "research compares outside options and closes with a recommendation with reasons, never a link list; " +
        "debug reproduces the failure and names the root cause, without fixing it; " +
        "refactor changes the shape while the tests stay green and behavior stays the same. " +
        "read and research cannot modify the workspace: their write tools are removed. " +
        "An unknown value falls back to build.",
    ),
  item_id: z
    .string()
    .optional()
    .describe(
      "Plan item this programmer is working on (id from AutonPlan). File changes are tagged with " +
        "it, so AutonRevert can undo a single item later.",
    ),
  prompt: z
    .string()
    .describe(
      "The task for the agent to perform. For subagent_type=auton-worker, write the brief: scope, " +
        "definition of done and constraints. The effort policy travels in the `effort` field, so the " +
        "brief does not need a policy line.",
    ),
  subagent_type: z
    .string()
    .optional()
    .describe(
      "The type of specialized agent to use for this task. Use 'auton-worker' for Auton programmers " +
        "dispatched by the orchestrator: they answer to the orchestrator, not to the human, and close " +
        "with a REPORTE block (STATUS/HICE/PROBE/ARCHIVOS/DUDAS).",
    ),
  worker_mode: z
    .enum(["subagent", "session"])
    .optional()
    .describe(
      "Only for subagent_type=auton-worker. 'session' (default) opens a complete ZCode session for the " +
        "worker: full toolset, its own isolated workspace and its own browser to test its work. " +
        "'subagent' is the fallback: the worker runs with the narrowed subagent tool policy and shares " +
        "the orchestrator's workspace. Use 'subagent' only for a small, file-bounded change or as the " +
        "escape hatch if the session path fails.",
    ),
  // subagent 模型由 Settings / Markdown profile 统一决定；若把调用级
  // model 暴露给父模型，历史 tool call 会持续生成旧 override 并覆盖当前配置。
  run_in_background: z
    .boolean()
    .optional()
    .describe(
      "Set to true to run this agent in the background. You will be notified when it completes.",
    ),
});

export type AgentInput = z.infer<typeof AgentInputSchema>;

export const AgentInputJsonSchema = toToolJsonSchema(AgentInputSchema);

export interface AgentTextContentBlock {
  type: "text";
  text: string;
}

export interface AgentCompletedOutput {
  status: "completed";
  agentId: string;
  agentType: AgentType;
  description: string;
  prompt: string;
  content: AgentTextContentBlock[];
  totalToolUseCount: number;
  totalDurationMs: number;
  totalTokens?: number;
  usage?: ModelUsage;
}

export interface AgentBackgroundedOutput {
  status: "async_launched";
  isAsync: true;
  agentId: string;
  agentType: AgentType;
  description: string;
  prompt: string;
  childSessionId: string;
  backgroundTaskId: string;
  outputFile: string;
  canReadOutputFile: boolean;
}

export type AgentOutput = AgentCompletedOutput | AgentBackgroundedOutput;

export const AgentTextContentBlockSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .strict();

export const AgentCompletedOutputSchema = z
  .object({
    status: z.literal("completed"),
    agentId: z.string(),
    agentType: z.string(),
    description: z.string(),
    prompt: z.string(),
    content: z.array(AgentTextContentBlockSchema),
    totalToolUseCount: z.number().int().nonnegative(),
    totalDurationMs: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative().optional(),
    usage: z.record(z.unknown()).optional(),
  })
  .strict();

export const AgentBackgroundedOutputSchema = z
  .object({
    status: z.literal("async_launched"),
    isAsync: z.literal(true),
    agentId: z.string(),
    agentType: z.string(),
    description: z.string(),
    prompt: z.string(),
    childSessionId: z.string(),
    backgroundTaskId: z.string(),
    outputFile: z.string(),
    canReadOutputFile: z.boolean(),
  })
  .strict();

export const AgentOutputSchema = z.union([
  AgentCompletedOutputSchema,
  AgentBackgroundedOutputSchema,
]);

export const AgentOutputJsonSchema = toToolJsonSchema(AgentOutputSchema);

export interface AgentToolCall {
  id: ToolCallId;
  name: "Agent";
  input: AgentInput;
  traceId: TraceId;
  startedAt: Date;
}

export interface AgentToolResult {
  toolCallId: ToolCallId;
  output: AgentOutput;
  traceId: TraceId;
  durationMs: number;
}

export const AgentErrorCode = {
  SUBAGENT_UNAVAILABLE: "agent_subagent_unavailable",
  BACKGROUND_UNAVAILABLE: "agent_background_unavailable",
  UNKNOWN_AGENT_TYPE: "agent_unknown_type",
  CHILD_RUNTIME_FAILED: "agent_child_runtime_failed",
} as const;

export type AgentErrorCode = (typeof AgentErrorCode)[keyof typeof AgentErrorCode];
