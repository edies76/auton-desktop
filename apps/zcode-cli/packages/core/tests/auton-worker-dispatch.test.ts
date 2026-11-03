import { describe, expect, it, vi } from "vitest";
import { RESPOND_TO_COORDINATOR_TOOL_NAME } from "@zcode/contracts";
import { agentToolEntry } from "../src/tool/handlers/agent.js";
import { sendMessageToolEntry } from "../src/tool/handlers/send-message.js";
import { resolveBuiltInToolAllowlist } from "../src/runtime/helpers/tool-allowlist.js";
import type { AgentRuntimeConfig } from "../src/runtime/types.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

function fakePort(label: string) {
  const launched: unknown[] = [];
  return {
    launched,
    port: {
      launch: vi.fn(async (request: unknown) => {
        launched.push(request);
        return {
          status: "async_launched",
          isAsync: true,
          agentId: "agent_1",
          agentType: "auton-worker",
          description: (request as { description: string }).description,
          prompt: (request as { prompt: string }).prompt,
          childSessionId: "sess_auton_agent_1",
          backgroundTaskId: "agent_1",
          outputFile: `${label}.txt`,
          canReadOutputFile: true,
        };
      }),
    },
  };
}

function context(overrides: Record<string, unknown>): ToolExecutionContext {
  return {
    sessionId: "sess_orchestrator",
    toolCallId: "tool_1",
    workingDirectory: "C:/proyecto",
    workspaceRoot: "C:/proyecto",
    abortSignal: new AbortController().signal,
    ...overrides,
  } as unknown as ToolExecutionContext;
}

const INPUT = {
  description: "landing",
  prompt: "haz la landing",
  subagent_type: "auton-worker",
};

describe("el despacho elige el puerto según el interruptor", () => {
  it("con el interruptor en sesión no toca el port de subagentes", async () => {
    const session = fakePort("session");
    const subagent = fakePort("subagent");

    await agentToolEntry.handler(
      { ...INPUT, worker_mode: "session" },
      context({
        autonWorkerMode: "session",
        autonSessionWorkerPort: session.port,
        subagentPort: subagent.port,
      }),
    );

    expect(session.port.launch).toHaveBeenCalledTimes(1);
    expect(subagent.port.launch).not.toHaveBeenCalled();
    expect((session.launched[0] as { agentType: string }).agentType).toBe("auton-worker");
  });

  it("con el interruptor apagado usa la ruta de siempre", async () => {
    const session = fakePort("session");
    const subagent = fakePort("subagent");

    await agentToolEntry.handler(
      INPUT,
      context({
        autonWorkerMode: "subagent",
        autonSessionWorkerPort: session.port,
        subagentPort: subagent.port,
      }),
    );

    expect(subagent.port.launch).toHaveBeenCalledTimes(1);
    expect(session.port.launch).not.toHaveBeenCalled();
  });

  it("si el modo sesión no está disponible, cae al subagente en vez de romper", async () => {
    const subagent = fakePort("subagent");

    await agentToolEntry.handler(
      { ...INPUT, worker_mode: "session" },
      context({ autonWorkerMode: "session", subagentPort: subagent.port }),
    );

    expect(subagent.port.launch).toHaveBeenCalledTimes(1);
  });

  it("el despacho puede pedir sesión aunque el runtime esté en subagente", async () => {
    const session = fakePort("session");
    const subagent = fakePort("subagent");

    await agentToolEntry.handler(
      { ...INPUT, worker_mode: "session" },
      context({
        autonWorkerMode: "subagent",
        autonSessionWorkerPort: session.port,
        subagentPort: subagent.port,
      }),
    );

    expect(session.port.launch).toHaveBeenCalledTimes(1);
    expect(subagent.port.launch).not.toHaveBeenCalled();
  });

  it("el modo de trabajo viaja en el encargo y no se inventa cuando falta", async () => {
    const withMode = fakePort("session-mode");
    await agentToolEntry.handler(
      { ...INPUT, worker_mode: "session", mode: "read" },
      context({
        autonWorkerMode: "session",
        autonSessionWorkerPort: withMode.port,
        subagentPort: fakePort("sub").port,
      }),
    );
    expect((withMode.launched[0] as { mode?: string }).mode).toBe("read");

    const withoutMode = fakePort("session-plain");
    await agentToolEntry.handler(
      { ...INPUT, worker_mode: "session" },
      context({
        autonWorkerMode: "session",
        autonSessionWorkerPort: withoutMode.port,
        subagentPort: fakePort("sub2").port,
      }),
    );
    expect((withoutMode.launched[0] as { mode?: string }).mode).toBeUndefined();

    const invalidMode = fakePort("session-invalid");
    await agentToolEntry.handler(
      { ...INPUT, worker_mode: "session", mode: "inventado" },
      context({
        autonWorkerMode: "session",
        autonSessionWorkerPort: invalidMode.port,
        subagentPort: fakePort("sub3").port,
      }),
    );
    expect((invalidMode.launched[0] as { mode?: string }).mode).toBe("build");
  });
});

describe("herramientas del worker según el modo", () => {
  it("en modo sesión no hay lista que recorte: juego completo", () => {
    const session = {
      taskType: "auton_worker_session",
      toolset: "main",
    } as AgentRuntimeConfig;

    expect(resolveBuiltInToolAllowlist(session)).toBeUndefined();
  });

  it("en modo subagente la lista se respeta y se le devuelve el canal", () => {
    const subagent = {
      taskType: "subagent_child",
      toolset: "main",
      toolAllowlist: ["Read", "Grep"],
    } as AgentRuntimeConfig;

    expect(resolveBuiltInToolAllowlist(subagent)).toEqual([
      "Read",
      "Grep",
      RESPOND_TO_COORDINATOR_TOOL_NAME,
    ]);
  });
});

describe("el canal encuentra al worker de sesión", () => {
  function channelPorts(sessionTask: unknown) {
    const session = {
      getTask: vi.fn(async () => sessionTask),
      sendMessage: vi.fn(async () => ({
        status: "success" as const,
        messageId: "msg_1",
        delivery: "steered" as const,
      })),
    };
    const subagent = {
      sendMessage: vi.fn(async () => ({
        status: "success" as const,
        messageId: "msg_2",
        delivery: "steered" as const,
      })),
    };
    return { session, subagent };
  }

  it("manda por el puerto de sesión cuando el destino vive ahí", async () => {
    const { session, subagent } = channelPorts({ taskId: "agent_session" });

    await sendMessageToolEntry.handler(
      { to: "agent_session", summary: "dato", message: "usa la paleta nueva" },
      context({
        autonSessionWorkerPort: session,
        subagentPort: subagent,
      }),
    );

    expect(session.sendMessage).toHaveBeenCalledTimes(1);
    expect(subagent.sendMessage).not.toHaveBeenCalled();
  });

  it("manda por el puerto de subagentes cuando el destino no es de sesión", async () => {
    const { session, subagent } = channelPorts(undefined);

    await sendMessageToolEntry.handler(
      { to: "agent_sub", summary: "dato", message: "sigue" },
      context({
        autonSessionWorkerPort: session,
        subagentPort: subagent,
      }),
    );

    expect(subagent.sendMessage).toHaveBeenCalledTimes(1);
    expect(session.sendMessage).not.toHaveBeenCalled();
  });

  it("con el puerto real, un subagente del registro compartido no se confunde con un worker de sesión", async () => {
    const { createAutonSessionWorkerPort } = await import("../src/auton/session-worker.js");
    const { InMemoryRuntimeTaskRegistry } = await import("../src/runtime-task/registry.js");
    const registry = new InMemoryRuntimeTaskRegistry();
    const realSession = createAutonSessionWorkerPort({
      registry,
      mode: "session",
      emitParentEvent: async () => undefined,
      factory: async () => ({
        run: () => new Promise(() => undefined),
        steer: async () => "steered" as const,
        stop: () => undefined,
      }),
    });
    const own = (await realSession.launch({
      sessionId: "sess_orchestrator",
      parentToolCallId: "tool_1",
      agentType: "auton-worker",
      description: "propio",
      prompt: "trabaja",
      workingDirectory: process.cwd(),
      workspaceRoot: process.cwd(),
      trace: { traceId: "trace-1" } as never,
      runInBackground: true,
    })) as { agentId: string };

    registry.register({
      taskId: "agent_sub",
      agentId: "agent_sub",
      agentType: "general-purpose",
      description: "subagente",
      status: "running",
      startedAt: new Date(),
      type: "local_agent",
      taskType: "local_agent",
    } as never);

    const subagent = {
      sendMessage: vi.fn(async () => ({
        status: "success" as const,
        messageId: "msg_sub",
        delivery: "steered" as const,
      })),
    };
    const sessionSpy = vi.spyOn(realSession, "sendMessage");

    await sendMessageToolEntry.handler(
      { to: "agent_sub", summary: "dato", message: "sigue" },
      context({ autonSessionWorkerPort: realSession, subagentPort: subagent }),
    );
    expect(subagent.sendMessage).toHaveBeenCalledTimes(1);
    expect(sessionSpy).not.toHaveBeenCalled();

    await sendMessageToolEntry.handler(
      { to: own.agentId, summary: "dato", message: "sigue tú" },
      context({ autonSessionWorkerPort: realSession, subagentPort: subagent }),
    );
    expect(sessionSpy).toHaveBeenCalledTimes(1);
  });
});
