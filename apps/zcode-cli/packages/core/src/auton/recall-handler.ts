// ============================================================
// Auton Recall Tool Handler (Nivel 1B)
// ============================================================
// El orquestador consulta la memoria durable del proyecto: plan, diario,
// reversiones y eventos de .auton/registry.jsonl. Devuelve como máximo unas
// pocas líneas con id y fuente; nunca el contenido de los archivos ni el par
// before/after.

import {
  AUTON_RECALL_TOOL_NAME,
  AutonRecallInputJsonSchema,
  AutonRecallInputSchema,
  AutonRecallOutputJsonSchema,
  AutonRecallOutputSchema,
  type AutonRecallInput,
  type AutonRecallMatch,
  type AutonRecallOutput,
} from "@zcode/contracts";
import {
  formatAutonRegistryMatches,
  readAutonRegistry,
  searchAutonRegistry,
  type AutonRegistryRecord,
} from "./registry.js";
import type { ToolEntry, ToolHandler } from "../tool/types.js";

const MAX_AUTON_RECALL_MODEL_BYTES = 12000;
const AUTON_RECALL_TIMEOUT_MS = 10000;

function projectRoot(context: {
  workingDirectory: string;
  workspaceRoot?: string;
}): string {
  return context.workspaceRoot?.trim() || context.workingDirectory;
}

function toRecallMatch(record: AutonRegistryRecord): AutonRecallMatch {
  return {
    id: record.id,
    kind: record.kind,
    ...(record.at ? { at: record.at } : {}),
    title: record.title,
    summary: record.summary,
    refs: record.refs,
    source: record.source,
  };
}

export const autonRecallHandler: ToolHandler = async (input, context) => {
  const parsed = AutonRecallInputSchema.parse(input) as AutonRecallInput;
  const workspaceRoot = projectRoot(context);

  const snapshot = readAutonRegistry(workspaceRoot);
  const result = searchAutonRegistry(snapshot, {
    ...(parsed.id !== undefined ? { id: parsed.id } : {}),
    ...(parsed.query !== undefined ? { text: parsed.query } : {}),
    ...(parsed.kind !== undefined ? { kind: parsed.kind } : {}),
    ...(parsed.ref !== undefined ? { ref: parsed.ref } : {}),
    limit: parsed.limit,
  });

  return {
    text: formatAutonRegistryMatches(result),
    matches: result.matches.map(({ record }) => toRecallMatch(record)),
    total: result.total,
    truncated: result.truncated,
  } satisfies AutonRecallOutput;
};

export const autonRecallToolEntry: ToolEntry = {
  capability:
    "Search Auton's durable memory in this workspace by text, id, reference or kind",
  metadata: {
    name: AUTON_RECALL_TOOL_NAME,
    searchHint: "durable memory, what happened before, registry search",
    description: `Search Auton's durable memory for this project: the plan, the change journal, reverts and the durable events at <workspace>/.auton/registry.jsonl.

Use it when you need to know what already happened before planning or dispatching work.
Select by \`query\` (title, summary or references), \`id\` (exact card id), \`ref\` (exact reference) or \`kind\` (goal, sprint, dispatch, report, decision, artifact, change, revert); at least one selector is required.
It returns at most \`limit\` lines (5 by default, 20 maximum). Each line carries the card id and its source so you can point to evidence. It never returns file contents or the before/after bodies of a change.`,
    readOnly: true,
    destructive: false,
    concurrentSafe: true,
    timeoutMs: AUTON_RECALL_TIMEOUT_MS,
    maxOutputBytes: MAX_AUTON_RECALL_MODEL_BYTES,
    sideEffectScope: "workspace",
    riskLevel: "low",
    needsApproval: false,
  },
  handler: autonRecallHandler,
  inputSchema: AutonRecallInputJsonSchema,
  outputSchema: AutonRecallOutputJsonSchema,
  runtimeInputSchema: AutonRecallInputSchema,
  runtimeOutputSchema: AutonRecallOutputSchema,
  permission: {
    permission: "auton.recall",
    reason: "AutonRecall only reads the project's durable memory inside the workspace",
    riskLevel: "low",
    sideEffectScope: "workspace",
    needsApproval: false,
    patternSources: ["toolName"],
    alwaysAllowPatternSources: ["toolName"],
    denyPriority: "beforeAsk",
  },
  resultBudget: {
    maxInlineBytes: MAX_AUTON_RECALL_MODEL_BYTES,
    maxModelBytes: MAX_AUTON_RECALL_MODEL_BYTES,
    strategy: "truncate",
    preview: {
      maxBytes: MAX_AUTON_RECALL_MODEL_BYTES,
      direction: "head",
    },
  },
  timeout: {
    defaultMs: AUTON_RECALL_TIMEOUT_MS,
    maxMs: AUTON_RECALL_TIMEOUT_MS,
    allowCallOverride: false,
  },
  cancellation: {
    supported: true,
    cleanup: "none",
    userVisibleMessage: "AutonRecall was cancelled before reading the registry",
  },
  trace: {
    required: true,
    propagateToAdapters: false,
    recordInput: "summary",
    recordOutput: "summary",
  },
};
