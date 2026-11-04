// ============================================================
// Auton registry — almacén append-only (Nivel 1A)
// ============================================================
// El registro durable vive en <workspace>/.auton/registry.jsonl. Este módulo
// valida el contrato, completa `id`/`at`, redacta secretos y aplica topes antes
// de hacer append. Nunca reescribe el archivo y nunca guarda el contenido de los
// archivos (`before`/`after`): la lectura tampoco los expone.
//
// Idempotencia: un `id` repetido o un `dedupeKey` repetido devuelven el registro
// ya existente sin volver a escribir.

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  AUTON_REGISTRY_FILE_VERSION,
  AutonRegistryAppendInputSchema,
  AutonRegistryEventSchema,
  type AutonRegistryAppendInput,
  type AutonRegistryAppendResult,
  type AutonRegistryEvent,
  type AutonRegistryLog,
  type AutonRegistryLogWarning,
} from "@zcode/contracts";
import { AUTON_DIR_NAME } from "./journal.js";
import { refreshRegistryIndex } from "./registry-index.js";
import { registryLogPath, readRegistryLog } from "./registry-log.js";

export { readRegistryLog, registryLogPath } from "./registry-log.js";

const MAX_TITLE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 800;
const MAX_REFS = 20;
const MAX_REF_LENGTH = 300;
const MAX_PATHS = 50;
const MAX_PATH_LENGTH = 500;
const HASH_LENGTH = 12;
const ELLIPSIS = "…";
const REDACTED = "[REDACTED]";
const REDACTED_PRIVATE_KEY = "[REDACTED PRIVATE KEY]";

const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi,
    REDACTED_PRIVATE_KEY,
  ],
  // Un bloque sin cierre también se redacta: no dejamos la cabecera ni el cuerpo.
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*/gi, REDACTED_PRIVATE_KEY],
  [/\bBearer\s+[^\s"',;]+/gi, `Bearer ${REDACTED}`],
  [/\bsk-[A-Za-z0-9_-]{6,}/g, REDACTED],
  [/\bghp_[A-Za-z0-9]{10,}/g, REDACTED],
  [/\bgithub_pat_[A-Za-z0-9_]{10,}/g, REDACTED],
  [/\bxoxb-[A-Za-z0-9-]{6,}/g, REDACTED],
  [/\bAKIA[A-Z0-9]{12,}/g, REDACTED],
  [/\b(password|token|api_key|secret)\s*=\s*[^\s,;&"']+/gi, `$1=${REDACTED}`],
];

/** Redacta credenciales conocidas. Idempotente: correrlo dos veces no altera. */
export function redactRegistryText(value: string): string {
  let result = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}${ELLIPSIS}`;
}

function truncateAll(values: readonly string[], maxItems: number, maxLength: number): string[] {
  return values.slice(0, maxItems).map((value) => truncate(value, maxLength));
}

function shortHash(parts: readonly (string | undefined)[]): string {
  return createHash("sha256")
    .update(parts.map((part) => part ?? "").join("|"), "utf8")
    .digest("hex")
    .slice(0, HASH_LENGTH);
}

/** Id determinista para el mismo contenido y el mismo `at`. */
function generatedId(input: AutonRegistryAppendInput, at: string): string {
  const digest = shortHash([
    input.kind,
    input.source,
    input.title,
    input.summary,
    input.dedupeKey,
  ]);
  return `evt:${at}:${digest}`;
}

/** Reutiliza las advertencias de la lectura para decir si el log es sano. */
export function verifyRegistryLog(log: AutonRegistryLog): {
  ok: boolean;
  issues: AutonRegistryLogWarning[];
} {
  const issues = [...log.warnings];
  return { ok: issues.length === 0, issues };
}

function findExisting(
  log: AutonRegistryLog,
  input: AutonRegistryAppendInput,
  id: string,
): { record: AutonRegistryEvent; reason: "duplicate_id" | "duplicate_dedupe_key" } | undefined {
  const byId = log.records.find((record) => record.id === id);
  if (byId) return { record: byId, reason: "duplicate_id" };
  if (input.dedupeKey === undefined) return undefined;
  const byDedupeKey = log.records.find((record) => record.dedupeKey === input.dedupeKey);
  if (byDedupeKey) return { record: byDedupeKey, reason: "duplicate_dedupe_key" };
  return undefined;
}

/**
 * Agrega un evento al registro durable. Es idempotente por `id` y por
 * `dedupeKey`, y nunca reescribe las líneas anteriores.
 */
export function appendRegistryRecord(
  workspaceRoot: string,
  input: AutonRegistryAppendInput,
  options: { now?: Date } = {},
): AutonRegistryAppendResult {
  const parsed = AutonRegistryAppendInputSchema.parse(input);
  const at = parsed.at ?? (options.now ?? new Date()).toISOString();
  const id = parsed.id ?? generatedId(parsed, at);

  const existing = findExisting(readRegistryLog(workspaceRoot), parsed, id);
  if (existing) {
    return { appended: false, record: existing.record, reason: existing.reason };
  }

  const paths = parsed.paths
    ? truncateAll(parsed.paths.map(redactRegistryText), MAX_PATHS, MAX_PATH_LENGTH)
    : undefined;

  const record = AutonRegistryEventSchema.parse({
    version: parsed.version ?? AUTON_REGISTRY_FILE_VERSION,
    id,
    at,
    kind: parsed.kind,
    title: truncate(redactRegistryText(parsed.title), MAX_TITLE_LENGTH),
    summary: truncate(redactRegistryText(parsed.summary), MAX_SUMMARY_LENGTH),
    refs: truncateAll(parsed.refs.map(redactRegistryText), MAX_REFS, MAX_REF_LENGTH),
    source: parsed.source,
    ...(parsed.status !== undefined ? { status: parsed.status } : {}),
    ...(parsed.agentId !== undefined ? { agentId: parsed.agentId } : {}),
    ...(parsed.itemId !== undefined ? { itemId: parsed.itemId } : {}),
    ...(paths !== undefined ? { paths } : {}),
    ...(parsed.dedupeKey !== undefined ? { dedupeKey: parsed.dedupeKey } : {}),
  });

  const path = registryLogPath(workspaceRoot);
  mkdirSync(join(workspaceRoot, AUTON_DIR_NAME), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");

  // El índice es una caché derivada del log: si falla, el evento ya escrito
  // sigue siendo la fuente de verdad.
  try {
    refreshRegistryIndex(workspaceRoot, options.now);
  } catch {
    // Un fallo del índice no invalida el append.
  }

  return { appended: true, record };
}
