// ============================================================
// Auton registry — índice persistente (Nivel 1C)
// ============================================================
// El índice es una caché derivada de <workspace>/.auton/registry.jsonl. Se
// escribe de forma atómica y solo se usa si su `sourceBytes` coincide con el
// tamaño real del log. Si no coincide, o si el esquema no valida, se descarta y
// se vuelve a leer el log. Un fallo al escribir el índice nunca tumba la
// escritura del evento: el log es la fuente de verdad.

import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  AUTON_REGISTRY_FILE_NAME,
  AUTON_REGISTRY_INDEX_FILE_NAME,
  AUTON_REGISTRY_INDEX_FILE_VERSION,
  AutonRegistryIndexSchema,
  type AutonRegistryIndex,
  type AutonRegistryLog,
} from "@zcode/contracts";
import { AUTON_DIR_NAME } from "./journal.js";
import { readRegistryLog } from "./registry-log.js";

/** Ruta del índice derivado dentro del workspace. */
export function registryIndexPath(workspaceRoot: string): string {
  return join(workspaceRoot, AUTON_DIR_NAME, AUTON_REGISTRY_INDEX_FILE_NAME);
}

function registryLogPath(workspaceRoot: string): string {
  return join(workspaceRoot, AUTON_DIR_NAME, AUTON_REGISTRY_FILE_NAME);
}

/** Tamaño real del log en bytes; 0 si todavía no existe. */
function registryLogBytes(workspaceRoot: string): number {
  const path = registryLogPath(workspaceRoot);
  if (!existsSync(path)) return 0;
  return statSync(path).size;
}

/**
 * Lee el índice solo si es fresco: existe, valida el contrato y su
 * `sourceBytes` coincide con el tamaño actual de registry.jsonl. Si el log no
 * existe, no hay índice válido.
 */
export function readRegistryIndex(workspaceRoot: string): AutonRegistryIndex | null {
  const logPath = registryLogPath(workspaceRoot);
  if (!existsSync(logPath)) return null;

  const indexPath = registryIndexPath(workspaceRoot);
  if (!existsSync(indexPath)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(indexPath, "utf8"));
  } catch {
    return null;
  }

  const result = AutonRegistryIndexSchema.safeParse(parsed);
  if (!result.success) return null;
  if (result.data.sourceBytes !== registryLogBytes(workspaceRoot)) return null;
  return result.data;
}

/**
 * Reconstruye y escribe el índice desde el log. Es atómico: el JSON se escribe
 * en un temporal del mismo directorio y se renombra encima. El índice es caché,
 * así que un workspace no escribible no lanza.
 */
export function writeRegistryIndex(
  workspaceRoot: string,
  log: AutonRegistryLog,
  now: Date = new Date(),
): AutonRegistryIndex {
  const draft: AutonRegistryIndex = {
    version: AUTON_REGISTRY_INDEX_FILE_VERSION,
    generatedAt: now.toISOString(),
    sourceBytes: registryLogBytes(workspaceRoot),
    records: log.records,
    warnings: log.warnings,
  };

  const index = AutonRegistryIndexSchema.parse(draft);
  const dir = join(workspaceRoot, AUTON_DIR_NAME);
  const target = registryIndexPath(workspaceRoot);
  const temp = join(
    dir,
    `.${AUTON_REGISTRY_INDEX_FILE_NAME}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(temp, `${JSON.stringify(index)}\n`, "utf8");
    renameSync(temp, target);
  } catch {
    // El índice es una caché: si no se puede escribir, el log sigue mandando.
    try {
      rmSync(temp, { force: true });
    } catch {
      // Nada que limpiar.
    }
  }

  return index;
}

/** Relee el log y reconstruye el índice desde cero. */
export function refreshRegistryIndex(
  workspaceRoot: string,
  now: Date = new Date(),
): AutonRegistryIndex {
  return writeRegistryIndex(workspaceRoot, readRegistryLog(workspaceRoot, now), now);
}

/**
 * Lectura acelerada del log: usa el índice solo si es fresco y, cuando no lo
 * es, cae al log y deja el índice reconstruido como mejor esfuerzo.
 */
export function readRegistryLogCached(
  workspaceRoot: string,
  now: Date = new Date(),
): AutonRegistryLog {
  const cached = readRegistryIndex(workspaceRoot);
  if (cached) {
    return {
      version: cached.version,
      generatedAt: now.toISOString(),
      records: cached.records,
      warnings: cached.warnings,
    };
  }

  const log = readRegistryLog(workspaceRoot, now);
  try {
    writeRegistryIndex(workspaceRoot, log, now);
  } catch {
    // El índice es una caché; la lectura del log ya es válida.
  }
  return log;
}
