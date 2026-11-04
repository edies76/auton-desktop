// ============================================================
// Auton registry — lectura del log append-only
// ============================================================
// Separado del almacén para que el índice derivado pueda leer el log sin
// cerrar un ciclo de imports con el append.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTON_REGISTRY_FILE_NAME,
  AUTON_REGISTRY_FILE_VERSION,
  AutonRegistryEventSchema,
  type AutonRegistryEvent,
  type AutonRegistryLog,
  type AutonRegistryLogWarning,
} from "@zcode/contracts";
import { AUTON_DIR_NAME } from "./journal.js";

/** Directorio y archivo del registro durable dentro de un workspace. */
export function registryLogPath(workspaceRoot: string): string {
  return join(workspaceRoot, AUTON_DIR_NAME, AUTON_REGISTRY_FILE_NAME);
}

function readRawLog(workspaceRoot: string): string | null {
  const path = registryLogPath(workspaceRoot);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function parseLines(raw: string): Array<{ line: number; text: string }> {
  const lines: Array<{ line: number; text: string }> = [];
  const parts = raw.split(/\r?\n/);
  for (let index = 0; index < parts.length; index += 1) {
    const text = parts[index]?.trim() ?? "";
    if (text.length === 0) continue;
    lines.push({ line: index + 1, text });
  }
  return lines;
}

/**
 * Lee el registro durable. Tolera líneas corruptas o fuera de contrato: las
 * salta y deja una advertencia, de modo que una línea mala no invalida el resto.
 * Nunca devuelve contenido de archivos, solo los eventos del contrato.
 */
export function readRegistryLog(workspaceRoot: string, now = new Date()): AutonRegistryLog {
  const records: AutonRegistryEvent[] = [];
  const warnings: AutonRegistryLogWarning[] = [];
  const raw = readRawLog(workspaceRoot);

  if (raw !== null) {
    for (const { line, text } of parseLines(raw)) {
      const source = `${AUTON_REGISTRY_FILE_NAME}:${line}`;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        warnings.push({ code: "malformed_line", source, message: "no es JSON válido" });
        continue;
      }
      const result = AutonRegistryEventSchema.safeParse(parsed);
      if (!result.success) {
        warnings.push({
          code: "invalid_record",
          source,
          message: result.error.issues.map((issue) => issue.message).join("; "),
        });
        continue;
      }
      records.push(result.data);
    }
  }

  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) {
      warnings.push({
        code: "duplicate_id",
        source: `${AUTON_REGISTRY_FILE_NAME}`,
        message: `id duplicado: ${record.id}`,
      });
    }
    seen.add(record.id);
  }

  return {
    version: AUTON_REGISTRY_FILE_VERSION,
    generatedAt: now.toISOString(),
    records,
    warnings,
  };
}
