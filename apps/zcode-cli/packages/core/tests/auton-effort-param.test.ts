import { describe, expect, it, vi } from "vitest";
import { agentToolEntry } from "../src/tool/handlers/agent.js";
import { buildAutonWorkerPromptForRequest } from "../src/subagent/worker-policy.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

interface CapturedLaunch {
  effort?: string;
  prompt: string;
  agentType: string;
}

async function dispatch(input: Record<string, unknown>): Promise<CapturedLaunch> {
  const captured: CapturedLaunch[] = [];
  const launch = vi.fn(async (request: CapturedLaunch) => {
    captured.push(request);
    return {
      status: "async_launched" as const,
      agentId: "agent_1",
      agentType: request.agentType,
      description: "landing page",
      canReadOutputFile: false,
      outputFile: "/tmp/agent_1.txt",
    };
  });

  const context = {
    sessionId: "session_effort",
    turnId: "turn_effort",
    toolCallId: "call_effort",
    workingDirectory: "/workspace",
    workspaceRoot: "/workspace",
    trace: { traceId: "trace", spanId: "span", parentSpanId: undefined },
    providerVisibleToolNames: [],
    subagentPort: { launch },
  } as unknown as ToolExecutionContext;

  await agentToolEntry.handler(input, context);
  const first = captured[0];
  if (!first) throw new Error("the Agent handler did not call the subagent port");
  return first;
}

describe("effort as an Agent tool parameter", () => {
  it("travels as a field, so the brief carries no policy line", async () => {
    const request = await dispatch({
      description: "landing page",
      prompt: "Escribe index.html con la landing.",
      subagent_type: "auton-worker",
      effort: "minimal",
    });

    expect(request.effort).toBe("minimal");
    expect(request.prompt).not.toMatch(/POL[IÍ]TICA DE ESFUERZO/i);
  });

  it("builds the worker system prompt from the parameter", async () => {
    const request = await dispatch({
      description: "landing page",
      prompt: "Escribe index.html con la landing.",
      subagent_type: "auton-worker",
      effort: "minimal",
    });

    const systemPrompt = buildAutonWorkerPromptForRequest({
      effort: request.effort as "minimal" | "standard" | "thorough",
      brief: request.prompt,
    });

    expect(systemPrompt).toContain("POLÍTICA DE ESFUERZO: minimal");
    expect(systemPrompt).toContain("Solo el cambio pedido");
    expect(systemPrompt).not.toContain("POLÍTICA DE ESFUERZO: thorough");
  });

  it("resolves thorough from the parameter and lets it win over the brief line", async () => {
    const request = await dispatch({
      description: "landing page",
      prompt: "POLITICA DE ESFUERZO: minimal\nEscribe index.html con la landing.",
      subagent_type: "auton-worker",
      effort: "thorough",
    });

    const systemPrompt = buildAutonWorkerPromptForRequest({
      effort: request.effort as "minimal" | "standard" | "thorough",
      brief: request.prompt,
    });

    expect(systemPrompt).toContain("POLÍTICA DE ESFUERZO: thorough");
    expect(systemPrompt).toContain("lo que un buen ingeniero haría alrededor");
  });

  it("keeps the brief line as compatibility when no parameter arrives", async () => {
    const request = await dispatch({
      description: "landing page",
      prompt: "POLITICA DE ESFUERZO: minimal\nEscribe index.html.",
      subagent_type: "auton-worker",
    });

    const systemPrompt = buildAutonWorkerPromptForRequest({ brief: request.prompt });

    expect(systemPrompt).toContain("POLÍTICA DE ESFUERZO: minimal");
  });

  it("records the plan item for the launched programmer", async () => {
    const { mkdtemp, readFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = await mkdtemp(join(tmpdir(), "auton-agent-item-"));
    try {
      const launch = vi.fn(async (request: { agentType: string }) => ({
        status: "async_launched" as const,
        agentId: "agent_item_1",
        agentType: request.agentType,
        description: "landing page",
        canReadOutputFile: false,
        outputFile: "/tmp/agent_item_1.txt",
      }));
      const context = {
        sessionId: "session_item",
        turnId: "turn_item",
        toolCallId: "call_item",
        workingDirectory: root,
        workspaceRoot: root,
        trace: { traceId: "trace", spanId: "span" },
        providerVisibleToolNames: [],
        subagentPort: { launch },
      } as unknown as ToolExecutionContext;

      await agentToolEntry.handler(
        {
          description: "landing page",
          prompt: "Escribe index.html.",
          subagent_type: "auton-worker",
          item_id: "s7",
        },
        context,
      );

      const map = JSON.parse(await readFile(join(root, ".auton", "agent-items.json"), "utf8")) as Record<
        string,
        string
      >;
      expect(map.agent_item_1).toBe("s7");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
