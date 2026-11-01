// ============================================================
// Auton Plan Tool Handler
// ============================================================
// The orchestrator owns the plan. It lives on disk so the desktop surfaces
// (Sprint Board, Decision Inbox) can read it without going through a session.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  AUTON_PLAN_FILE_VERSION,
  AUTON_PLAN_TOOL_NAME,
  AutonPlanInputJsonSchema,
  AutonPlanInputSchema,
  AutonPlanOutputJsonSchema,
  AutonPlanOutputSchema,
  AutonPlanSchema,
  summarizeAutonPlan,
  type AutonPlan,
  type AutonPlanInput,
  type AutonPlanOutput,
} from "@zcode/contracts";
import type { ToolEntry, ToolHandler } from "../types.js";

const MAX_AUTON_PLAN_MODEL_BYTES = 60_000;

export function resolveAutonPlanPath(workingDirectory: string): string {
  return join(workingDirectory, ".auton", "plan.json");
}

function projectRoot(context: {
  workingDirectory: string;
  workspaceRoot?: string;
}): string {
  return context.workspaceRoot?.trim() || context.workingDirectory;
}

async function readPlanFile(path: string): Promise<AutonPlan> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: AUTON_PLAN_FILE_VERSION, items: [] };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { version: AUTON_PLAN_FILE_VERSION, items: [] };
  }

  const result = AutonPlanSchema.safeParse(parsed);
  return result.success
    ? { ...result.data, items: result.data.items ?? [] }
    : { version: AUTON_PLAN_FILE_VERSION, items: [] };
}

export const autonPlanHandler: ToolHandler = async (input, context) => {
  const parsed = AutonPlanInputSchema.parse(input) as AutonPlanInput;
  const path = resolveAutonPlanPath(projectRoot(context));

  if (parsed.action === "read") {
    const plan = await readPlanFile(path);
    return {
      path,
      plan,
      summary: summarizeAutonPlan(plan.items),
    } satisfies AutonPlanOutput;
  }

  // write: the orchestrator sends the complete plan; it replaces the file.
  const plan: AutonPlan = {
    version: AUTON_PLAN_FILE_VERSION,
    goal: parsed.goal,
    items: parsed.items,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  return {
    path,
    plan,
    summary: summarizeAutonPlan(plan.items),
  } satisfies AutonPlanOutput;
};

export const autonPlanToolEntry: ToolEntry = {
  capability:
    "Read or write the project's Auton plan at <workspace>/.auton/plan.json, the plan the human sees",
  metadata: {
    // No se difiere: el plan es la herramienta central del orquestador y debe
    // estar en la lista del modelo desde el primer turno.
    name: AUTON_PLAN_TOOL_NAME,
    searchHint: "project sprint plan, goal and work items",
    description: `Read or write the Auton plan for this project. The plan is stored at <workspace>/.auton/plan.json and is what the human sees as the sprint board.

Use \`action: "read"\` to load the current plan before you plan or dispatch anything.
Use \`action: "write"\` with the COMPLETE list of work items to replace the plan; it is the source of truth, so send every item each time.

Work item statuses: ready, running, waiting, blocked, done, dropped. Use \`waiting\` when an item needs a human decision, and put that question in \`questions\`.
Set \`effort\` (minimal, standard, thorough) and \`files\` on every item you dispatch, and paste the same effort line into the programmer's brief.`,
    readOnly: false,
    destructive: false,
    concurrentSafe: false,
    timeoutMs: 30000,
    maxOutputBytes: MAX_AUTON_PLAN_MODEL_BYTES,
    sideEffectScope: "workspace",
    riskLevel: "low",
    needsApproval: false,
  },
  handler: autonPlanHandler,
  inputSchema: AutonPlanInputJsonSchema,
  outputSchema: AutonPlanOutputJsonSchema,
  runtimeInputSchema: AutonPlanInputSchema,
  runtimeOutputSchema: AutonPlanOutputSchema,
  permission: {
    permission: "auton.plan",
    reason: "AutonPlan only updates the project's .auton/plan.json",
    riskLevel: "low",
    sideEffectScope: "workspace",
    needsApproval: false,
    patternSources: ["toolName"],
    alwaysAllowPatternSources: ["toolName"],
    denyPriority: "beforeAsk",
  },
  resultBudget: {
    maxInlineBytes: MAX_AUTON_PLAN_MODEL_BYTES,
    maxModelBytes: MAX_AUTON_PLAN_MODEL_BYTES,
    strategy: "truncate",
    preview: {
      maxBytes: MAX_AUTON_PLAN_MODEL_BYTES,
      direction: "head",
    },
  },
  timeout: {
    defaultMs: 30000,
    maxMs: 30000,
    allowCallOverride: false,
  },
  cancellation: {
    supported: true,
    cleanup: "none",
    userVisibleMessage: "AutonPlan was cancelled before the plan was updated",
  },
  trace: {
    required: true,
    propagateToAdapters: false,
    recordInput: "summary",
    recordOutput: "summary",
  },
};
