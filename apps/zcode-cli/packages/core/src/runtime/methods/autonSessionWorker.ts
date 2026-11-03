// ============================================================
// Worker Auton como sesión de ZCode — fábrica de runtime real
// ============================================================
// Construye el runtime del worker con la forma de una sesión normal: tipo
// `auton_worker_session`, juego completo de herramientas, carpeta propia y
// navegador propio. No pasa por el port de subagentes.
//
// La comprobación de que no hay recorte vive en `worker-mode.ts` y en las
// pruebas: aquí solo se aplica lo que esa decisión resolvió.

import { mkdir } from "node:fs/promises";
import type { SessionId, SubagentPort } from "@zcode/contracts";
import {
  ENTER_PLAN_MODE_TOOL_NAME,
  EXIT_PLAN_MODE_TOOL_NAME,
} from "@zcode/contracts";
import { AgentRuntime } from "../agent-runtime.js";
import type { AgentRuntimeInternal } from "../internal.js";
import type { AgentRuntimeDeps } from "../types.js";
import { cloneModelSelection } from "../model-selection.js";
import { resolveSubagentSelection } from "../helpers/subagent-selection.js";
import { deriveChildClientPorts } from "../helpers/child-client-ports.js";
import { createCoordinatorResponsePort } from "../../subagent/coordinator-response.js";
import { buildAutonWorkerPromptForRequest } from "../../auton/workerPolicy.js";
import { resolveWorkerBrowserScope } from "../../auton/worker-mode.js";
import { modeDisallowedTools } from "../../auton/workerTaskMode.js";
import {
  createAutonSessionWorkerPort,
  type AutonSessionWorkerFactoryInput,
  type AutonSessionWorkerHandle,
} from "../../auton/session-worker.js";

export function createDefaultAutonSessionWorkerPort(
  this: AgentRuntimeInternal,
  deps: AgentRuntimeDeps,
): SubagentPort {
  return createAutonSessionWorkerPort({
    registry: this.runtimeTaskRegistry,
    mode: "session",
    emitParentEvent: async (event, traceContext) => {
      await this.notifyEventSinks(event, traceContext);
    },
    enqueueParentTaskNotification: (notification) => {
      this.enqueueBackgroundTaskNotification({
        originMeta: {
          backgroundSource: "subagent",
          title: "Programador",
          workId: notification.taskId,
        },
        taskId: notification.taskId,
        text: notification.text,
        traceContext: notification.traceContext,
      });
      return undefined;
    },
    factory: async (input) => createWorkerSessionRuntime(this, deps, input),
  });
}

async function createWorkerSessionRuntime(
  parent: AgentRuntimeInternal,
  deps: AgentRuntimeDeps,
  input: AutonSessionWorkerFactoryInput,
): Promise<AutonSessionWorkerHandle> {
  const { request, placement, agentId, sessionId, onEvent } = input;
  const { selection } = resolveSubagentSelection({
    parentSelection: parent.getSessionModelSelection(),
    resolveSelection: deps.resolveEffectiveModelSelection,
  });
  const childSelection = cloneModelSelection(selection);
  const abort = new AbortController();
  // La carpeta del worker existe antes de arrancar: su primer comando corre
  // ahí, no en una ruta que todavía no está creada.
  await mkdir(placement.workingDirectory, { recursive: true });
  const systemPrompt = buildAutonWorkerPromptForRequest({
    effort: request.effort,
    brief: request.prompt,
    description: request.description,
    reasoningLevel: request.thinkingLevel,
    ...(request.mode === undefined ? {} : { mode: request.mode }),
  });

  // El worker recibe su propio control de navegador ligado a su sesión; las
  // pestañas siguen viviendo en la sesión padre para que el humano las vea.
  const browserScope = resolveWorkerBrowserScope({
    mode: placement.mode,
    childSessionId: sessionId,
    parentSessionId: parent.sessionId,
  });
  const browserPort = parent.browserControlPort?.forChildSession?.({
    childSessionId: browserScope.childSessionId,
    parentSessionId: browserScope.parentSessionId,
    tabOwner: browserScope.tabOwner,
  }) ?? parent.browserControlPort;

  const clientPorts = deriveChildClientPorts(
    {
      permissionBroker: parent.permissionBroker,
      ...(parent.providerRuntimeHeadersPort === undefined
        ? {}
        : { providerRuntimeHeadersPort: parent.providerRuntimeHeadersPort }),
    },
    {
      agentId,
      agentType: request.agentType,
      childSessionId: sessionId,
      description: request.description,
      parentSessionId: parent.sessionId,
      parentToolCallId: String(request.parentToolCallId),
      ...(request.turnId === undefined ? {} : { parentTurnId: request.turnId }),
    },
  );

  const childRuntime = new AgentRuntime(
    sessionId,
    {
      mode: parent.config.mode,
      planEnabled: false,
      modelSelection: childSelection,
      modelContextBudgetStrategy: parent.config.modelContextBudgetStrategy,
      workingDirectory: placement.workingDirectory,
      workspacePath: placement.workspaceRoot,
      envInfo: parent.config.envInfo,
      modelStreaming: parent.config.modelStreaming,
      bashTimeoutPolicy: parent.config.bashTimeoutPolicy,
      midConversationSystem: parent.config.midConversationSystem,
      toolSearch: parent.config.toolSearch,
      currentDate: parent.contextSourceSnapshot?.currentDate ?? parent.config.currentDate,
      subagentContext: { agentPrompt: systemPrompt },
      agentName: "auton-worker",
      maxTurns: 200,
      parentSessionId: parent.sessionId,
      taskType: placement.taskType,
      // El juego de herramientas es el del padre: nada de recortes por ser worker.
      dynamicWorkflowEnabled: parent.config.dynamicWorkflowEnabled,
      toolset: placement.toolset,
      ...(placement.toolAllowlist === undefined
        ? {}
        : { toolAllowlist: placement.toolAllowlist }),
      // Sin lista de permitidos: el runtime resuelve el juego completo. El modo
      // plan se retira porque esperaría una aprobación humana dentro del turno
      // del worker y lo dejaría colgado; el worker ejecuta, no pide plan.
      toolDisallowlist: [
        ...(parent.config.toolDisallowlist ?? []),
        ENTER_PLAN_MODE_TOOL_NAME,
        EXIT_PLAN_MODE_TOOL_NAME,
        // El modo de trabajo manda: read y research pierden toda herramienta
        // que pueda escribir en el espacio.
        ...modeDisallowedTools(request.mode),
      ],
      embeddedSearchBackend: parent.config.embeddedSearchBackend,
      nativeSearchEnhancementsEnabled: parent.config.nativeSearchEnhancementsEnabled,
      subagents: { enabled: false },
      mcp: parent.config.mcp,
    },
    {
      agentTelemetry: parent.agentTelemetry.port,
      agentTelemetryCausation: parent.agentTelemetry.captureCausation(),
      agentTelemetryCausationMode: "linked_root",
      eventStore: parent.eventStore,
      sessionStore: deps.sessionStore,
      modelRequestAdmission: parent.modelRequestAdmission,
      modelFactory: deps.modelFactory,
      resolveEffectiveModelSelection: deps.resolveEffectiveModelSelection,
      ...clientPorts,
      ...(browserPort === undefined ? {} : { browserControlPort: browserPort }),
      coordinatorResponsePort: createCoordinatorResponsePort({
        agentId,
        agentType: request.agentType,
        childSessionId: sessionId,
        parentToolCallId: String(request.parentToolCallId),
        enqueue: (message) => parent.enqueueSubagentMessage(message),
      }),
      permissionService: parent.permissionService,
      toolScheduler: deps.toolScheduler,
      executionPort: deps.executionPort,
      fileSystemPort: deps.fileSystemPort,
      httpClientPort: deps.httpClientPort,
      imageProcessorPort: deps.imageProcessorPort,
      pdfDocumentPort: deps.pdfDocumentPort,
      mcpPort: deps.mcpPort,
      skillPort: deps.skillPort,
      artifactStore: deps.artifactStore,
      appVersion: parent.appVersion,
      logger: parent.logger,
      traceContext: request.trace,
      eventSink: {
        onSessionEvent: async (event) => {
          input.reportActivity?.();
          // `onEvent` es el emisor del puerto: él se encarga de espejar al padre.
          await onEvent(event);
        },
      },
    },
  );

  await childRuntime.ensureSessionPersistedForExternalActivity(request.prompt, {
    traceContext: request.trace,
  });

  return {
    async run() {
      const result = await childRuntime.executeTurn(request.prompt, undefined, {
        abortSignal: abort.signal,
        inputSource: "subagent",
        inputPresentation: "coordinator_input",
        traceContext: request.trace,
      });
      return { response: result.response, events: result.events };
    },
    async steer(steerInput) {
      const result = await childRuntime.steerTurn({
        delivery: "guide",
        inputPresentation: "coordinator_steer",
        input: steerInput.requiresAnswer
          ? [
              "DECISIÓN REQUERIDA POR EL ORQUESTADOR.",
              "No sigas con el encargo hasta responder esto con RespondToCoordinator.",
              "",
              steerInput.message,
            ].join("\n")
          : steerInput.message,
        ...(steerInput.inputId ? { inputId: steerInput.inputId } : {}),
        traceContext: request.trace,
      });
      if (result.kind === "rejected") throw new Error(`steer rejected: ${result.reason}`);
      return "steered";
    },
    stop(reason) {
      abort.abort(reason);
    },
  };
}

/** El id de sesión del worker conserva el prefijo que distingue a los Auton. */
export function autonWorkerSessionId(agentId: string): SessionId {
  return `auton_${agentId}` as SessionId;
}
