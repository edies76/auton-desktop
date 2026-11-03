import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSessionId, type ModelResult } from "@zcode/contracts";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";

interface RecordedRequest {
  tools: string[];
  messages: unknown[];
}

const WRITE_TOOLS = ["Write", "Edit", "Bash", "ApplyPatch", "AutonRevert", "AutonPlan"];

async function dispatchWithMode(
  mode: "build" | "read" | "research" | "debug" | "refactor",
  workerMode: "subagent" | "session",
) {
  const root = await mkdtemp(join(tmpdir(), "auton-mode-"));
  const requests: RecordedRequest[] = [];
  let parentCalls = 0;

  const modelAdapter = {
    async generateText(request: {
      tools?: Array<{ name: string }>;
      messages?: unknown[];
    }): Promise<ModelResult> {
      const tools = (request.tools ?? []).map((tool) => tool.name);
      requests.push({ tools, messages: request.messages ?? [] });
      if (tools.includes("Agent")) {
        parentCalls += 1;
        if (parentCalls === 1) {
          return {
            finishReason: "tool-calls" as const,
            providerMetadata: undefined,
            text: "",
            toolCalls: [
              {
                id: "call_agent_mode",
                name: "Agent",
                input: {
                  subagent_type: "auton-worker",
                  worker_mode: workerMode,
                  mode,
                  description: "encargo de modo",
                  prompt: "haz lo tuyo",
                },
              },
            ],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        }
        return {
          finishReason: "stop" as const,
          providerMetadata: undefined,
          text: "recibido",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      }
      return {
        finishReason: "stop" as const,
        providerMetadata: undefined,
        text: "listo",
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
    },
  } as never;

  const parent = createTestAgentRuntime(
    createSessionId(`auton-mode-${workerMode}-${mode}`),
    {
      mode: "build",
      autonWorkerMode: workerMode,
      workingDirectory: root,
      workspacePath: root,
    },
    { eventStore: createTestSessionEventStore(), modelAdapter },
  );

  await parent.executeTurn("despacha con modo", undefined, {
    traceContext: {
      traceId: `trace-${workerMode}-${mode}`,
      sessionId: parent.sessionId,
    } as never,
  });

  const workerRequests = requests.filter((request) => !request.tools.includes("Agent"));
  return { root, workerRequests, parent };
}

describe("seguridad del modo en el camino real de despacho", () => {
  it("read no recibe herramientas de escritura y no deja diario", async () => {
    const { root, workerRequests } = await dispatchWithMode("read", "session");
    try {
      expect(workerRequests.length).toBeGreaterThan(0);
      const worker = workerRequests[0]!;
      const prompt = JSON.stringify(worker.messages);
      expect(prompt).toContain("MODO DE TRABAJO: read");
      expect(prompt).toContain("No escribes ni modificas ningún archivo");

      for (const tool of WRITE_TOOLS) {
        expect(worker.tools).not.toContain(tool);
      }
      await expect(stat(join(root, ".auton", "changes.jsonl"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("read también recorta el juego en el camino subagente", async () => {
    const { root, workerRequests } = await dispatchWithMode("read", "subagent");
    try {
      expect(workerRequests.length).toBeGreaterThan(0);
      for (const tool of WRITE_TOOLS) {
        expect(workerRequests[0]!.tools).not.toContain(tool);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("debug conserva la ejecución para reproducir y declara su criterio", async () => {
    const { root, workerRequests } = await dispatchWithMode("debug", "session");
    try {
      const worker = workerRequests[0]!;
      const prompt = JSON.stringify(worker.messages);
      expect(prompt).toContain("MODO DE TRABAJO: debug");
      expect(prompt).toContain("El comando que reproduce el fallo");
      expect(worker.tools).toContain("Bash");
      expect(worker.tools).not.toContain("Write");
      expect(worker.tools).not.toContain("Edit");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("refactor conserva el juego completo y declara los tests verdes", async () => {
    const { root, workerRequests } = await dispatchWithMode("refactor", "session");
    try {
      const worker = workerRequests[0]!;
      const prompt = JSON.stringify(worker.messages);
      expect(prompt).toContain("MODO DE TRABAJO: refactor");
      expect(prompt).toContain("Los tests siguen en verde");
      expect(worker.tools).toContain("Write");
      expect(worker.tools).toContain("Edit");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
