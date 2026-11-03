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
}

export interface AutonSessionWorkerFactoryInput {
  request: SubagentRunRequest;
  placement: AutonWorkerPlacement;
  agentId: string;
  sessionId: SessionId;
  reportActivity?: () => void;
  /** Eventos del worker hacia el hilo del orquestador. */
  onEvent: (event: SessionEvent) => Promise<void>;
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
        if (alreadyTerminal()) return result;
        options.registry.update(agentId, (task) => ({
          ...task,
          status: "completed",
          completedAt: new Date(),
          outputFile,
        }));
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
        active.delete(agentId);
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
      return options.registry.get(taskId);
    },
    sendMessage: async (
      request: SubagentSendMessageRequest,
    ): Promise<SubagentSendMessageResult> => {
      const worker = active.get(request.to);
      if (!worker) {
        return {
          status: "failed",
          messageId: `msg_${crypto.randomUUID()}`,
          message: "El worker de sesión no está activo.",
          error: "worker_not_running",
        };
      }
      const delivery = await worker.handle.steer({
        message: request.message,
        ...(request.requiresAnswer ? { requiresAnswer: true } : {}),
      });
      markWaitingForAnswer(options.registry, request.to, request.requiresAnswer);
      const task = options.registry.get(request.to);
      return {
        status: "success",
        messageId: `msg_${crypto.randomUUID()}`,
        delivery,
        agentId: request.to,
        ...(task ? { taskId: task.taskId } : {}),
        ...(request.requiresAnswer ? { waitingForAnswer: true } : {}),
        message: "Mensaje entregado al worker de sesión.",
      };
    },
  };

  return port;
}
