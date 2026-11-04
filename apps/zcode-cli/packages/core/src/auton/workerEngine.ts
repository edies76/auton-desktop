// ============================================================
// Motor del worker — resolver, sonda y contrato de Muse Code
// ============================================================
// El motor es una elección por despacho. `zcode` corre en proceso; `muse` es
// Muse Code como programa externo (CLI). Aquí vive la decisión pura y la sonda;
// la ejecución está en museWorker.ts.

import { spawnSync } from "node:child_process";
import {
  DEFAULT_AUTON_WORKER_ENGINE,
  type AutonWorkerEngine,
  type AutonWorkerTaskMode,
} from "@zcode/contracts";
import { resolveAutonWorkerTaskMode } from "./workerTaskMode.js";

export const MUSE_ENGINE_DEFAULT_COMMAND = "muse";

/** Niveles que Muse Code acepta en `--reasoning-effort`. */
const MUSE_REASONING_EFFORTS = new Set([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
]);

export function parseAutonWorkerEngine(value: unknown): AutonWorkerEngine | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized === "zcode" || normalized === "muse" ? normalized : undefined;
}

/** Ausente cae en zcode. Un valor inventado no se adivina: el esquema lo rechaza. */
export function resolveAutonWorkerEngine(value: unknown): AutonWorkerEngine {
  return parseAutonWorkerEngine(value) ?? DEFAULT_AUTON_WORKER_ENGINE;
}

export interface MuseEngineProbe {
  engine: "muse";
  available: boolean;
  command: string;
  version?: string;
  reason?: string;
  /** `exec` es one-shot: no acepta mensajes a mitad de corrida. */
  supportsMidRunInput: false;
  /** Lee JSONL de progreso mientras corre. */
  supportsProgress: true;
}

export function museCommand(env: NodeJS.ProcessEnv = process.env): string {
  return env.AUTON_MUSE_BIN?.trim() || MUSE_ENGINE_DEFAULT_COMMAND;
}

export interface MuseSpawnSpec {
  command: string;
  args: string[];
  windowsVerbatimArguments?: boolean;
}

function isWindowsCommandScript(command: string): boolean {
  if (/\.(cmd|bat)$/i.test(command)) return true;
  if (/\.(exe|com)$/i.test(command)) return false;
  return !/[\\/]/.test(command);
}

/**
 * En Windows `muse` es un .cmd y hay que pasar por cmd.exe. Node con
 * `shell: true` concatena los argumentos sin citar, y una carpeta con espacio
 * rompe el `--workspace`/`--prompt-file`; peor, un `&` en la ruta se interpreta
 * como separador. Construimos la línea con cada argumento citado y dejamos que
 * cmd la reciba verbatim.
 */
export function quoteWindowsCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Un nombre pelado (`muse`) se deja sin citar: `muse.cmd` usa `%~dp0` para
 * encontrar su launcher y, entre comillas, cmd lo resuelve contra el cwd y
 * rompe el arranque. Una ruta con espacios sí va citada.
 */
function quoteWindowsCommand(command: string): string {
  return /[\\/]/.test(command) || /\s/.test(command)
    ? quoteWindowsCmdArg(command)
    : command;
}

export function buildMuseSpawnSpec(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): MuseSpawnSpec {
  if (process.platform !== "win32" || !isWindowsCommandScript(command)) {
    return { command, args: [...args] };
  }
  const quotedCommand = quoteWindowsCommand(command);
  const line = [quotedCommand, ...args.map(quoteWindowsCmdArg)].join(" ");
  // Con el comando pelado no se envuelve la línea: los quotes internos de los
  // argumentos cerrarían el quote externo. Con una ruta citada sí se envuelve,
  // que es la forma que `/s` espera para desenvolver.
  const commandIsQuoted = quotedCommand.startsWith('"');
  return {
    command: env.ComSpec?.trim() || "cmd.exe",
    args: ["/d", "/s", "/c", commandIsQuoted ? `"${line}"` : line],
    windowsVerbatimArguments: true,
  };
}

/**
 * Sonda barata: `--version`. No lanza un turno ni gasta modelo. Si falla, el
 * motivo exacto viaja al orquestador en vez de fingir que el motor está.
 */
export function probeMuseEngine(options: {
  command?: string;
  args?: readonly string[];
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
} = {}): MuseEngineProbe {
  const command = options.command ?? museCommand(options.env);
  const args = options.args ?? ["--version"];
  const spec = buildMuseSpawnSpec(
    command,
    args,
    options.env ?? process.env,
  );
  const result = spawnSync(spec.command, spec.args, {
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 10_000,
    windowsHide: true,
    shell: false,
    ...(spec.windowsVerbatimArguments
      ? { windowsVerbatimArguments: spec.windowsVerbatimArguments }
      : {}),
  });

  if (result.error) {
    return {
      engine: "muse",
      available: false,
      command,
      reason: `${command} ${args.join(" ")} falló: ${result.error.message}`,
      supportsMidRunInput: false,
      supportsProgress: true,
    };
  }
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    return {
      engine: "muse",
      available: false,
      command,
      reason: `${command} salió con ${result.status}: ${output.slice(0, 400)}`,
      supportsMidRunInput: false,
      supportsProgress: true,
    };
  }
  const version = /Muse Code\s+([^\s(]+)/.exec(output)?.[1];
  return {
    engine: "muse",
    available: true,
    command,
    ...(version ? { version } : {}),
    supportsMidRunInput: false,
    supportsProgress: true,
  };
}

/** Flags de sandbox que imponen el modo dentro del motor externo. */
export function museModeArgs(mode: unknown): string[] {
  const resolved: AutonWorkerTaskMode = resolveAutonWorkerTaskMode(mode);
  if (resolved === "read" || resolved === "research") {
    return ["--disable-write", "--disable-shell"];
  }
  if (resolved === "debug") {
    return ["--disable-write"];
  }
  return [];
}

export function museReasoningEffort(level: string | undefined): string | undefined {
  if (!level) return undefined;
  const normalized = level.trim().toLowerCase();
  return MUSE_REASONING_EFFORTS.has(normalized) ? normalized : undefined;
}

export interface MuseExecArgsInput {
  workspace: string;
  promptFile: string;
  mode?: unknown;
  thinkingLevel?: string;
  provider?: string;
  model?: string;
  maxModelSteps?: number;
}

export function buildMuseExecArgs(input: MuseExecArgsInput): string[] {
  const effort = museReasoningEffort(input.thinkingLevel);
  return [
    "exec",
    "--json",
    "--prompt-file",
    input.promptFile,
    "--workspace",
    input.workspace,
    "--approval-mode",
    "never",
    "--disable-request-user-input",
    ...museModeArgs(input.mode),
    ...(input.provider ? ["--provider", input.provider] : []),
    ...(input.model ? ["--model", input.model] : []),
    ...(effort ? ["--reasoning-effort", effort] : []),
    ...(input.maxModelSteps ? ["--max-model-steps", String(input.maxModelSteps)] : []),
  ];
}

export interface MuseTerminal {
  text: string;
  terminal: string;
  reason?: string;
}

/** Cada línea de `muse exec --json` es un evento JSON. */
export function parseMuseEventLine(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export function terminalFromMuseEvent(
  event: Record<string, unknown>,
): MuseTerminal | undefined {
  const payloadType = event.payload_type;
  if (typeof payloadType !== "string" || !payloadType.startsWith("run.terminal.")) {
    return undefined;
  }
  const payload = event.payload;
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  return {
    text: typeof record.text === "string" ? record.text : "",
    terminal:
      typeof record.terminal === "string"
        ? record.terminal
        : payloadType.slice("run.terminal.".length),
    ...(typeof record.reason === "string" ? { reason: record.reason } : {}),
  };
}

/** Línea corta de progreso para el log; los terminales no son progreso. */
export function progressTextFromMuseEvent(
  event: Record<string, unknown>,
): string | undefined {
  const payloadType = event.payload_type;
  if (typeof payloadType !== "string" || payloadType.startsWith("run.terminal.")) {
    return undefined;
  }
  if (payloadType === "run.lifecycle.started") return "empezó el encargo";
  if (payloadType.startsWith("task.lifecycle.")) {
    const payload = event.payload;
    const kind =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>).task_kind
        : undefined;
    return `${payloadType.replace("task.lifecycle.", "tarea ")}${typeof kind === "string" ? ` (${kind})` : ""}`;
  }
  return undefined;
}

export type AutonWorkerReportStatus =
  | "DONE"
  | "DONE_WITH_CONCERNS"
  | "NEEDS_CONTEXT"
  | "BLOCKED";

/** Los cuatro estados del REPORTE son el contrato de cierre, venga de donde venga. */
export function parseWorkerReporte(text: string): AutonWorkerReportStatus | undefined {
  const match = /STATUS:\s*(DONE_WITH_CONCERNS|DONE|NEEDS_CONTEXT|BLOCKED)\b/.exec(text);
  return match?.[1] as AutonWorkerReportStatus | undefined;
}

/** Quita posibles secretos del texto que vuelve al orquestador o al diario. */
export function redactMuseSecrets(text: string): string {
  return text
    .replace(/META_API_KEY\s*=\s*\S+/g, "META_API_KEY=<redacted>")
    .replace(/sk-[A-Za-z0-9]{5,}/g, "sk-<redacted>")
    .replace(/xai-[A-Za-z0-9]{5,}/g, "xai-<redacted>");
}

export interface HonestNoReportClose {
  status: "NEEDS_CONTEXT";
  response: string;
}

/**
 * Cierre honesto cuando el motor no dejó REPORTE: en vez de un `failed`
 * mudo, NEEDS_CONTEXT con motivo y evidencia. Devuelve null si el texto
 * crudo ya trae un STATUS válido — entonces manda el REPORTE encontrado.
 * No inventa DONE jamás.
 */
export function closeMuseWithoutTerminal(
  rawText: string,
  evidencePaths: readonly string[],
  stderrTail = "",
): HonestNoReportClose | null {
  if (parseWorkerReporte(rawText)) return null;
  const evidence =
    evidencePaths.length > 0 ? evidencePaths.join(", ") : "sin artefactos";
  const response = [
    "REPORTE:",
    "STATUS: NEEDS_CONTEXT",
    `EVIDENCIA: ${evidence}`,
    "DUDAS: motor no emitió REPORTE; revisar evidencia y decidir" +
      (stderrTail ? `. stderr: ${stderrTail.slice(0, 300)}` : ""),
  ].join("\n");
  return { status: "NEEDS_CONTEXT", response: redactMuseSecrets(response) };
}
