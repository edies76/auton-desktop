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

const QuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_QUERY_LENGTH)
  .describe("Texto libre: título, resumen o referencias de una ficha durable");

const IdSchema = z
  .string()
  .min(1)
  .max(MAX_ID_LENGTH)
  .describe("Identificador exacto de una ficha, por ejemplo item:s1 o evt:...");

const KindSchema = AutonRegistryKindSchema.describe("Tipo de ficha que se busca");

const RefSchema = z
  .string()
  .min(1)
  .max(MAX_REF_LENGTH)
  .describe("Referencia exacta, por ejemplo item:s1 o src/login.ts");

const LimitSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_LIMIT)
  .default(DEFAULT_LIMIT)
  .describe("Máximo de líneas a devolver; 5 por defecto, 20 como tope");

const sharedSelectors = {
  query: QuerySchema.optional(),
  id: IdSchema.optional(),
  kind: KindSchema.optional(),
  ref: RefSchema.optional(),
  limit: LimitSchema,
};

/**
 * Al menos uno de `query`, `id`, `ref` o `kind` debe venir. Se expresa como
 * unión de cuatro variantes, cada una con un selector obligatorio, para que el
 * JSON Schema visible al modelo también exija uno: `{}` no satisface ninguna.
 */
export const AutonRecallInputSchema = z.union([
  z.object({ ...sharedSelectors, query: QuerySchema }).strict(),
  z.object({ ...sharedSelectors, id: IdSchema }).strict(),
  z.object({ ...sharedSelectors, kind: KindSchema }).strict(),
  z.object({ ...sharedSelectors, ref: RefSchema }).strict(),
]);

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

export const AutonRecallInputJsonSchema = toToolJsonSchema(AutonRecallInputSchema);
// `toToolJsonSchema` normaliza `anyOf` a `oneOf`; aquí la diferencia importa:
// los selectores se pueden combinar (`query` + `kind`), así que "al menos uno"
// es `anyOf`, no "exactamente uno".
if (Array.isArray(AutonRecallInputJsonSchema.oneOf)) {
  AutonRecallInputJsonSchema.anyOf = AutonRecallInputJsonSchema.oneOf;
  delete AutonRecallInputJsonSchema.oneOf;
}
export const AutonRecallMatchJsonSchema = toToolJsonSchema(AutonRecallMatchSchema);
export const AutonRecallOutputJsonSchema = toToolJsonSchema(AutonRecallOutputSchema);
