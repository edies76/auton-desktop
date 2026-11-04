// ============================================================
// Auton Report Tool - worker -> orchestrator limit report
// ============================================================
// El worker nunca cambia los límites. Este canal deja su observación en el
// plan, con el campo y la evidencia, para que el orquestador decida.

import { z } from "zod";
import { toToolJsonSchema } from "../tools/json-schema.js";
import { AutonLimitReportSchema } from "./plan.js";

export const AUTON_REPORT_TOOL_NAME = "AutonReport";

export const AutonReportInputSchema = z
  .object({
    field: z.string().min(1).describe("Which limit looks miscalibrated"),
    observed: z.string().min(1).describe("What you saw that the limit did not cover"),
    expected: z.string().optional().describe("What the limit should have allowed"),
    note: z.string().optional().describe("Anything the orchestrator should know"),
  })
  .strict();

export const AutonReportOutputSchema = z
  .object({
    path: z.string().min(1),
    report: AutonLimitReportSchema,
  })
  .strict();

export type AutonReportInput = z.infer<typeof AutonReportInputSchema>;
export type AutonReportOutput = z.infer<typeof AutonReportOutputSchema>;

export const AutonReportInputJsonSchema = toToolJsonSchema(AutonReportInputSchema);
export const AutonReportOutputJsonSchema = toToolJsonSchema(AutonReportOutputSchema);
