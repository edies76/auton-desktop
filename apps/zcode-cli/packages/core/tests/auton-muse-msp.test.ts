import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSessionId } from "@zcode/contracts";
import { MuseMspClient } from "../src/auton/museMspClient.js";
import { transcriptFromMuseTurns } from "../src/auton/workerTranscript.js";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { listWorkerSessions } from "../src/auton/workerIndex.js";

const runRealMuse = process.env.AUTON_MUSE_E2E === "1";

describe.runIf(runRealMuse)("Muse MSP real (opt-in con AUTON_MUSE_E2E=1)", () => {
  it("abre una sesión, manda dos entradas y lee ambas respuestas en orden", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "muse-msp-real-"));
    const client = new MuseMspClient({ workspace, provider: "echo" });
    try {
      await client.start();
      expect(client.sessionId).toBeTruthy();

      const first = await client.startTurn("Di hola");
      const firstTurn = await client.waitForTurn(first.turnId);
      expect(firstTurn.terminal).toBe("completed");
      expect(firstTurn.assistantText).toContain("echo: Di hola");

      const second = await client.steer("Segundo: di mundo");
      const secondTurn = await client.waitForTurn(second.turnId);
      expect(secondTurn.assistantText).toContain("echo: Segundo: di mundo");

      const conversation = client.conversation();
      expect(conversation.length).toBeGreaterThanOrEqual(2);
      expect(conversation[0]?.assistantText).toContain("Di hola");
      expect(conversation.at(-1)?.assistantText).toContain("mundo");

      const transcript = transcriptFromMuseTurns(conversation, 1_000);
      expect(transcript.filter((entry) => entry.kind === "close")).toHaveLength(2);
      expect(transcript.at(-1)).toMatchObject({
        kind: "close",
        status: "completed",
      });
      const text = transcript.map((entry) => entry.text).join("\n");
      expect(text.indexOf("echo: Di hola")).toBeLessThan(text.indexOf("echo: Segundo: di mundo"));
    } finally {
      client.close();
      await rm(workspace, { recursive: true, force: true });
    }
  }, 120_000);

  it("el puerto real lanza Muse, completa el turno y para", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse-msp-port-one-"));
    const previousProvider = process.env.AUTON_MUSE_PROVIDER;
    process.env.AUTON_MUSE_PROVIDER = "echo";
    try {
      const parent = createTestAgentRuntime(
        createSessionId("auton-muse-msp-port-one"),
        {
          mode: "build",
          autonWorkerMode: "session",
          workingDirectory: root,
          workspacePath: root,
        },
        {
          eventStore: createTestSessionEventStore(),
          modelAdapter: {
            async generateText(): Promise<never> {
              throw new Error("ZCode no debe usarse con Muse");
            },
          } as never,
        },
      );
      const port = (
        parent as unknown as {
          autonSessionWorkerPort: {
            launch(request: unknown): Promise<{ agentId: string }>;
            getTask(id: string): Promise<
              {
                status: string;
                outputFile?: string;
                engineSessionId?: string;
              } | undefined
            >;
            stopTask(id: string): Promise<{ status: string } | undefined>;
            sendMessage?(
              request: unknown,
            ): Promise<{ status: string; delivery?: string } | undefined>;
          };
        }
      ).autonSessionWorkerPort;

      const launched = await port.launch({
        sessionId: parent.sessionId,
        parentToolCallId: "tool_msp_one",
        agentType: "auton-worker",
        description: "muse una pasada",
        prompt: "Di hola",
        engine: "muse",
        mode: "read",
        workingDirectory: root,
        workspaceRoot: root,
        trace: { traceId: "trace-msp-one", sessionId: parent.sessionId } as never,
        runInBackground: true,
      });

      let task = await port.getTask(launched.agentId);
      for (let attempt = 0; attempt < 160 && task?.status !== "completed"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        task = await port.getTask(launched.agentId);
      }
      expect(task?.status).toBe("completed");
      expect(task?.engineSessionId).toBeTruthy();
      const output = await readFile(task!.outputFile!, "utf8");
      expect(output).toContain("echo:");
      expect(output).toContain("MODO DE TRABAJO: read");

      const indexed = await listWorkerSessions(root, { engine: "muse" });
      expect(indexed).toHaveLength(1);
      expect(indexed[0]?.engineSessionId).toBe(task?.engineSessionId);

      const second = await port.sendMessage?.({
        sessionId: parent.sessionId,
        parentToolCallId: "tool_msp_two",
        to: launched.agentId,
        summary: "segunda entrada",
        message: "Segundo: di mundo",
        workingDirectory: root,
        workspaceRoot: root,
        trace: { traceId: "trace-msp-two", sessionId: parent.sessionId } as never,
      });
      expect(second?.status).toBe("success");

      let secondTask = await port.getTask(launched.agentId);
      let secondOutput = "";
      for (let attempt = 0; attempt < 160; attempt += 1) {
        secondTask = await port.getTask(launched.agentId);
        secondOutput = secondTask?.outputFile
          ? await readFile(secondTask.outputFile, "utf8").catch(() => "")
          : "";
        if (secondTask?.status === "completed" && secondOutput.includes("Segundo: di mundo")) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(secondTask?.status).toBe("completed");
      expect(secondTask?.engineSessionId).toBe(task?.engineSessionId);
      expect(secondOutput).toContain("Segundo: di mundo");
      expect(secondOutput).not.toBe(output);

      const secondIndex = await listWorkerSessions(root, { engine: "muse" });
      expect(secondIndex[0]?.engineSessionId).toBe(task?.engineSessionId);
      const transcript = await readFile(secondIndex[0]!.transcriptFile!, "utf8");
      expect(transcript).toContain("Segundo: di mundo");
      expect(transcript).toContain('"kind": "close"');

      const stopped = await port.stopTask(launched.agentId);
      expect(stopped?.status).toBe("stopped");
    } finally {
      if (previousProvider === undefined) delete process.env.AUTON_MUSE_PROVIDER;
      else process.env.AUTON_MUSE_PROVIDER = previousProvider;
      await rm(root, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 250,
      });
    }
  }, 240_000);

  it("manda un steer mientras el primer turno corre (proveedor meta)", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "muse-msp-steer-"));
    const client = new MuseMspClient({ workspace, provider: "meta" });
    try {
      await client.start();
      const sessionId = client.sessionId;
      const first = await client.startTurn(
        "Ejecuta el comando `Start-Sleep -Seconds 6` con la herramienta de shell y luego responde: PRIMERO.",
      );
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      const steered = await client.steer(
        "SEGUNDO: además de PRIMERO, escribe SEGUNDO en tu respuesta final.",
      );
      expect(steered.disposition === "steered" || steered.disposition === "queued").toBe(true);
      expect(steered.turnId).toBeTruthy();
      const firstTurn = await client.waitForTurn(first.turnId);
      expect(firstTurn.terminal).toBe("completed");
      await client.waitForIdle();
      const conversation = client.conversation();
      expect(conversation.length).toBeGreaterThanOrEqual(1);
      const assistantText = conversation
        .map((turn) => turn.assistantText)
        .filter((text) => text.length > 0)
        .join("\n");
      expect(assistantText).toContain("PRIMERO");
      expect(assistantText).toContain("SEGUNDO");
      expect(assistantText.indexOf("PRIMERO")).toBeLessThan(assistantText.indexOf("SEGUNDO"));
      expect(client.sessionId).toBe(sessionId);
    } finally {
      client.close();
      await rm(workspace, { recursive: true, force: true });
    }
  }, 180_000);
});
