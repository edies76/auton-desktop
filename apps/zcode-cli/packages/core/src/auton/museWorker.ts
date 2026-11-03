// ============================================================
// Adaptador de Muse Code — un motor externo detrás del puerto del worker
// ============================================================
// Muse Code corre headless con `muse exec --json`: recibe el encargo por un
// archivo, trabaja en su carpeta, emite JSONL de progreso y cierra con un
// evento `run.terminal.*`. El adaptador traduce eso al ciclo de vida que el
// orquestador ya conoce: lanzar, leer, detener y parsear el REPORTE.
//
// Límite declarado: `exec` es one-shot. No hay mensajes a mitad de corrida en
// este entorno (session-message no está soportado en Windows), así que `steer`
// falla explícito en vez de fingir un canal que no existe.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import type {
  AutonSessionWorkerFactoryInput,
  AutonSessionWorkerHandle,
} from "./session-worker.js";
import {
  buildMuseExecArgs,
  museCommand,
  parseMuseEventLine,
  probeMuseEngine,
  terminalFromMuseEvent,
  type MuseEngineProbe,
  type MuseTerminal,
} from "./workerEngine.js";

export interface MuseWorkerHandleOptions {
  input: AutonSessionWorkerFactoryInput;
  /** Capa de Auton + encargo, ya compuesta. */
  prompt: string;
  command?: string;
  /** Prefijo de argumentos para pruebas (p. ej. el script del motor falso). */
  commandPrefix?: readonly string[];
  provider?: string;
  model?: string;
  env?: NodeJS.ProcessEnv;
  maxModelSteps?: number;
  probe?: () => MuseEngineProbe;
}

export function createMuseWorkerHandle(
  options: MuseWorkerHandleOptions,
): AutonSessionWorkerHandle {
  const { input } = options;
  const workspace = input.placement.workingDirectory;
  const env = options.env ?? process.env;
  const command = options.command ?? museCommand(env);
  const commandPrefix = [...(options.commandPrefix ?? [])];
  const provider = options.provider ?? (env.AUTON_MUSE_PROVIDER?.trim() || undefined);
  const model = options.model ?? (env.AUTON_MUSE_MODEL?.trim() || undefined);
  const envSteps = Number(env.AUTON_MUSE_MAX_STEPS ?? "");
  const maxModelSteps =
    options.maxModelSteps ??
    (Number.isFinite(envSteps) && envSteps > 0 ? envSteps : undefined);

  const probe =
    options.probe?.() ??
    probeMuseEngine({
      command,
      args: [...commandPrefix, "--version"],
      env,
    });
  if (!probe.available) {
    throw new Error(
      `Muse Code no está disponible: ${probe.reason ?? "la sonda falló"}. ` +
        "Instálalo, autentícalo o despacha con engine: \"zcode\".",
    );
  }

  let child: ChildProcess | undefined;
  let started = false;
  let stopped = false;
  const rawLines: string[] = [];
  let terminal: MuseTerminal | undefined;
  let spawnError: Error | undefined;
  let stderr = "";

  const run = async (): Promise<{ response: string; events: never[] }> => {
    if (started) throw new Error("El worker de Muse ya se lanzó una vez.");
    started = true;
    await mkdir(workspace, { recursive: true });

    const promptFile = join(workspace, ".auton", "muse-prompt.txt");
    await mkdir(dirname(promptFile), { recursive: true });
    await writeFile(promptFile, options.prompt, "utf8");

    const args = buildMuseExecArgs({
      workspace,
      promptFile,
      mode: input.request.mode,
      ...(input.request.thinkingLevel
        ? { thinkingLevel: input.request.thinkingLevel }
        : {}),
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      ...(maxModelSteps ? { maxModelSteps } : {}),
    });

    const running = spawn(command, [...commandPrefix, ...args], {
      cwd: workspace,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      // En Windows `muse` es `muse.cmd`; el prefijo de pruebas ya es un .exe.
      shell:
        process.platform === "win32" &&
        (commandPrefix.length === 0 || /\.(cmd|bat)$/i.test(command)),
    });
    child = running;
    if (!running.stdout || !running.stderr) {
      throw new Error("Muse Code no expuso stdout/stderr al adaptador.");
    }

    running.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-8_192);
    });

    const lines = createInterface({ input: running.stdout });
    lines.on("line", (line) => {
      rawLines.push(line);
      const event = parseMuseEventLine(line);
      if (!event) return;
      const final = terminalFromMuseEvent(event);
      if (final) {
        terminal = final;
      }
    });

    await new Promise<void>((resolve, reject) => {
      running.once("error", (error) => {
        spawnError = error instanceof Error ? error : new Error(String(error));
        reject(spawnError);
      });
      running.once("close", () => resolve());
    });

    await mkdir(dirname(join(workspace, ".auton", "muse-progress.jsonl")), {
      recursive: true,
    }).catch(() => undefined);
    await writeFile(
      join(workspace, ".auton", "muse-progress.jsonl"),
      rawLines.join("\n"),
      "utf8",
    ).catch(() => undefined);

    if (spawnError) throw spawnError;
    if (stopped) throw new Error("Muse Code detenido por el orquestador.");
    if (!terminal) {
      throw new Error(
        `Muse Code terminó sin reporte (exit ${running.exitCode ?? "?"}). ${stderr.trim().slice(0, 500)}`,
      );
    }
    if (terminal.terminal !== "completed") {
      throw new Error(
        `Muse Code terminó ${terminal.terminal}${terminal.reason ? `: ${terminal.reason}` : ""}. ${terminal.text.slice(0, 500)}`,
      );
    }
    return { response: terminal.text, events: [] };
  };

  const steer = async (): Promise<"steered" | "queued"> => {
    throw new Error(
      "Muse Code corre one-shot: no acepta mensajes a mitad de corrida en este entorno. " +
        "Parte el encargo o usa el motor zcode para conversar en caliente.",
    );
  };

  const stop = (): void => {
    stopped = true;
    killProcessTree(child);
  };

  return { run, steer, stop };
}

/** Mata el árbol: `taskkill /T` en Windows, señal al grupo en POSIX. */
function killProcessTree(child: ChildProcess | undefined): void {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }
  try {
    child.kill("SIGTERM");
  } catch {
    // ya está muerto
  }
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // ya está muerto
    }
  }, 1_500);
  timer.unref?.();
}
