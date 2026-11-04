// ============================================================
// Worker Muse conversacional — una sesión MSP viva
// ============================================================
// A diferencia del adaptador `exec` (una pasada), este mantiene `muse serve`
// abierto: el orquestador puede mandar más entradas sobre la MISMA sesión y
// recibir sus respuestas, en orden, hasta que la pare.

import { mkdir } from "node:fs/promises";
import type {
  AutonSessionWorkerFactoryInput,
  AutonSessionWorkerHandle,
} from "./session-worker.js";
import { MuseMspClient } from "./museMspClient.js";
import {
  transcriptFromMuseTurns,
  type WorkerTranscriptEntry,
} from "./workerTranscript.js";

export interface MuseMspWorkerOptions {
  input: AutonSessionWorkerFactoryInput;
  /** Capa de Auton + encargo, ya compuesta. */
  prompt: string;
  command?: string;
  commandPrefix?: readonly string[];
  env?: NodeJS.ProcessEnv;
  provider?: string;
  model?: string;
  requestTimeoutMs?: number;
}

export function createMuseMspWorkerHandle(
  options: MuseMspWorkerOptions,
): AutonSessionWorkerHandle {
  const { input } = options;
  const env = options.env ?? process.env;
  const client = new MuseMspClient({
    workspace: input.placement.workingDirectory,
    ...(options.command ? { command: options.command } : {}),
    ...(options.commandPrefix ? { commandPrefix: options.commandPrefix } : {}),
    env,
    ...(options.provider ?? env.AUTON_MUSE_PROVIDER
      ? { provider: options.provider ?? env.AUTON_MUSE_PROVIDER }
      : {}),
    ...(options.model ?? env.AUTON_MUSE_MODEL
      ? { model: options.model ?? env.AUTON_MUSE_MODEL }
      : {}),
    mode: input.request.mode,
    ...(options.requestTimeoutMs
      ? { requestTimeoutMs: options.requestTimeoutMs }
      : {}),
  });

  let started = false;
  let stopped = false;
  let lastResponse: string | undefined;

  const run = async (): Promise<{ response: string; events: never[] }> => {
    if (started) throw new Error("El worker de Muse ya se lanzó una vez.");
    started = true;
    // `muse serve` arranca con cwd en esta carpeta: tiene que existir.
    await mkdir(input.placement.workingDirectory, { recursive: true });
    await client.start();
    if (!client.sessionId) throw new Error("Muse serve no abrió la sesión.");
    input.onEngineSession?.(client.sessionId);

    const turn = await client.startTurn(options.prompt);
    const done = await client.waitForTurn(turn.turnId);
    if (stopped) throw new Error("Muse Code detenido por el orquestador.");
    if (done.terminal !== "completed") {
      throw new Error(
        `Muse Code terminó ${done.terminal}${done.reason ? `: ${done.reason}` : ""}.`,
      );
    }
    lastResponse = done.assistantText;
    return { response: done.assistantText, events: [] };
  };

  const steer = async (steerInput: {
    message: string;
    inputId?: string;
    requiresAnswer?: boolean;
  }): Promise<"steered" | "queued"> => {
    if (!started) throw new Error("El worker de Muse todavía no arrancó.");
    if (stopped) throw new Error("El worker de Muse ya está detenido.");
    const result = await client.steer(steerInput.message);
    return result.disposition === "queued" ? "queued" : "steered";
  };

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    void client.interrupt().catch(() => undefined);
    client.close();
  };

  const transcript = (): readonly WorkerTranscriptEntry[] =>
    transcriptFromMuseTurns(client.conversation());

  return {
    run,
    steer,
    stop,
    keepAlive: true,
    answersThroughCoordinator: false,
    getEngineSessionId: () => client.sessionId,
    transcript,
    waitForIdle: () => client.waitForIdle(),
    lastResponse: () =>
      client.conversation().at(-1)?.assistantText ?? lastResponse,
  };
}
