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
import type {
  Model,
  ModelSelection,
  SessionId,
  SubagentPort,
  SubagentRunOptions,
} from "@zcode/contracts";
import {
  ENTER_PLAN_MODE_TOOL_NAME,
  EXIT_PLAN_MODE_TOOL_NAME,
} from "@zcode/contracts";
import { AgentRuntime } from "../agent-runtime.js";
import type { AgentRuntimeInternal } from "../internal.js";
import type { AgentRuntimeDeps } from "../types.js";
import { cloneModelSelection } from "../model-selection.js";
import { resolveSubagentSelection } from "../helpers/subagent-selection.js";
import { modelSelectionFromActiveModel } from "./subagent.js";
import { deriveChildClientPorts } from "../helpers/child-client-ports.js";
import { createCoordinatorResponsePort } from "../../subagent/coordinator-response.js";
import { buildAutonWorkerPromptForRequest } from "../../auton/workerPolicy.js";
import { createMuseWorkerHandle } from "../../auton/museWorker.js";
import { createMuseMspWorkerHandle } from "../../auton/museMspWorker.js";
import { resolveWorkerBrowserScope } from "../../auton/worker-mode.js";
import { modeDisallowedTools } from "../../auton/workerTaskMode.js";
import {
  transcriptFromSessionEvents,
  transcriptFromSessionMessages,
  type WorkerTranscriptEntry,
} from "../../auton/workerTranscript.js";
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
    museFactory: async (input) => {
      const prompt = buildMuseWorkerPrompt(this, input);
      const transport = process.env.AUTON_MUSE_TRANSPORT?.trim().toLowerCase();
      if (transport === "exec") {
        return createMuseWorkerHandle({ input, prompt });
      }
      return createMuseMspWorkerHandle({ input, prompt });
    },
  });
}

/** Muse no separa system prompt: la capa de Auton abre el turno. */
export function buildMuseWorkerPrompt(
  parent: AgentRuntimeInternal,
  input: AutonSessionWorkerFactoryInput,
): string {
  const { request } = input;
  const layer = buildAutonWorkerPromptForRequest({
    effort: request.effort,
    brief: request.prompt,
    description: request.description,
    reasoningLevel: request.thinkingLevel,
    ...(request.mode === undefined ? {} : { mode: request.mode }),
  });
  const configured = parent.config.userInstructions;
  const instructions =
    parent.contextSourceSnapshot?.userInstructions ??
    (isResolvedUserInstructions(configured) ? configured : undefined);
  return [
    layer,
    "",
    "## ENCARGO",
    request.prompt,
    ...(instructions
      ? ["", "## INSTRUCCIONES DEL PROYECTO", instructions.content]
      : []),
  ].join("\n");
}

/**
 * La selección del worker es la del orquestador, con la misma precedencia
 * que un subagente (runtime/methods/subagent.ts): primero el override
 * explícito del despacho; si no hay, el modelo activo del turno que lo
 * despachó; si tampoco, la selección guardada de la sesión orquestadora.
 * Sin selección en ningún lado, `resolveSubagentSelection` falla el
 * despacho en vez de arrancar al worker con otro proveedor por defecto.
 */
export function resolveAutonWorkerChildSelection(input: {
  parentSelection?: ModelSelection | null;
  model?: Model;
  modelOverride?: SubagentRunOptions["modelOverride"];
  resolveSelection?: (
    selection: ModelSelection,
  ) => import("@zcode/shared/model-selection").EffectiveModelSelectionResult;
}): ModelSelection {
  const { selection } = resolveSubagentSelection({
    ...(input.parentSelection !== undefined
      ? { parentSelection: input.parentSelection }
      : {}),
    ...(input.modelOverride ? { overrideSelection: input.modelOverride.selection } : {}),
    ...(input.resolveSelection ? { resolveSelection: input.resolveSelection } : {}),
  });
  if (!input.modelOverride && input.model) {
    return modelSelectionFromActiveModel(input.model);
  }
  return cloneModelSelection(selection);
}

async function createWorkerSessionRuntime(
  parent: AgentRuntimeInternal,
  deps: AgentRuntimeDeps,
  input: AutonSessionWorkerFactoryInput,
): Promise<AutonSessionWorkerHandle> {
  const { request, placement, agentId, sessionId, onEvent } = input;
  const childSelection = resolveAutonWorkerChildSelection({
    parentSelection: parent.getSessionModelSelection(),
    ...(input.model ? { model: input.model } : {}),
    ...(input.modelOverride ? { modelOverride: input.modelOverride } : {}),
    resolveSelection: deps.resolveEffectiveModelSelection,
  });
  const abort = new AbortController();
  const capturedEvents: import("@zcode/contracts").SessionEvent[] = [];
  let lastTranscript: readonly WorkerTranscriptEntry[] = [];
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
      subagentContext: {
        agentPrompt: systemPrompt,
        // Mismo contrato que el worker subagente: las instrucciones del
        // proyecto (AGENTS.md y similares) también llegan a la sesión. El
        // snapshot las trae resueltas cuando hay context source; si no, la
        // configurada en el runtime es la misma fuente.
        ...(() => {
          const configured = parent.config.userInstructions;
          const userInstructions =
            parent.contextSourceSnapshot?.userInstructions ??
            (isResolvedUserInstructions(configured) ? configured : undefined);
          return userInstructions ? { userInstructions } : {};
        })(),
      },
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
          capturedEvents.push(event);
          input.reportActivity?.();
          // `onEvent` es el emisor del puerto: él se encarga de espejar al padre.
          await onEvent(event);
        },
      },
    },
  );

  // En una reanudación la sesión ya existe: persistir otra vez la duplicaría.
  if (input.resume !== true) {
    await childRuntime.ensureSessionPersistedForExternalActivity(request.prompt, {
      traceContext: request.trace,
    });
  }
  return {
    transcript: (): readonly WorkerTranscriptEntry[] => lastTranscript,
    async run() {
      const result = await childRuntime.executeTurn(request.prompt, undefined, {
        abortSignal: abort.signal,
        inputSource: "subagent",
        inputPresentation: "coordinator_input",
        traceContext: request.trace,
      });
      try {
        const events = await deps.eventStore.getEvents(sessionId);
        lastTranscript = transcriptFromSessionEvents(events);
        if (lastTranscript.length === 0 && deps.sessionStore) {
          const stored = await deps.sessionStore.messages({ sessionID: sessionId });
          lastTranscript = transcriptFromSessionMessages(stored);
        }
        if (lastTranscript.length === 0) {
          lastTranscript = transcriptFromSessionEvents(capturedEvents);
        }
      } catch {
        lastTranscript = transcriptFromSessionEvents(capturedEvents);
      }
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

/** El config puede traer opciones sin resolver; solo sirve el contenido leído. */
function isResolvedUserInstructions(
  value: unknown,
): value is import("@zcode/contracts").ResolvedUserInstructions {
  return (
    typeof value === "object" &&
    value !== null &&
    "fileName" in value &&
    "content" in value &&
    "bytesRead" in value
  );
}

/** El id de sesión del worker conserva el prefijo que distingue a los Auton. */
export function autonWorkerSessionId(agentId: string): SessionId {
  return `auton_${agentId}` as SessionId;
}
