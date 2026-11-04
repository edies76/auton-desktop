import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryRuntimeTaskRegistry } from "../src/runtime-task/registry.js";
import { createAutonSessionWorkerPort } from "../src/auton/session-worker.js";
import type { AutonSessionWorkerHandle } from "../src/auton/session-worker.js";
import { listWorkerSessions } from "../src/auton/workerIndex.js";
import type { WorkerTranscriptEntry } from "../src/auton/workerTranscript.js";

describe("puerto con host conversacional (Muse MSP)", () => {
  it("mantiene la sesión viva, acepta una segunda entrada y actualiza salida, índice y transcripción", async () => {
    const root = await mkdtemp(join(tmpdir(), "auton-port-conv-"));
    try {
      let response = "primera respuesta";
      let idleResolvers: Array<() => void> = [];
      let transcript: WorkerTranscriptEntry[] = [
        { id: "1", at: 1, kind: "message", role: "orchestrator", text: "primer encargo" },
        { id: "2", at: 2, kind: "message", role: "worker", text: response },
      ];

      const handle: AutonSessionWorkerHandle = {
        run: async () => ({ response, events: [] }),
        steer: async (input) => {
          response = `respuesta a: ${input.message}`;
          transcript = [
            ...transcript,
            {
              id: String(transcript.length + 1),
              at: 3,
              kind: "message",
              role: "orchestrator",
              text: input.message,
            },
            {
              id: String(transcript.length + 2),
              at: 4,
              kind: "message",
              role: "worker",
              text: response,
            },
          ];
          setTimeout(() => {
            const resolvers = idleResolvers;
            idleResolvers = [];
            for (const resolve of resolvers) resolve();
          }, 10);
          return "steered";
        },
        stop: () => undefined,
        keepAlive: true,
        answersThroughCoordinator: false,
        getEngineSessionId: () => "muse-session-fake",
        transcript: () => transcript,
        waitForIdle: () =>
          new Promise<void>((resolve) => {
            idleResolvers.push(resolve);
          }),
        lastResponse: () => response,
      };

      const registry = new InMemoryRuntimeTaskRegistry();
      const port = createAutonSessionWorkerPort({
        registry,
        factory: async () => {
          throw new Error("ZCode no debe usarse en esta prueba");
        },
        museFactory: async () => handle,
        mode: "session",
        emitParentEvent: async () => undefined,
      });

      const launched = (await port.launch({
        sessionId: "sess_orchestrator",
        parentToolCallId: "tool_conv",
        agentType: "auton-worker",
        description: "conversacional",
        prompt: "primer encargo",
        engine: "muse",
        mode: "read",
        workingDirectory: root,
        workspaceRoot: root,
        trace: { traceId: "trace-conv", sessionId: "sess_orchestrator" } as never,
        runInBackground: true,
      })) as { agentId: string };

      let task = registry.get(launched.agentId);
      for (let attempt = 0; attempt < 40 && task?.status !== "completed"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        task = registry.get(launched.agentId);
      }
      expect(task?.status).toBe("completed");
      expect(task?.engineSessionId).toBe("muse-session-fake");

      const sent = await port.sendMessage?.({
        sessionId: "sess_orchestrator",
        parentToolCallId: "tool_conv_2",
        to: launched.agentId,
        summary: "segundo",
        message: "segunda entrada",
        workingDirectory: root,
        workspaceRoot: root,
        trace: { traceId: "trace-conv-2", sessionId: "sess_orchestrator" } as never,
      });
      expect(sent?.status).toBe("success");
      expect(sent?.waitingForAnswer).toBeUndefined();

      let output = "";
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const current = registry.get(launched.agentId);
        output = current?.outputFile
          ? await readFile(current.outputFile, "utf8").catch(() => "")
          : "";
        if (current?.status === "completed" && output.includes("segunda entrada")) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(output).toContain("respuesta a: segunda entrada");

      const taskAfter = registry.get(launched.agentId);
      expect(taskAfter?.engineSessionId).toBe("muse-session-fake");
      const transcriptFile = join(
        taskAfter!.workingDirectory!,
        ".auton",
        "worker-transcript.json",
      );
      const writtenTranscript = JSON.parse(await readFile(transcriptFile, "utf8")) as Array<{
        text: string;
      }>;
      expect(JSON.stringify(writtenTranscript)).toContain("segunda entrada");

      const indexed = await listWorkerSessions(root, { engine: "muse" });
      expect(indexed).toHaveLength(1);
      expect(indexed[0]?.engineSessionId).toBe("muse-session-fake");
      expect(indexed[0]?.status).toBe("completed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
