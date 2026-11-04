// ============================================================
// Auton Recall Tool — consultar la memoria durable (Nivel 1B)
// ============================================================
// El orquestador pregunta por lo que ya pasó y recibe como máximo unas pocas
// líneas con id y fuente. Nunca devuelve el contenido de los archivos ni el par
// before/after: solo fichas del registro.

import { z } from "zod";
import { toToolJsonSchema } from "../tools/json-schema.js";
import { AutonRegistryKindSchema } from "./registry.js";

export const AUTON_RECALL_TOOL_NAME = "AutonRecall";

const MAX_QUERY_LENGTH = 300;
const MAX_ID_LENGTH = 160;
const MAX_REF_LENGTH = 300;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

const AutonRecallSelectorsSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1)
      .max(MAX_QUERY_LENGTH)
      .optional()
      .describe("Texto libre: título, resumen o referencias de una ficha durable"),
    id: z
      .string()
      .min(1)
      .max(MAX_ID_LENGTH)
      .optional()
      .describe("Identificador exacto de una ficha, por ejemplo item:s1 o evt:..."),
    kind: AutonRegistryKindSchema.optional().describe("Tipo de ficha que se busca"),
    ref: z
      .string()
      .min(1)
      .max(MAX_REF_LENGTH)
      .optional()
      .describe("Referencia exacta, por ejemplo item:s1 o src/login.ts"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .default(DEFAULT_LIMIT)
      .describe("Máximo de líneas a devolver; 5 por defecto, 20 como tope"),
  })
  .strict();

/**
 * Al menos uno de `query`, `id`, `ref` o `kind` debe venir. Sin selector la
 * herramienta no adivina: falla por validación.
 */
export const AutonRecallInputSchema = AutonRecallSelectorsSchema.refine(
  (value) =>
    value.query !== undefined ||
    value.id !== undefined ||
    value.kind !== undefined ||
    value.ref !== undefined,
  {
    message: "AutonRecall necesita al menos un selector: query, id, ref o kind.",
    path: ["query"],
  },
);

export type AutonRecallInput = z.infer<typeof AutonRecallInputSchema>;

export const AutonRecallMatchSchema = z
  .object({
    id: z.string().min(1),
    kind: AutonRegistryKindSchema,
    at: z.string().optional(),
    title: z.string(),
    summary: z.string(),
    refs: z.array(z.string()),
    source: z.string(),
  })
  .strict();

export type AutonRecallMatch = z.infer<typeof AutonRecallMatchSchema>;

export const AutonRecallOutputSchema = z
  .object({
    text: z.string(),
    matches: z.array(AutonRecallMatchSchema),
    total: z.number().int().nonnegative(),
    truncated: z.boolean(),
  })
  .strict();

export type AutonRecallOutput = z.infer<typeof AutonRecallOutputSchema>;

export const AutonRecallInputJsonSchema = toToolJsonSchema(AutonRecallSelectorsSchema);
export const AutonRecallMatchJsonSchema = toToolJsonSchema(AutonRecallMatchSchema);
export const AutonRecallOutputJsonSchema = toToolJsonSchema(AutonRecallOutputSchema);
