import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSessionId, type ModelResult } from "@zcode/contracts";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { listWorkerSessions, readWorkerIndex } from "../src/auton/workerIndex.js";

interface RecordedRequest {
  tools: string[];
  messages: unknown[];
}

describe("worker ZCode: reanudación en la misma sesión", () => {
  it("responde dos mensajes después de terminar, mismo sessionId y carpeta", async () => {
    const root = await mkdtemp(join(tmpdir(), "auton-resume-"));
    const requests: RecordedRequest[] = [];
    const modelAdapter = {
      async generateText(request: {
        tools?: Array<{ name: string }>;
        messages?: unknown[];
      }): Promise<ModelResult> {
        requests.push({
          tools: (request.tools ?? []).map((tool) => tool.name),
          messages: request.messages ?? [],
        });
        const payload = JSON.stringify(request.messages ?? []);
        const text = payload.includes("tercer encargo")
          ? "tercera respuesta"
          : payload.includes("segundo encargo")
            ? "segunda respuesta"
            : "primera respuesta";
        return {
          finishReason: "stop" as const,
          providerMetadata: undefined,
          text,
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      },
    } as never;

    try {
      const eventStore = createTestSessionEventStore();
      const parent = createTestAgentRuntime(
        createSessionId("auton-resume-parent"),
        {
          mode: "build",
          autonWorkerMode: "session",
          workingDirectory: root,
          workspacePath: root,
        },
        { eventStore, modelAdapter },
      );
      const port = (
        parent as unknown as {
          autonSessionWorkerPort: {
            launch(request: unknown): Promise<{ agentId: string }>;
            sendMessage(request: unknown): Promise<{
              status: string;
              delivery?: string;
              message?: string;
            }>;
            getTask(id: string): Promise<
              { status: string; childSessionId?: string; workingDirectory?: string; outputFile?: string } | undefined
            >;
          };
        }
      ).autonSessionWorkerPort;

      const launched = await port.launch({
        sessionId: parent.sessionId,
        parentToolCallId: "tool_resume",
        agentType: "auton-worker",
        description: "reanudable",
        prompt: "primer encargo",
        engine: "zcode",
        mode: "build",
        workingDirectory: root,
        workspaceRoot: root,
        trace: { traceId: "trace-resume", sessionId: parent.sessionId } as never,
        runInBackground: true,
      });

      const waitCompleted = async () => {
        let task = await port.getTask(launched.agentId);
        for (let attempt = 0; attempt < 120 && task?.status !== "completed"; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          task = await port.getTask(launched.agentId);
        }
        return task;
      };

      const first = await waitCompleted();
      expect(first?.status).toBe("completed");
      const firstSessionId = first?.childSessionId;
      const firstWorkspace = first?.workingDirectory;
      expect(firstSessionId).toMatch(/^sess_auton_/);
      const firstOutput = await readFile(first!.outputFile!, "utf8");
      expect(firstOutput).toContain("primera respuesta");

      // La transcripción de ZCode sale de los eventos reales de su sesión.
      const firstTranscript = JSON.parse(
        await readFile(
          join(first!.workingDirectory!, ".auton", "worker-transcript.json"),
          "utf8",
        ),
      ) as Array<{ kind: string; text: string }>;
      expect(JSON.stringify(firstTranscript)).toContain("primera respuesta");

      const sent = await port.sendMessage({
        sessionId: parent.sessionId,
        parentToolCallId: "tool_resume_2",
        to: launched.agentId,
        summary: "segundo",
        message: "segundo encargo",
        workingDirectory: root,
        workspaceRoot: root,
        trace: { traceId: "trace-resume-2", sessionId: parent.sessionId } as never,
      });
      expect(sent.status).toBe("success");
      expect(sent.delivery).toBe("resumed_background");

      const second = await waitCompleted();
      expect(second?.childSessionId).toBe(firstSessionId);
      expect(second?.workingDirectory).toBe(firstWorkspace);
      const secondOutput = await readFile(second!.outputFile!, "utf8");
      expect(secondOutput).toContain("segunda respuesta");

      const sentAgain = await port.sendMessage({
        sessionId: parent.sessionId,
        parentToolCallId: "tool_resume_3",
        to: launched.agentId,
        summary: "tercero",
        message: "tercer encargo",
        workingDirectory: root,
        workspaceRoot: root,
        trace: { traceId: "trace-resume-3", sessionId: parent.sessionId } as never,
      });
      expect(sentAgain.status).toBe("success");

      const third = await waitCompleted();
      expect(third?.childSessionId).toBe(firstSessionId);
      const thirdOutput = await readFile(third!.outputFile!, "utf8");
      expect(thirdOutput).toContain("tercera respuesta");

      // El contexto de la sesión viaja al modelo en la reanudación.
      const resumeRequests = requests.filter((entry) => entry.tools.length > 0);
      expect(JSON.stringify(resumeRequests.at(-1)?.messages)).toContain("segunda respuesta");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("índice durable de sesiones", () => {
  it("ordena por inicio y filtra por motor", async () => {
    const root = await mkdtemp(join(tmpdir(), "auton-index-"));
    try {
      const { upsertWorkerSession } = await import("../src/auton/workerIndex.js");
      await upsertWorkerSession(root, {
        workerId: "w-muse",
        taskId: "w-muse",
        engine: "muse",
        engineSessionId: "muse-session-1",
        workspace: join(root, ".auton", "workers", "w-muse"),
        status: "completed",
        startedAt: "2026-11-03T10:00:02.000Z",
        endedAt: "2026-11-03T10:00:05.000Z",
        description: "muse",
      });
      await upsertWorkerSession(root, {
        workerId: "w-zcode",
        taskId: "w-zcode",
        engine: "zcode",
        engineSessionId: "sess_auton_w-zcode",
        workspace: join(root, ".auton", "workers", "w-zcode"),
        status: "running",
        startedAt: "2026-11-03T10:00:01.000Z",
        description: "zcode",
      });

      const all = await readWorkerIndex(root);
      expect(all.map((entry) => entry.workerId)).toEqual(["w-zcode", "w-muse"]);
      const muse = await listWorkerSessions(root, { engine: "muse" });
      expect(muse).toHaveLength(1);
      expect(muse[0]?.engineSessionId).toBe("muse-session-1");
      expect(muse[0]?.status).toBe("completed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
