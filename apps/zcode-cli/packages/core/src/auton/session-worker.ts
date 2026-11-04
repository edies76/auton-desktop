// ============================================================
// Worker Auton como sesión completa — puerto de ciclo de vida
// ============================================================
// El orquestador necesita lo mismo con cualquiera de los dos tipos de worker:
// crear, mandar, detener y leer. Este puerto expone esa forma para el worker
// que corre como sesión de ZCode, sin pasar por el runner de subagentes.
// La ejecución real se inyecta con una fábrica para poder probar el ciclo sin
// levantar el runtime.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  createSessionId,
  type AgentCompletedOutput,
  type AgentOutput,
  type SessionEvent,
  type SessionId,
  type SubagentLaunchOptions,
  type SubagentLaunchRequest,
  type SubagentPort,
  type SubagentRunOptions,
  type SubagentRunRequest,
  type SubagentSendMessageRequest,
  type SubagentSendMessageResult,
} from "@zcode/contracts";
import type { RuntimeTaskRegistry, RuntimeTaskSnapshot } from "../runtime-task/registry.js";
import { isTerminalRuntimeTask } from "../runtime-task/registry.js";
import { markWaitingForAnswer } from "./answerLock.js";
import { formatLocalAgentTaskNotification } from "../subagent/completion-notification.js";
import {
  resolveAutonWorkerPlacement,
  type AutonWorkerMode,
  type AutonWorkerPlacement,
} from "./worker-mode.js";
import { resolveAutonWorkerEngine } from "./workerEngine.js";
import {
  upsertWorkerSession,
  type WorkerSessionIndexEntry,
} from "./workerIndex.js";
import type { WorkerTranscriptEntry } from "./workerTranscript.js";
import { transcriptFromSessionEvents } from "./workerTranscript.js";

export interface AutonSessionWorkerRunResult {
  response: string;
  events: readonly SessionEvent[];
}

export interface AutonSessionWorkerHandle {
  run(): Promise<AutonSessionWorkerRunResult>;
  steer(input: {
    message: string;
    inputId?: string;
    requiresAnswer?: boolean;
  }): Promise<"steered" | "queued">;
  stop(reason?: string): void;
  /** El host sigue vivo tras el primer turno y acepta más entradas. */
  keepAlive?: boolean;
  /** El worker responde por RespondToCoordinator, no solo por su salida. */
  answersThroughCoordinator?: boolean;
  getEngineSessionId?: () => string | undefined;
  transcript?: () => readonly WorkerTranscriptEntry[];
  waitForIdle?: () => Promise<void>;
  lastResponse?: () => string | undefined;
}

export interface AutonSessionWorkerFactoryInput {
  request: SubagentRunRequest;
  placement: AutonWorkerPlacement;
  agentId: string;
  sessionId: SessionId;
  /** Recrear la sesión existente en vez de crear una nueva. */
  resume?: boolean;
  reportActivity?: () => void;
  /** Eventos del worker hacia el hilo del orquestador. */
  onEvent: (event: SessionEvent) => Promise<void>;
  /** El motor abrió su sesión y este es su id (Muse MSP). */
  onEngineSession?: (engineSessionId: string) => void;
}

export type AutonSessionWorkerFactory = (
  input: AutonSessionWorkerFactoryInput,
) => Promise<AutonSessionWorkerHandle>;

export interface CreateAutonSessionWorkerPortOptions {
  factory: AutonSessionWorkerFactory;
  /** Motor externo; ausente significa que Muse no está cableado. */
  museFactory?: AutonSessionWorkerFactory;
  registry: RuntimeTaskRegistry;
  emitParentEvent: (event: SessionEvent, traceContext: SubagentRunRequest["trace"]) => Promise<void>;
  enqueueParentTaskNotification?: (notification: {
    taskId: string;
    text: string;
    traceContext: SubagentRunRequest["trace"];
  }) => undefined;
  createAgentId?: () => string;
  outputRootDir?: string;
  mode?: AutonWorkerMode;
}

interface ActiveWorker {
  request: SubagentRunRequest;
  placement: AutonWorkerPlacement;
  handle: AutonSessionWorkerHandle;
  abort: AbortController;
}

interface CompletedWorker {
  request: SubagentRunRequest;
  placement: AutonWorkerPlacement;
  agentId: string;
  sessionId: SessionId;
  engine: string;
  outputFile: string;
  startedAt: number;
}

export function createAutonSessionWorkerPort(
  options: CreateAutonSessionWorkerPortOptions,
): SubagentPort {
  const active = new Map<string, ActiveWorker>();
  /**
   * El registro de tareas es compartido con el padre. El puerto solo puede
   * reclamar como suyas las tareas que él creó: si mirase el registro a secas,
   * cualquier subagente parecería suyo y SendMessage/TaskStop lo romperían.
   */
  const owned = new Set<string>();
  /** Workers terminados que se pueden reanudar (ZCode) o que siguen vivos (Muse MSP). */
  const completed = new Map<string, CompletedWorker>();

  const transcriptFileFor = (workspace: string): string =>
    join(workspace, ".auton", "worker-transcript.json");

  const writeTranscript = async (
    workspace: string,
    entries: readonly WorkerTranscriptEntry[],
  ): Promise<string> => {
    const path = transcriptFileFor(workspace);
    await mkdir(dirname(path), { recursive: true }).catch(() => undefined);
    await writeFile(path, `${JSON.stringify(entries, null, 2)}\n`, "utf8").catch(
      () => undefined,
    );
    return path;
  };

  const writeIndex = async (
    workspaceRoot: string,
    entry: WorkerSessionIndexEntry,
  ): Promise<void> => {
    await upsertWorkerSession(workspaceRoot, entry).catch(() => undefined);
  };

  const snapshotFor = (
    request: SubagentRunRequest,
    placement: AutonWorkerPlacement,
    agentId: string,
    sessionId: SessionId,
    startedAt: number,
  ): RuntimeTaskSnapshot => ({
    taskId: agentId,
    agentId,
    agentType: request.agentType,
    description: request.description,
    status: "running",
    startedAt: new Date(startedAt),
    type: "local_agent",
    taskType: "local_agent",
    isBackgrounded: true,
    childSessionId: sessionId,
    parentToolCallId: request.parentToolCallId,
    parentSessionId: request.sessionId,
    traceContext: request.trace,
    ...(request.turnId === undefined ? {} : { turnId: request.turnId }),
    ...(placement.isolatedWorkspace
      ? { isolatedWorkspace: true, workingDirectory: placement.workingDirectory }
      : {}),
  });

  const launch = async (
    request: SubagentLaunchRequest,
    runOptions?: SubagentRunOptions,
  ): Promise<AgentOutput> => {
    const agentId = options.createAgentId?.() ?? `agent_${crypto.randomUUID()}`;
    const sessionId = createSessionId(`auton_${agentId}`);
    const startedAt = Date.now();
    const placement = resolveAutonWorkerPlacement({
      mode: options.mode ?? "session",
      parentWorkingDirectory: request.workingDirectory,
      workspaceRoot: request.workspaceRoot,
      workerSessionId: sessionId,
    });
    const abort = new AbortController();
    const engine = resolveAutonWorkerEngine(request.engine);
    const factory = engine === "muse" ? options.museFactory : options.factory;
    if (!factory) {
      throw new Error(
        `El motor ${engine} no está disponible en este runtime. ` +
          "Despacha con engine: \"zcode\" o configura el adaptador.",
      );
    }
    const handle = await factory({
      request,
      placement,
      agentId,
      sessionId,
      onEvent: async (event) => {
        await options.emitParentEvent(event, request.trace);
      },
      onEngineSession: (engineSessionId) => {
        options.registry.update(agentId, (task) => ({ ...task, engineSessionId }));
        void writeIndex(request.workspaceRoot, {
          workerId: agentId,
          taskId: agentId,
          engine,
          engineSessionId,
          workspace: placement.workingDirectory,
          status: "running",
          startedAt: new Date(startedAt).toISOString(),
          description: request.description,
          ...(request.mode ? { mode: request.mode } : {}),
          ...(request.effort ? { effort: request.effort } : {}),
        });
      },
    });
    active.set(agentId, { request, placement, handle, abort });
    owned.add(agentId);
    if (runOptions?.signal) {
      runOptions.signal.addEventListener("abort", () => handle.stop("aborted"), { once: true });
    }

    const outputFile = join(
      options.outputRootDir ?? join(tmpdir(), "zcode-agents"),
      request.sessionId,
      agentId,
      "output.txt",
    );
    options.registry.register(snapshotFor(request, placement, agentId, sessionId, startedAt));
    completed.set(agentId, {
      request,
      placement,
      agentId,
      sessionId,
      engine,
      outputFile,
      startedAt,
    });
    await writeIndex(request.workspaceRoot, {
      workerId: agentId,
      taskId: agentId,
      engine,
      ...(engine === "zcode" ? { engineSessionId: sessionId } : {}),
      workspace: placement.workingDirectory,
      status: "running",
      startedAt: new Date(startedAt).toISOString(),
      outputFile,
      description: request.description,
      ...(request.mode ? { mode: request.mode } : {}),
      ...(request.effort ? { effort: request.effort } : {}),
    });

    const runPromise = (async (): Promise<AutonSessionWorkerRunResult> => {
      // Un stop del orquestador o del humano ya dejó el task en estado terminal.
      // El cierre del turno no puede resucitarlo ni avisar como si hubiera
      // terminado: mismo criterio que el runner de subagentes.
      const alreadyTerminal = (): boolean => {
        const current = options.registry.get(agentId);
        return current !== undefined && isTerminalRuntimeTask(current);
      };
      try {
        const result = await handle.run();
        await mkdir(dirname(outputFile), { recursive: true }).catch(() => undefined);
        await writeFile(outputFile, result.response, "utf8").catch(() => undefined);
        const transcript =
          handle.transcript?.() ?? transcriptFromSessionEvents(result.events);
        const transcriptFile = await writeTranscript(
          placement.workingDirectory,
          transcript,
        );
        if (alreadyTerminal()) return result;
        const engineSessionId = handle.getEngineSessionId?.() ?? sessionId;
        options.registry.update(agentId, (task) => ({
          ...task,
          status: "completed",
          completedAt: new Date(),
          outputFile,
          engineSessionId,
        }));
        await writeIndex(request.workspaceRoot, {
          workerId: agentId,
          taskId: agentId,
          engine,
          engineSessionId,
          workspace: placement.workingDirectory,
          status: "completed",
          startedAt: new Date(startedAt).toISOString(),
          endedAt: new Date().toISOString(),
          outputFile,
          transcriptFile,
          description: request.description,
          ...(request.mode ? { mode: request.mode } : {}),
          ...(request.effort ? { effort: request.effort } : {}),
        });
        if (options.enqueueParentTaskNotification) {
          options.enqueueParentTaskNotification({
            taskId: agentId,
            text: formatLocalAgentTaskNotification({
              agentId,
              agentType: request.agentType,
              description: request.description,
              outputFile,
              parentToolCallId: String(request.parentToolCallId),
              result: result.response,
              status: "completed",
              totalDurationMs: Date.now() - startedAt,
            }),
            traceContext: request.trace,
          });
        }
        return result;
      } catch (error) {
        if (alreadyTerminal()) throw error;
        const message = error instanceof Error ? error.message : String(error);
        options.registry.update(agentId, (task) => ({
          ...task,
          status: "failed",
          completedAt: new Date(),
          error: message,
        }));
        await writeIndex(request.workspaceRoot, {
          workerId: agentId,
          taskId: agentId,
          engine,
          ...(handle.getEngineSessionId?.()
            ? { engineSessionId: handle.getEngineSessionId()! }
            : engine === "zcode"
              ? { engineSessionId: sessionId }
              : {}),
          workspace: placement.workingDirectory,
          status: "failed",
          startedAt: new Date(startedAt).toISOString(),
          endedAt: new Date().toISOString(),
          description: request.description,
          ...(request.mode ? { mode: request.mode } : {}),
          ...(request.effort ? { effort: request.effort } : {}),
        });
        if (options.enqueueParentTaskNotification) {
          options.enqueueParentTaskNotification({
            taskId: agentId,
            text: formatLocalAgentTaskNotification({
              agentId,
              agentType: request.agentType,
              description: request.description,
              error: message,
              outputFile,
              parentToolCallId: String(request.parentToolCallId),
              status: "failed",
              totalDurationMs: Date.now() - startedAt,
            }),
            traceContext: request.trace,
          });
        }
        throw error;
      } finally {
        // Un host conversacional (Muse MSP) sigue vivo tras el primer turno:
        // se queda en `active` para aceptar más entradas hasta el stop.
        if (!handle.keepAlive) active.delete(agentId);
      }
    })();

    if (request.runInBackground === false) {      const result = await runPromise;
      const completed: AgentCompletedOutput = {
        status: "completed",
        agentId,
        agentType: request.agentType,
        description: request.description,
        prompt: request.prompt,
        content: [{ type: "text", text: result.response }],
        totalToolUseCount: 0,
        totalDurationMs: Date.now() - startedAt,
      };
      return completed;
    }

    // El turno corre en segundo plano; el orquestador recibe el aviso al cerrar.
    void runPromise.catch(() => undefined);
    return {
      status: "async_launched",
      isAsync: true,
      agentId,
      agentType: request.agentType,
      description: request.description,
      prompt: request.prompt,
      childSessionId: sessionId,
      backgroundTaskId: agentId,
      outputFile,
      canReadOutputFile: true,
    };
  };

  const port: SubagentPort = {
    launch: async (request: SubagentLaunchRequest, optionsArg?: SubagentLaunchOptions) =>
      launch(request, optionsArg),
    run: async (request: SubagentRunRequest, optionsArg?: SubagentRunOptions) =>
      launch({ ...request, runInBackground: false }, optionsArg),
    getTask: async (taskId: string) => (owned.has(taskId) ? options.registry.get(taskId) : undefined),
    waitForTask: async (taskId, waitOptions) =>
      owned.has(taskId)
        ? options.registry.waitForTerminal(taskId, waitOptions)
        : undefined,
    stopTask: async (taskId) => {
      if (!owned.has(taskId)) return undefined;
      const worker = active.get(taskId);
      if (!worker) {
        const existing = options.registry.get(taskId);
        return existing;
      }
      worker.handle.stop("stopped_by_coordinator");
      worker.abort.abort();
      options.registry.update(taskId, (task) => ({
        ...task,
        status: "stopped",
        completedAt: new Date(),
      }));
      const record = completed.get(taskId);
      const engineSessionId =
        worker.handle.getEngineSessionId?.() ??
        (record?.engine === "zcode" ? record.sessionId : undefined);
      await writeIndex(worker.request.workspaceRoot, {
        workerId: taskId,
        taskId,
        engine: record?.engine ?? "zcode",
        ...(engineSessionId ? { engineSessionId } : {}),
        workspace: worker.placement.workingDirectory,
        status: "stopped",
        startedAt: new Date(record?.startedAt ?? Date.now()).toISOString(),
        endedAt: new Date().toISOString(),
        description: worker.request.description,
      });
      active.delete(taskId);
      return options.registry.get(taskId);
    },
    sendMessage: async (
      request: SubagentSendMessageRequest,
    ): Promise<SubagentSendMessageResult> => {
      const worker = active.get(request.to);
      if (worker) {
        const keepAlive = worker.handle.keepAlive === true;
        const delivery = await worker.handle.steer({
          message: request.message,
          ...(request.requiresAnswer ? { requiresAnswer: true } : {}),
        });
        if (keepAlive) {
          options.registry.update(request.to, (task) => ({
            ...task,
            status: "running",
            completedAt: undefined,
          }));
        }
        const answersThroughCoordinator =
          worker.handle.answersThroughCoordinator !== false;
        if (answersThroughCoordinator) {
          markWaitingForAnswer(options.registry, request.to, request.requiresAnswer);
        }
        if (keepAlive && worker.handle.waitForIdle) {
          void worker.handle
            .waitForIdle()
            .then(async () => {
              // Un stop durante el turno manda: no resucitar el task.
              if (options.registry.get(request.to)?.status === "stopped") return;
              const text = worker.handle.lastResponse?.() ?? "";
              const record = completed.get(request.to);
              if (record) {
                await writeFile(record.outputFile, text, "utf8").catch(() => undefined);
              }
              const transcript = worker.handle.transcript?.() ?? [];
              const transcriptFile = await writeTranscript(
                worker.placement.workingDirectory,
                transcript,
              );
              const engineSessionId =
                worker.handle.getEngineSessionId?.() ?? record?.sessionId;
              options.registry.update(request.to, (task) => ({
                ...task,
                status: "completed",
                completedAt: new Date(),
                outputFile: record?.outputFile,
                engineSessionId,
              }));
              await writeIndex(worker.request.workspaceRoot, {
                workerId: request.to,
                taskId: request.to,
                engine: record?.engine ?? "muse",
                engineSessionId,
                workspace: worker.placement.workingDirectory,
                status: "completed",
                startedAt: new Date(record?.startedAt ?? Date.now()).toISOString(),
                endedAt: new Date().toISOString(),
                ...(record?.outputFile ? { outputFile: record.outputFile } : {}),
                transcriptFile,
                description: worker.request.description,
                ...(worker.request.mode ? { mode: worker.request.mode } : {}),
                ...(worker.request.effort ? { effort: worker.request.effort } : {}),
              });
            })
            .catch(() => undefined);
        }
        const task = options.registry.get(request.to);
        return {
          status: "success",
          messageId: `msg_${crypto.randomUUID()}`,
          delivery,
          agentId: request.to,
          ...(task ? { taskId: task.taskId } : {}),
          ...(request.requiresAnswer && answersThroughCoordinator
            ? { waitingForAnswer: true }
            : {}),
          message: answersThroughCoordinator
            ? "Mensaje entregado al worker de sesión."
            : "Mensaje entregado a la sesión viva del worker; la respuesta se lee en su conversación.",
        };
      }

      const record = completed.get(request.to);
      if (record && record.engine === "zcode" && options.factory) {
        const resumed = await options.factory({
          request: { ...record.request, prompt: request.message },
          placement: record.placement,
          agentId: record.agentId,
          sessionId: record.sessionId,
          resume: true,
          onEvent: async (event) => {
            await options.emitParentEvent(event, record.request.trace);
          },
        });
        active.set(record.agentId, {
          request: { ...record.request, prompt: request.message },
          placement: record.placement,
          handle: resumed,
          abort: new AbortController(),
        });
        options.registry.update(record.agentId, (task) => ({
          ...task,
          status: "running",
          completedAt: undefined,
          error: undefined,
        }));
        void (async () => {
          try {
            const result = await resumed.run();
            await writeFile(record.outputFile, result.response, "utf8").catch(
              () => undefined,
            );
            const transcript =
              resumed.transcript?.() ?? transcriptFromSessionEvents(result.events);
            const transcriptFile = await writeTranscript(
              record.placement.workingDirectory,
              transcript,
            );
            options.registry.update(record.agentId, (task) => ({
              ...task,
              status: "completed",
              completedAt: new Date(),
              outputFile: record.outputFile,
            }));
            await writeIndex(record.request.workspaceRoot, {
              workerId: record.agentId,
              taskId: record.agentId,
              engine: "zcode",
              engineSessionId: record.sessionId,
              workspace: record.placement.workingDirectory,
              status: "completed",
              startedAt: new Date(record.startedAt).toISOString(),
              endedAt: new Date().toISOString(),
              outputFile: record.outputFile,
              transcriptFile,
              description: record.request.description,
              ...(record.request.mode ? { mode: record.request.mode } : {}),
              ...(record.request.effort ? { effort: record.request.effort } : {}),
            });
            if (options.enqueueParentTaskNotification) {
              options.enqueueParentTaskNotification({
                taskId: record.agentId,
                text: formatLocalAgentTaskNotification({
                  agentId: record.agentId,
                  agentType: record.request.agentType,
                  description: record.request.description,
                  outputFile: record.outputFile,
                  parentToolCallId: String(record.request.parentToolCallId),
                  result: result.response,
                  status: "completed",
                  totalDurationMs: 0,
                }),
                traceContext: record.request.trace,
              });
            }
          } catch (error) {
            options.registry.update(record.agentId, (task) => ({
              ...task,
              status: "failed",
              completedAt: new Date(),
              error: error instanceof Error ? error.message : String(error),
            }));
          } finally {
            active.delete(record.agentId);
          }
        })();
        return {
          status: "success",
          messageId: `msg_${crypto.randomUUID()}`,
          delivery: "resumed_background",
          agentId: record.agentId,
          taskId: record.agentId,
          message:
            "El worker se reanudó en la misma sesión y responderá en segundo plano.",
        };
      }

      return {
        status: "failed",
        messageId: `msg_${crypto.randomUUID()}`,
        message:
          record?.engine === "muse"
            ? "La sesión de Muse ya cerró; para seguir hablando usa el transporte conversacional (serve)."
            : "El worker de sesión no está activo.",
        error: "worker_not_running",
      };
    },
  };

  return port;
}
