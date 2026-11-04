import { describe, expect, it, vi } from "vitest";
import { AgentInputSchema } from "@zcode/contracts";
import { InMemoryRuntimeTaskRegistry } from "../src/runtime-task/registry.js";
import { createAutonSessionWorkerPort } from "../src/auton/session-worker.js";
import { agentToolEntry } from "../src/tool/handlers/agent.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

function fakeHandle(response = "ok") {
  return {
    run: async () => ({ response, events: [] }),
    steer: async () => "steered" as const,
    stop: () => undefined,
  };
}

function request(engine?: "zcode" | "muse") {
  return {
    sessionId: "sess_orchestrator",
    parentToolCallId: "tool_engine",
    agentType: "auton-worker",
    description: "encargo",
    prompt: "hazlo",
    workingDirectory: "C:/proyecto",
    workspaceRoot: "C:/proyecto",
    trace: { traceId: "trace-engine", sessionId: "sess_orchestrator" } as never,
    runInBackground: true,
    ...(engine ? { engine } : {}),
  };
}

function port(factories: {
  zcode?: () => Promise<unknown>;
  muse?: () => Promise<unknown>;
  withoutMuse?: boolean;
}) {
  const zcode = vi.fn(factories.zcode ?? (async () => fakeHandle("zcode")));
  const muse = vi.fn(factories.muse ?? (async () => fakeHandle("muse")));
  const registry = new InMemoryRuntimeTaskRegistry();
  const workerPort = createAutonSessionWorkerPort({
    registry,
    factory: zcode as never,
    ...(factories.withoutMuse ? {} : { museFactory: muse as never }),
    mode: "session",
    emitParentEvent: async () => undefined,
  });
  return { workerPort, zcode, muse };
}

describe("el motor se elige en el despacho, nunca en silencio", () => {
  it("engine muse usa el adaptador de Muse", async () => {
    const { workerPort, zcode, muse } = port({});
    await workerPort.launch(request("muse"));
    expect(muse).toHaveBeenCalledTimes(1);
    expect(zcode).not.toHaveBeenCalled();
  });

  it("engine zcode y ausente usan el motor de casa", async () => {
    const { workerPort, zcode, muse } = port({});
    await workerPort.launch(request("zcode"));
    await workerPort.launch(request());
    expect(zcode).toHaveBeenCalledTimes(2);
    expect(muse).not.toHaveBeenCalled();
  });

  it("muse sin adaptador falla explícito en vez de caer a zcode", async () => {
    const { workerPort, zcode, muse } = port({ withoutMuse: true });
    await expect(workerPort.launch(request("muse"))).rejects.toThrow(/muse no está disponible/);
    expect(zcode).not.toHaveBeenCalled();
    expect(muse).not.toHaveBeenCalled();
  });

  it("el esquema rechaza un motor inventado", () => {
    const description = AgentInputSchema.shape.engine.description ?? "";
    expect(description).toContain("steer");
    expect(description).toContain("session alive");
    expect(description).not.toContain("one-shot");
    expect(() =>
      AgentInputSchema.parse({
        description: "x",
        prompt: "y",
        subagent_type: "auton-worker",
        engine: "otro",
      }),
    ).toThrow();
    const parsed = AgentInputSchema.parse({
      description: "x",
      prompt: "y",
      subagent_type: "auton-worker",
      engine: "muse",
    });
    expect(parsed.engine).toBe("muse");
  });
});

describe("el motor viaja desde la herramienta y fuerza sesión si es muse", () => {
  function fakeSubagent(label: string) {
    const launched: unknown[] = [];
    return {
      launched,
      port: {
        launch: vi.fn(async (input: unknown) => {
          launched.push(input);
          return {
            status: "async_launched",
            isAsync: true,
            agentId: "agent_1",
            agentType: "auton-worker",
            description: "x",
            prompt: "y",
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

  it("pasa engine al encargo", async () => {
    const session = fakeSubagent("engine");
    await agentToolEntry.handler(
      { description: "x", prompt: "y", subagent_type: "auton-worker", engine: "muse" },
      context({
        autonWorkerMode: "subagent",
        autonSessionWorkerPort: session.port,
        subagentPort: fakeSubagent("sub").port,
      }),
    );
    expect((session.launched[0] as { engine?: string }).engine).toBe("muse");
  });

  it("muse fuerza la ruta de sesión aunque worker_mode pida subagente", async () => {
    const session = fakeSubagent("engine-session");
    const subagent = fakeSubagent("engine-sub");
    await agentToolEntry.handler(
      {
        description: "x",
        prompt: "y",
        subagent_type: "auton-worker",
        engine: "muse",
        worker_mode: "subagent",
      },
      context({
        autonWorkerMode: "subagent",
        autonSessionWorkerPort: session.port,
        subagentPort: subagent.port,
      }),
    );
    expect(session.port.launch).toHaveBeenCalledTimes(1);
    expect(subagent.port.launch).not.toHaveBeenCalled();
  });
});
