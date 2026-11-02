// ============================================================
// Auton Revert Tool - deshacer el trabajo de un programador
// ============================================================

import { z } from "zod";
import { toToolJsonSchema } from "../tools/json-schema.js";

export const AUTON_REVERT_TOOL_NAME = "AutonRevert";

export const AutonRevertSelectionSchema = z
  .object({
    agentId: z.string().min(1).optional().describe("Revert every change made by this programmer"),
    itemId: z.string().min(1).optional().describe("Revert the changes tagged with this plan item"),
    paths: z
      .array(z.string().min(1))
      .optional()
      .describe("Workspace-relative paths to revert, other changes stay applied"),
    all: z.boolean().optional().describe("Revert every recorded change in the workspace"),
  })
  .strict();

export type AutonRevertSelection = z.infer<typeof AutonRevertSelectionSchema>;

export const AutonRevertOutcomeSchema = z.enum(["reverted", "already", "conflict", "blocked"]);

export const AutonRevertFileResultSchema = z
  .object({
    path: z.string(),
    outcome: AutonRevertOutcomeSchema,
    reason: z.string().optional(),
  })
  .strict();

export const AutonRevertOutputSchema = z
  .object({
    result: z.enum(["reverted", "partial", "already", "blocked"]),
    files: z.array(AutonRevertFileResultSchema),
    auditPath: z.string(),
  })
  .strict();

export type AutonRevertOutput = z.infer<typeof AutonRevertOutputSchema>;

export const AutonRevertInputJsonSchema = toToolJsonSchema(AutonRevertSelectionSchema);
export const AutonRevertOutputJsonSchema = toToolJsonSchema(AutonRevertOutputSchema);
