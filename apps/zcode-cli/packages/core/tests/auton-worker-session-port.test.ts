import { describe, expect, it, vi } from "vitest";
import { InMemoryRuntimeTaskRegistry } from "../src/runtime-task/registry.js";
import {
  createAutonSessionWorkerPort,
  type AutonSessionWorkerFactoryInput,
  type AutonSessionWorkerHandle,
} from "../src/auton/session-worker.js";
import type { Model, ModelSelection, SubagentLaunchRequest } from "@zcode/contracts";
import { resolveAutonWorkerChildSelection } from "../src/runtime/methods/autonSessionWorker.js";

const TRACE = { traceId: "trace-1", sessionId: "sess_orchestrator" } as never;

function request(overrides: Partial<SubagentLaunchRequest> = {}): SubagentLaunchRequest {
  return {
    sessionId: "sess_orchestrator",
    parentToolCallId: "tool_1",
    agentType: "auton-worker",
    description: "landing",
    prompt: "haz la landing",
    workingDirectory: "C:/proyecto",
    workspaceRoot: "C:/proyecto",
    trace: TRACE,
    runInBackground: true,
    ...overrides,
  } as SubagentLaunchRequest;
}

function harness(options: { settle?: boolean } = {}) {
  const registry = new InMemoryRuntimeTaskRegistry();
  const seen: AutonSessionWorkerFactoryInput[] = [];
  const steers: string[] = [];
  const stops: string[] = [];
  let resolveRun: ((value: { response: string; events: never[] }) => void) | undefined;

  const factory = async (input: AutonSessionWorkerFactoryInput): Promise<AutonSessionWorkerHandle> => {
    seen.push(input);
    return {
      run: () =>
        options.settle === false
          ? new Promise((resolve) => {
              resolveRun = resolve as typeof resolveRun;
            })
          : Promise.resolve({ response: "listo: landing creada", events: [] }),
      steer: async (steerInput) => {
        steers.push(steerInput.message);
        return "steered" as const;
      },
      stop: (reason) => stops.push(reason ?? ""),
    };
  };

  const notifications: string[] = [];
  const port = createAutonSessionWorkerPort({
    registry,
    factory,
    mode: "session",
    emitParentEvent: async () => undefined,
    enqueueParentTaskNotification: (notification) => {
      notifications.push(notification.text);
      return undefined;
    },
  });

  return {
    registry,
    port,
    seen,
    steers,
    stops,
    notifications,
    settle: (response = "listo") => resolveRun?.({ response, events: [] }),
  };
}

describe("worker como sesión completa", () => {
  it("arranca con la colocación de sesión y registra su espacio propio", async () => {
    const h = harness();
    const output = (await h.port.launch(request())) as { status: string; agentId: string };

    expect(output.status).toBe("async_launched");
    expect(h.seen).toHaveLength(1);
    expect(h.seen[0]?.placement).toMatchObject({
      mode: "session",
      taskType: "auton_worker_session",
      isolatedWorkspace: true,
      browserOwner: "worker",
    });
    const task = h.registry.get(output.agentId);
    expect(task?.isolatedWorkspace).toBe(true);
    expect(task?.workingDirectory).toContain("workers");
    expect(task?.status).toBe("running");
  });

  it("al terminar deja el task cerrado, escribe la salida y avisa al orquestador", async () => {
    const h = harness();
    const output = (await h.port.launch(request())) as { agentId: string };
    await vi.waitFor(() => expect(h.registry.get(output.agentId)?.status).toBe("completed"));
    await vi.waitFor(() => expect(h.notifications).toHaveLength(1));
    expect(h.notifications[0]).toContain("terminó");
  });

  it("el orquestador lo redirige y el candado se marca", async () => {
    const h = harness({ settle: false });
    const output = (await h.port.launch(request())) as { agentId: string };

    const result = await h.port.sendMessage?.({
      sessionId: "sess_orchestrator",
      parentToolCallId: "tool_2",
      to: output.agentId,
      summary: "decisión",
      message: "¿uso la paleta nueva?",
      requiresAnswer: true,
      workingDirectory: "C:/proyecto",
      workspaceRoot: "C:/proyecto",
      trace: TRACE,
    });

    expect(result?.status).toBe("success");
    expect(result?.waitingForAnswer).toBe(true);
    expect(h.steers[0]).toContain("¿uso la paleta nueva?");
    expect(h.registry.get(output.agentId)?.waitingForAnswer).toBe(true);
  });

  it("una guía sin candado no deja al worker esperando", async () => {
    const h = harness({ settle: false });
    const output = (await h.port.launch(request())) as { agentId: string };

    const result = await h.port.sendMessage?.({
      sessionId: "sess_orchestrator",
      parentToolCallId: "tool_2",
      to: output.agentId,
      summary: "dato",
      message: "el archivo está en src/",
      requiresAnswer: false,
      workingDirectory: "C:/proyecto",
      workspaceRoot: "C:/proyecto",
      trace: TRACE,
    });

    expect(result?.status).toBe("success");
    expect(result?.waitingForAnswer).toBeUndefined();
    expect(h.registry.get(output.agentId)?.waitingForAnswer).toBeUndefined();
  });

  it("detener el worker lo para y lo deja visible como detenido", async () => {
    const h = harness({ settle: false });
    const output = (await h.port.launch(request())) as { agentId: string };

    const stopped = await h.port.stopTask?.(output.agentId);
    expect(stopped?.status).toBe("stopped");
    expect(h.stops).toHaveLength(1);

    // El turno termina después del stop: no puede resucitar el task ni avisar
    // como si hubiera completado.
    h.settle("listo después del stop");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(h.notifications).toHaveLength(0);
    expect(h.registry.get(output.agentId)?.status).toBe("stopped");
  });

  it("solo reclama como suyas las tareas que creó, no las del registro compartido", async () => {
    const h = harness({ settle: false });
    const output = (await h.port.launch(request())) as { agentId: string };

    h.registry.register({
      taskId: "agent_sub",
      agentId: "agent_sub",
      agentType: "general-purpose",
      description: "subagente del padre",
      status: "running",
      startedAt: new Date(),
      type: "local_agent",
      taskType: "local_agent",
    } as never);

    expect(await h.port.getTask?.("agent_sub")).toBeUndefined();
    expect(await h.port.stopTask?.("agent_sub")).toBeUndefined();
    expect(await h.port.getTask?.(output.agentId)).toBeTruthy();

    // El subagente sigue intacto: el puerto de sesión no lo tocó.
    expect(h.registry.get("agent_sub")?.status).toBe("running");
    h.settle();
  });

  it("en foreground espera el resultado y lo devuelve completo", async () => {
    const h = harness();
    const output = (await h.port.launch(request({ runInBackground: false }))) as {
      status: string;
      content: { type: string; text: string }[];
    };

    expect(output.status).toBe("completed");
    expect(output.content[0]?.text).toContain("landing creada");
  });

  it("entrega a la fábrica el modelo y el override del despacho", async () => {
    const h = harness();
    const model = { providerId: "prov-a", modelId: "modelo-a", options: {} } as unknown as Model;
    const overrideSelection: ModelSelection = { providerId: "prov-b", modelId: "modelo-b" };
    await h.port.launch(request(), {
      model,
      modelOverride: { selection: overrideSelection, background: "allow" },
    });

    expect(h.seen[0]?.model).toBe(model);
    expect(h.seen[0]?.modelOverride?.selection).toBe(overrideSelection);
    h.settle();
  });
});

describe("selección del worker = selección del orquestador", () => {
  const parentSelection: ModelSelection = { providerId: "prov-padre", modelId: "modelo-padre" };

  it("sin override ni modelo activo hereda la selección de la sesión orquestadora", () => {
    expect(resolveAutonWorkerChildSelection({ parentSelection })).toEqual(parentSelection);
  });

  it("el modelo activo del turno que despacha manda sobre la guardada", () => {
    const model = {
      providerId: "prov-activo",
      modelId: "modelo-activo",
      options: { reasoningLevel: "high" },
    } as unknown as Model;
    expect(resolveAutonWorkerChildSelection({ parentSelection, model })).toEqual({
      providerId: "prov-activo",
      modelId: "modelo-activo",
      options: { reasoningLevel: "high" },
    });
  });

  it("el override explícito del despacho manda sobre las dos anteriores", () => {
    const model = { providerId: "prov-activo", modelId: "modelo-activo", options: {} } as unknown as Model;
    const selection: ModelSelection = { providerId: "prov-override", modelId: "modelo-override" };
    expect(
      resolveAutonWorkerChildSelection({
        parentSelection,
        model,
        modelOverride: { selection, background: "allow" },
      }),
    ).toEqual(selection);
  });

  it("sin ninguna selección el despacho falla en vez de inventar un proveedor", () => {
    expect(() => resolveAutonWorkerChildSelection({})).toThrow(/No model selected/);
  });
});
