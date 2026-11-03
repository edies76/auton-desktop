import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SessionId, SubagentRunRequest } from "@zcode/contracts";
import { createSessionId } from "@zcode/contracts";
import {
  buildMuseExecArgs,
  buildMuseSpawnSpec,
  museModeArgs,
  parseAutonWorkerEngine,
  parseWorkerReporte,
  probeMuseEngine,
  resolveAutonWorkerEngine,
} from "../src/auton/workerEngine.js";
import { createMuseWorkerHandle } from "../src/auton/museWorker.js";
import { resolveAutonWorkerPlacement } from "../src/auton/worker-mode.js";
import type { AutonSessionWorkerFactoryInput } from "../src/auton/session-worker.js";
import { buildMuseWorkerPrompt } from "../src/runtime/methods/autonSessionWorker.js";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";

const FIXTURE = fileURLToPath(new URL("./fixtures/fake-muse.cjs", import.meta.url));
const TRACE = { traceId: "trace-muse", sessionId: "sess_orchestrator" } as never;

async function makeInput(
  root: string,
  overrides: Partial<SubagentRunRequest> = {},
): Promise<AutonSessionWorkerFactoryInput> {
  const placement = resolveAutonWorkerPlacement({
    mode: "session",
    parentWorkingDirectory: root,
    workspaceRoot: root,
    workerSessionId: "sess_auton_muse_test",
  });
  const request = {
    sessionId: "sess_orchestrator",
    parentToolCallId: "tool_muse",
    agentType: "auton-worker",
    description: "encargo muse",
    prompt: "haz el encargo",
    engine: "muse",
    workingDirectory: root,
    workspaceRoot: root,
    trace: TRACE,
    ...overrides,
  } as SubagentRunRequest;
  return {
    request,
    placement,
    agentId: "agent_muse",
    sessionId: "sess_auton_muse_test" as SessionId,
    onEvent: async () => undefined,
  };
}

function probeEvent(lines: string[]) {
  const raw = lines.find((line) => line.includes('"fake.probe"'));
  return raw ? JSON.parse(raw) : undefined;
}

describe("contrato del motor", () => {
  it("resuelve zcode por defecto y no adivina un motor inventado", () => {
    expect(parseAutonWorkerEngine("MUSE")).toBe("muse");
    expect(parseAutonWorkerEngine("zcode")).toBe("zcode");
    expect(parseAutonWorkerEngine("otro")).toBeUndefined();
    expect(resolveAutonWorkerEngine(undefined)).toBe("zcode");
    expect(resolveAutonWorkerEngine("otro")).toBe("zcode");
  });

  it("la sonda lee la versión del binario y falla con motivo si no existe", () => {
    const ok = probeMuseEngine({
      command: process.execPath,
      args: [FIXTURE, "--version"],
    });
    expect(ok.available).toBe(true);
    expect(ok.version).toBe("9.9.9");

    const missing = probeMuseEngine({
      command: "definitely-not-muse-xyz",
      timeoutMs: 5_000,
    });
    expect(missing.available).toBe(false);
    expect(missing.reason).toContain("definitely-not-muse-xyz");
  });

  it("el modo se impone con flags del motor", () => {
    expect(museModeArgs("read")).toEqual(["--disable-write", "--disable-shell"]);
    expect(museModeArgs("research")).toEqual(["--disable-write", "--disable-shell"]);
    expect(museModeArgs("debug")).toEqual(["--disable-write"]);
    expect(museModeArgs("build")).toEqual([]);
    expect(museModeArgs("refactor")).toEqual([]);
  });

  it("arma el comando headless con carpeta, prompt y esfuerzo", () => {
    const args = buildMuseExecArgs({
      workspace: "C:/w",
      promptFile: "C:/w/.auton/muse-prompt.txt",
      mode: "read",
      thinkingLevel: "high",
      provider: "echo",
      model: "muse-spark",
      maxModelSteps: 4,
    });
    expect(args).toContain("exec");
    expect(args).toContain("--json");
    expect(args).toContain("--workspace");
    expect(args).toContain("--prompt-file");
    expect(args).toContain("--approval-mode");
    expect(args).toContain("never");
    expect(args).toContain("--disable-request-user-input");
    expect(args).toContain("--disable-write");
    expect(args).toContain("--disable-shell");
    expect(args).toContain("--provider");
    expect(args).toContain("echo");
    expect(args).toContain("--reasoning-effort");
    expect(args).toContain("high");
    expect(args).toContain("--max-model-steps");
    expect(args).toContain("4");
  });

  it("el reporte se interpreta con los cuatro estados", () => {
    expect(parseWorkerReporte("...\nSTATUS: DONE\n")).toBe("DONE");
    expect(parseWorkerReporte("STATUS: DONE_WITH_CONCERNS")).toBe("DONE_WITH_CONCERNS");
    expect(parseWorkerReporte("STATUS: NEEDS_CONTEXT")).toBe("NEEDS_CONTEXT");
    expect(parseWorkerReporte("STATUS: BLOCKED")).toBe("BLOCKED");
    expect(parseWorkerReporte("sin reporte")).toBeUndefined();
  });

  it("cita cada argumento para cmd.exe en Windows (espacios y &)", () => {
    if (process.platform !== "win32") return;
    const spec = buildMuseSpawnSpec(
      "muse",
      ["exec", "--workspace", "C:\\pro yecto\\a&b", "--prompt-file", "C:\\pro yecto\\p.txt"],
      { ComSpec: "cmd.exe" },
    );
    expect(spec.command).toBe("cmd.exe");
    expect(spec.args.slice(0, 3)).toEqual(["/d", "/s", "/c"]);
    expect(spec.args[3]?.startsWith('"muse ')).toBe(true);
    expect(spec.args[3]).toContain('"C:\\pro yecto\\a&b"');
    expect(spec.args[3]).toContain('"C:\\pro yecto\\p.txt"');
    expect(spec.windowsVerbatimArguments).toBe(true);

    const direct = buildMuseSpawnSpec(process.execPath, ["x"]);
    expect(direct.command).toBe(process.execPath);
    expect(direct.windowsVerbatimArguments).toBeUndefined();
  });
});

describe("adaptador de Muse Code", () => {
  it("lanza headless, lee el progreso y devuelve el REPORTE", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse-adapter-"));
    try {
      const input = await makeInput(root, { mode: "read" });
      const handle = createMuseWorkerHandle({
        input,
        prompt: "MODO DE TRABAJO: read\nNo escribes.\n\n## ENCARGO\nhaz el encargo",
        command: process.execPath,
        commandPrefix: [FIXTURE],
      });

      const result = await handle.run();
      expect(result.response).toContain("STATUS: DONE");
      expect(parseWorkerReporte(result.response)).toBe("DONE");

      const workerDir = input.placement.workingDirectory;
      const progress = await readFile(
        join(workerDir, ".auton", "muse-progress.jsonl"),
        "utf8",
      );
      const event = probeEvent(progress.split("\n"));
      expect(event?.payload?.cwd?.replaceAll("\\", "/")).toBe(workerDir.replaceAll("\\", "/"));
      expect(event?.payload?.argv).toContain("--workspace");
      expect(event?.payload?.argv).toContain(workerDir);
      expect(event?.payload?.argv).toContain("--disable-write");
      expect(event?.payload?.argv).toContain("--disable-shell");
      expect(event?.payload?.prompt).toContain("MODO DE TRABAJO: read");
      expect(event?.payload?.prompt).toContain("## ENCARGO");
      expect(event?.payload?.prompt).toContain("haz el encargo");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("un terminal fallido del motor se convierte en error explícito", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse-fail-"));
    try {
      const input = await makeInput(root);
      const handle = createMuseWorkerHandle({
        input,
        prompt: "encargo",
        command: process.execPath,
        commandPrefix: [FIXTURE],
        env: { ...process.env, FAKE_MUSE_FAIL: "1", FAKE_MUSE_REASON: "auth caída" },
      });
      await expect(handle.run()).rejects.toThrow(/auth caída/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("detener mata el proceso y el turno no se reporta como completado", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse-stop-"));
    try {
      const input = await makeInput(root);
      const handle = createMuseWorkerHandle({
        input,
        prompt: "encargo largo",
        command: process.execPath,
        commandPrefix: [FIXTURE],
        env: { ...process.env, FAKE_MUSE_SLEEP_MS: "10000" },
      });
      const running = handle.run();
      await new Promise((resolve) => setTimeout(resolve, 400));
      handle.stop();
      await expect(running).rejects.toThrow(/detenido/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("sin binario disponible el adaptador falla claro y no arranca", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse-missing-"));
    try {
      const input = await makeInput(root);
      expect(() =>
        createMuseWorkerHandle({
          input,
          prompt: "encargo",
          command: "definitely-not-muse-xyz",
        }),
      ).toThrow(/no está disponible/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("steer declara que el motor es one-shot", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse-steer-"));
    try {
      const input = await makeInput(root);
      const handle = createMuseWorkerHandle({
        input,
        prompt: "encargo",
        command: process.execPath,
        commandPrefix: [FIXTURE],
      });
      await expect(
        handle.steer({ message: "cambia de rumbo", requiresAnswer: false }),
      ).rejects.toThrow(/one-shot/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("la fábrica real compone la capa de Auton, el encargo y las instrucciones, y el motor lo recibe", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse-factory-"));
    try {
      const marker = "REGLA-DE-PRUEBA-DEL-PROYECTO";
      const parent = createTestAgentRuntime(
        createSessionId("auton-muse-factory"),
        {
          mode: "build",
          autonWorkerMode: "session",
          workingDirectory: root,
          workspacePath: root,
          userInstructions: {
            filePath: "/proyecto/AGENTS.md",
            fileName: "AGENTS.md",
            content: marker,
            bytesRead: marker.length,
            sizeBytes: marker.length,
            truncated: false,
          },
        },
        {
          eventStore: createTestSessionEventStore(),
          modelAdapter: {
            async generateText(): Promise<never> {
              throw new Error("el modelo no debe ejecutarse en esta prueba");
            },
          } as never,
        },
      );

      const input = await makeInput(root, {
        mode: "read",
        effort: "minimal",
        thinkingLevel: "high",
      });
      const prompt = buildMuseWorkerPrompt(parent as never, input);

      for (const expected of [
        "Eres un programmer de Auton",
        "ORQUESTADOR",
        "MODO DE TRABAJO: read",
        "POLÍTICA DE ESFUERZO: minimal",
        "CANAL RÁPIDO CON EL ORQUESTADOR",
        "REPORTE",
        "## ENCARGO",
        "haz el encargo",
        "## INSTRUCCIONES DEL PROYECTO",
        marker,
      ]) {
        expect(prompt).toContain(expected);
      }

      const handle = createMuseWorkerHandle({
        input,
        prompt,
        command: process.execPath,
        commandPrefix: [FIXTURE],
      });
      const result = await handle.run();
      expect(result.response).toContain("STATUS: DONE");

      const progress = await readFile(
        join(input.placement.workingDirectory, ".auton", "muse-progress.jsonl"),
        "utf8",
      );
      const event = probeEvent(progress.split("\n"));
      expect(event?.payload?.prompt).toContain("Eres un programmer de Auton");
      expect(event?.payload?.prompt).toContain("MODO DE TRABAJO: read");
      expect(event?.payload?.prompt).toContain("## ENCARGO");
      expect(event?.payload?.prompt).toContain(marker);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});

const runRealMuse = process.env.AUTON_MUSE_E2E === "1";

describe.runIf(runRealMuse)("Muse Code real (opt-in con AUTON_MUSE_E2E=1)", () => {
  it("lanza headless con el proveedor echo, dos veces y consistente", async () => {
    for (const round of [1, 2]) {
      const root = await mkdtemp(join(tmpdir(), `muse-real-echo-${round}-`));
      try {
        const input = await makeInput(root);
        const handle = createMuseWorkerHandle({
          input,
          prompt: "Responde exactamente: HOLA-MUSE",
          provider: "echo",
        });
        const result = await handle.run();
        expect(result.response).toContain("echo:");
        expect(result.response).toContain("HOLA-MUSE");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  }, 120_000);

  it("lanza headless en una carpeta con espacio y & (quoting de Windows)", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse real & echo-"));
    try {
      const input = await makeInput(root);
      const handle = createMuseWorkerHandle({
        input,
        prompt: "Responde exactamente: HOLA-MUSE",
        provider: "echo",
      });
      const result = await handle.run();
      expect(result.response).toContain("echo:");
      expect(result.response).toContain("HOLA-MUSE");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 120_000);

  it("el puerto real de sesión usa el motor Muse y entrega la capa de Auton al motor", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse-real-port-"));
    const previousProvider = process.env.AUTON_MUSE_PROVIDER;
    process.env.AUTON_MUSE_PROVIDER = "echo";
    try {
      const parent = createTestAgentRuntime(
        createSessionId("auton-muse-real-port"),
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
              throw new Error("el modelo de ZCode no debe usarse con Muse");
            },
          } as never,
        },
      );
      const port = (
        parent as unknown as {
          autonSessionWorkerPort: {
            launch(request: unknown): Promise<{ agentId: string }>;
            getTask(id: string): Promise<
              { status: string; outputFile?: string; waitingForAnswer?: boolean } | undefined
            >;
          };
        }
      ).autonSessionWorkerPort;
      expect(port).toBeTruthy();

      const launched = await port.launch({
        sessionId: parent.sessionId,
        parentToolCallId: "tool_muse_real",
        agentType: "auton-worker",
        description: "encargo muse real",
        prompt: "Di hola",
        engine: "muse",
        mode: "read",
        workingDirectory: root,
        workspaceRoot: root,
        trace: { traceId: "trace-muse-real", sessionId: parent.sessionId } as never,
        runInBackground: true,
      });

      let task = await port.getTask(launched.agentId);
      for (let attempt = 0; attempt < 120 && task?.status !== "completed"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        task = await port.getTask(launched.agentId);
      }
      expect(task?.status).toBe("completed");
      expect(task?.outputFile).toBeTruthy();
      const output = await readFile(task!.outputFile!, "utf8");
      expect(output).toContain("echo:");
      expect(output).toContain("MODO DE TRABAJO: read");
      expect(output).toContain("## ENCARGO");
      expect(output).toContain("Di hola");
    } finally {
      if (previousProvider === undefined) delete process.env.AUTON_MUSE_PROVIDER;
      else process.env.AUTON_MUSE_PROVIDER = previousProvider;
      await rm(root, { recursive: true, force: true });
    }
  }, 180_000);

  it("lanza headless con el proveedor meta y devuelve texto", async () => {
    const root = await mkdtemp(join(tmpdir(), "muse-real-meta-"));
    try {
      const input = await makeInput(root);
      const handle = createMuseWorkerHandle({
        input,
        prompt:
          "No uses herramientas. Cierra exactamente con este bloque:\n" +
          "REPORTE\nSTATUS: DONE\nARCHIVOS: ninguno\nEVIDENCIA: ninguna\nDUDAS: ninguna",
        maxModelSteps: 2,
      });
      const result = await handle.run();
      expect(result.response.trim().length).toBeGreaterThan(0);
      expect(parseWorkerReporte(result.response)).toBe("DONE");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 180_000);
});
