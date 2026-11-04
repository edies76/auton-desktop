// ============================================================
// Auton registry — contrato del índice persistente (Nivel 1C)
// ============================================================
// El índice vive en <workspace>/.auton/registry-index.json y es una caché del
// log durable. Nunca es fuente de verdad: si su `sourceBytes` no coincide con el
// tamaño real de registry.jsonl, se descarta y se reconstruye desde el log.

import { z } from "zod";
import {
  AutonRegistryEventSchema,
  AutonRegistryLogWarningSchema,
} from "./registry.js";

export const AUTON_REGISTRY_INDEX_FILE_VERSION = 1;

export const AUTON_REGISTRY_INDEX_FILE_NAME = "registry-index.json";

export const AutonRegistryIndexSchema = z
  .object({
    version: z.literal(AUTON_REGISTRY_INDEX_FILE_VERSION),
    generatedAt: z.string().min(1),
    /** Tamaño exacto de registry.jsonl cuando se generó el índice. */
    sourceBytes: z.number().int().nonnegative(),
    records: z.array(AutonRegistryEventSchema),
    warnings: z.array(AutonRegistryLogWarningSchema),
  })
  .strict();

export type AutonRegistryIndex = z.infer<typeof AutonRegistryIndexSchema>;
