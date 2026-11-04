import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  AUTON_PLAN_FILE_VERSION,
  AUTON_REPORT_TOOL_NAME,
  AUTON_MAX_LIMIT_REPORTS,
  AutonPlanSchema,
  AutonReportInputJsonSchema,
  AutonReportInputSchema,
  AutonReportOutputJsonSchema,
  AutonReportOutputSchema,
  normalizeLegacyPlan,
  type AutonPlan,
  type AutonReportInput,
  type AutonReportOutput,
} from "@zcode/contracts";
import type { ToolEntry, ToolHandler } from "../tool/types.js";
import { resolveAutonPlanPath } from "./plan-handler.js";

function projectRoot(context: { workingDirectory: string; workspaceRoot?: string }): string {
  return context.workspaceRoot?.trim() || context.workingDirectory;
}

async function readPlan(path: string): Promise<AutonPlan> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const result = AutonPlanSchema.safeParse(parsed);
    return result.success
      ? normalizeLegacyPlan(result.data)
      : { version: AUTON_PLAN_FILE_VERSION, limitHistory: [], limitReports: [], items: [] };
  } catch {
    return { version: AUTON_PLAN_FILE_VERSION, limitHistory: [], limitReports: [], items: [] };
  }
}

export const autonReportHandler: ToolHandler = async (input, context) => {
  const parsed = AutonReportInputSchema.parse(input) as AutonReportInput;
  const path = resolveAutonPlanPath(projectRoot(context));
  const plan = await readPlan(path);
  const report = {
    at: new Date().toISOString(),
    field: parsed.field,
    observed: parsed.observed,
    ...(parsed.expected ? { expected: parsed.expected } : {}),
    by: String(context.sessionId ?? "worker"),
    ...(parsed.note ? { note: parsed.note } : {}),
  };
  const next: AutonPlan = {
    ...plan,
    version: plan.version ?? AUTON_PLAN_FILE_VERSION,
    limitReports: [...plan.limitReports, report].slice(-AUTON_MAX_LIMIT_REPORTS),
    updatedAt: new Date().toISOString(),
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { path, report } satisfies AutonReportOutput;
};

export const autonReportToolEntry: ToolEntry = {
  capability:
    "Report a miscalibrated Auton limit to the orchestrator without changing the plan's limits",
  metadata: {
    name: AUTON_REPORT_TOOL_NAME,
    searchHint: "report limit miscalibrated worker",
    description: `Report a limit that looks wrong to the orchestrator. Use it when a limit blocked or misled your work; the orchestrator decides whether to change it.

This tool only appends a report to the plan; it cannot change limits or work items. Include the field, what you observed, what you expected, and a short note.`,
    readOnly: false,
    destructive: false,
    concurrentSafe: false,
    timeoutMs: 30000,
    maxOutputBytes: 16_000,
    sideEffectScope: "workspace",
    riskLevel: "low",
    needsApproval: false,
  },
  handler: autonReportHandler,
  inputSchema: AutonReportInputJsonSchema,
  outputSchema: AutonReportOutputJsonSchema,
  runtimeInputSchema: AutonReportInputSchema,
  runtimeOutputSchema: AutonReportOutputSchema,
  permission: {
    permission: "auton.report",
    reason: "AutonReport appends a limit report to .auton/plan.json",
    riskLevel: "low",
    sideEffectScope: "workspace",
    needsApproval: false,
    patternSources: ["toolName"],
    alwaysAllowPatternSources: ["toolName"],
    denyPriority: "beforeAsk",
  },
  resultBudget: {
    maxInlineBytes: 16_000,
    maxModelBytes: 16_000,
    strategy: "truncate",
    preview: { maxBytes: 16_000, direction: "head" },
  },
  timeout: { defaultMs: 30000, maxMs: 30000, allowCallOverride: false },
  cancellation: {
    supported: true,
    cleanup: "none",
    userVisibleMessage: "AutonReport was cancelled before the report was saved",
  },
  trace: {
    required: true,
    propagateToAdapters: false,
    recordInput: "summary",
    recordOutput: "summary",
  },
};
