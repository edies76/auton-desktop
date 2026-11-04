// ============================================================
// Auton registry — contrato del evento durable (Nivel 1A)
// ============================================================
// El registro durable es un archivo JSONL append-only en
// <workspace>/.auton/registry.jsonl. Cada línea es un evento ya redactado y
// topado; nunca lleva el contenido before/after de un cambio. Este contrato es
// la frontera entre quien escribe el registro y quien lo lee.

import { z } from "zod";

export const AUTON_REGISTRY_FILE_VERSION = 1;

export const AUTON_REGISTRY_FILE_NAME = "registry.jsonl";

export const AUTON_REGISTRY_KINDS = [
  "goal",
  "sprint",
  "dispatch",
  "report",
  "decision",
  "artifact",
  "change",
  "revert",
] as const;

export const AutonRegistryKindSchema = z.enum(AUTON_REGISTRY_KINDS);

export type AutonRegistryKind = (typeof AUTON_REGISTRY_KINDS)[number];

const MAX_ID_LENGTH = 160;
const MAX_AT_LENGTH = 64;
const MAX_TITLE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 800;
const MAX_REFS = 20;
const MAX_REF_LENGTH = 300;
const MAX_SOURCE_LENGTH = 200;
const MAX_STATUS_LENGTH = 64;
const MAX_AGENT_ID_LENGTH = 160;
const MAX_ITEM_ID_LENGTH = 160;
const MAX_PATHS = 50;
const MAX_PATH_LENGTH = 500;
const MAX_DEDUPE_KEY_LENGTH = 300;

const refsSchema = z
  .array(z.string().max(MAX_REF_LENGTH))
  .max(MAX_REFS)
  .default([]);

const pathsSchema = z.array(z.string().max(MAX_PATH_LENGTH)).max(MAX_PATHS);

/**
 * Un evento que ya vive en el log. Es estricto: cualquier clave fuera de este
 * contrato (por ejemplo `before` o `after`) invalida la línea.
 */
export const AutonRegistryEventSchema = z
  .object({
    version: z.literal(AUTON_REGISTRY_FILE_VERSION).default(AUTON_REGISTRY_FILE_VERSION),
    id: z.string().min(1).max(MAX_ID_LENGTH),
    at: z.string().min(1).max(MAX_AT_LENGTH),
    kind: AutonRegistryKindSchema,
    title: z.string().min(1).max(MAX_TITLE_LENGTH),
    summary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
    refs: refsSchema,
    source: z.string().min(1).max(MAX_SOURCE_LENGTH),
    status: z.string().max(MAX_STATUS_LENGTH).optional(),
    agentId: z.string().max(MAX_AGENT_ID_LENGTH).optional(),
    itemId: z.string().max(MAX_ITEM_ID_LENGTH).optional(),
    paths: pathsSchema.optional(),
    dedupeKey: z.string().max(MAX_DEDUPE_KEY_LENGTH).optional(),
  })
  .strict();

export type AutonRegistryEvent = z.infer<typeof AutonRegistryEventSchema>;

/**
 * Lo que un escritor entrega: el almacén completa `version`, `at` e `id` cuando
 * faltan, redacta secretos y aplica topes antes de persistir.
 *
 * `title`, `summary`, `refs` y `paths` no declaran tope aquí a propósito: el
 * almacén los redacta y trunca después de validar la forma. Si el contrato de
 * entrada rechazara los textos largos, el tope nunca podría aplicarse.
 */
export const AutonRegistryAppendInputSchema = z
  .object({
    version: z.literal(AUTON_REGISTRY_FILE_VERSION).optional(),
    id: z.string().min(1).max(MAX_ID_LENGTH).optional(),
    at: z.string().min(1).max(MAX_AT_LENGTH).optional(),
    kind: AutonRegistryKindSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    refs: z.array(z.string()).default([]),
    source: z.string().min(1).max(MAX_SOURCE_LENGTH),
    status: z.string().max(MAX_STATUS_LENGTH).optional(),
    agentId: z.string().max(MAX_AGENT_ID_LENGTH).optional(),
    itemId: z.string().max(MAX_ITEM_ID_LENGTH).optional(),
    paths: z.array(z.string()).optional(),
    dedupeKey: z.string().max(MAX_DEDUPE_KEY_LENGTH).optional(),
  })
  .strict();

export type AutonRegistryAppendInput = z.infer<typeof AutonRegistryAppendInputSchema>;

export const AutonRegistryAppendReasonSchema = z.enum([
  "duplicate_id",
  "duplicate_dedupe_key",
]);

export type AutonRegistryAppendReason = z.infer<typeof AutonRegistryAppendReasonSchema>;

export const AutonRegistryAppendResultSchema = z
  .object({
    appended: z.boolean(),
    record: AutonRegistryEventSchema.optional(),
    reason: AutonRegistryAppendReasonSchema.optional(),
  })
  .strict();

export type AutonRegistryAppendResult = z.infer<typeof AutonRegistryAppendResultSchema>;

export const AutonRegistryLogWarningCodeSchema = z.enum([
  "malformed_line",
  "invalid_record",
  "duplicate_id",
]);

export type AutonRegistryLogWarningCode = z.infer<
  typeof AutonRegistryLogWarningCodeSchema
>;

export const AutonRegistryLogWarningSchema = z
  .object({
    code: AutonRegistryLogWarningCodeSchema,
    /** Línea o registro de origen, por ejemplo `registry.jsonl:3`. */
    source: z.string(),
    message: z.string(),
  })
  .strict();

export type AutonRegistryLogWarning = z.infer<typeof AutonRegistryLogWarningSchema>;

export const AutonRegistryLogSchema = z
  .object({
    version: z.literal(AUTON_REGISTRY_FILE_VERSION),
    generatedAt: z.string(),
    records: z.array(AutonRegistryEventSchema),
    warnings: z.array(AutonRegistryLogWarningSchema),
  })
  .strict();

export type AutonRegistryLog = z.infer<typeof AutonRegistryLogSchema>;
