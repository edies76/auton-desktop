// ============================================================
// Auton Revert Tool Handler
// ============================================================
// El orquestador deshace el trabajo de un programador con orden: selecciona por
// agente, item del plan o paths; escribe el contenido previo byte a byte y deja
// rastro en .auton/reverts.jsonl. Nunca usa git de forma destructiva.

import {
  AUTON_REVERT_TOOL_NAME,
  AutonRevertInputJsonSchema,
  AutonRevertOutputJsonSchema,
  AutonRevertOutputSchema,
  AutonRevertSelectionSchema,
  type AutonRevertOutput,
} from "@zcode/contracts";
import { executeRevert } from "./revert-executor.js";
import { readChanges } from "./journal.js";
import { planRevert } from "./revert-plan.js";
import type { ToolEntry, ToolHandler } from "../tool/types.js";

function projectRoot(context: { workingDirectory: string; workspaceRoot?: string }): string {
  return context.workspaceRoot?.trim() || context.workingDirectory;
}

export const autonRevertHandler: ToolHandler = async (input, context) => {
  const selection = AutonRevertSelectionSchema.parse(input);
  const hasSelector =
    selection.all === true ||
    selection.agentId !== undefined ||
    selection.itemId !== undefined ||
    (selection.paths?.length ?? 0) > 0;

  if (!hasSelector) {
    throw new Error(
      "AutonRevert needs a selector: agentId, itemId, paths, or all: true.",
    );
  }

  const workspaceRoot = projectRoot(context);
  const records = readChanges(workspaceRoot);
  const plan = planRevert(records, selection);
  const execution = executeRevert({ workspaceRoot, plan, selection });

  const result: AutonRevertOutput["result"] =
    execution.reverted === execution.results.length && execution.reverted > 0
      ? "reverted"
      : execution.reverted > 0
        ? "partial"
        : execution.already > 0 && execution.conflicts === 0 && execution.blocked === 0
          ? "already"
          : "blocked";

  return {
    result,
    files: execution.results,
    auditPath: execution.auditPath,
  } satisfies AutonRevertOutput;
};

export const autonRevertToolEntry: ToolEntry = {
  capability: "Undo the file changes a programmer made in this workspace",
  metadata: {
    name: AUTON_REVERT_TOOL_NAME,
    searchHint: "revert undo programmer changes",
    description: `Undo work a programmer did in this workspace, using the change journal at <workspace>/.auton/changes.jsonl.

Select with:
- \`agentId\`: every change that programmer made.
- \`itemId\`: the changes tagged with that plan item.
- \`paths\`: only those workspace-relative files; the rest of the programmer's work stays applied.
- \`all: true\`: everything recorded.

Total revert restores files byte for byte to their content before the change and deletes files that did not exist. A file that changed after the recorded edit is reported as \`conflict\` and is never overwritten. Reverting twice is safe: the second call reports \`already\`. Every call appends a line to <workspace>/.auton/reverts.jsonl.`,
    readOnly: false,
    destructive: true,
    concurrentSafe: false,
    timeoutMs: 60000,
    maxOutputBytes: 60000,
    sideEffectScope: "workspace",
    riskLevel: "medium",
    needsApproval: false,
  },
  handler: autonRevertHandler,
  inputSchema: AutonRevertInputJsonSchema,
  outputSchema: AutonRevertOutputJsonSchema,
  runtimeInputSchema: AutonRevertSelectionSchema,
  runtimeOutputSchema: AutonRevertOutputSchema,
  permission: {
    permission: "auton.revert",
    reason: "AutonRevert restores recorded file content inside the workspace",
    riskLevel: "medium",
    sideEffectScope: "workspace",
    needsApproval: false,
    patternSources: ["toolName"],
    alwaysAllowPatternSources: ["toolName"],
    denyPriority: "beforeAsk",
  },
  resultBudget: {
    maxInlineBytes: 60000,
    maxModelBytes: 60000,
    strategy: "truncate",
    preview: { maxBytes: 60000, direction: "head" },
  },
  timeout: { defaultMs: 60000, maxMs: 60000, allowCallOverride: false },
  cancellation: {
    supported: true,
    cleanup: "none",
    userVisibleMessage: "AutonRevert was cancelled before finishing",
  },
  trace: {
    required: true,
    propagateToAdapters: false,
    recordInput: "summary",
    recordOutput: "summary",
  },
};
