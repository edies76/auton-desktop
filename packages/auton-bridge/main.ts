import { homedir } from "node:os";
import { Console } from "node:console";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import {
  createServerHostServices,
  disposeServiceResourcesAndWait,
  getAppConfigDir,
  materializeZCodeBuiltinProviderConfig,
} from "@zcode/services/node";
import { IZCodeAgentService as AgentServiceToken, type ServiceCollection, type IZCodeAgentService } from "@zcode/services";

interface Request {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}
interface SessionRef { workspacePath: string; sessionId: string; sequence: number }

process.env.AUTON_DATA_DIR_NAME ??= ".auton";
process.env.AUTON_STORAGE_DIR ??= join(homedir(), ".auton");
const stderrConsole = new Console({ stdout: process.stderr, stderr: process.stderr });
Object.assign(console, {
  log: stderrConsole.log.bind(stderrConsole),
  info: stderrConsole.info.bind(stderrConsole),
  debug: stderrConsole.debug.bind(stderrConsole),
  warn: stderrConsole.warn.bind(stderrConsole),
  error: stderrConsole.error.bind(stderrConsole),
});

let services: ServiceCollection | undefined;
let agent: IZCodeAgentService | undefined;
const sessions = new Map<string, SessionRef>();
let initialized: Promise<void> | undefined;

function reply(id: number, method: string, result?: unknown, error?: string): void {
  process.stdout.write(`${JSON.stringify({ id, method, ok: !error, ...(result === undefined ? {} : { result }), ...(error ? { error } : {}) })}\n`);
}
function notify(event: string, payload: unknown): void {
  process.stdout.write(`${JSON.stringify({ event, payload })}\n`);
}
function field<T>(params: Record<string, unknown>, name: string): T {
  const value = params[name];
  if (value === undefined || value === null) throw new Error(`Missing parameter: ${name}`);
  return value as T;
}
async function ensureServices(): Promise<void> {
  if (initialized) return initialized;
  initialized = (async () => {
    const repoRoot = process.env.AUTON_REPO_ROOT?.trim() || process.cwd();
    const providerConfig = process.env.AUTON_BUILTIN_PROVIDER_CONFIG_FILE?.trim() || resolve(repoRoot, "config/provider/zcode-builtin.json");
    const configText = await readFile(providerConfig, "utf8");
    const providerConfigPath = await materializeZCodeBuiltinProviderConfig({ environmentConfigRoot: getAppConfigDir(), content: configText });
    const host = await createServerHostServices({ sourceServerId: "auton-native-local", zcodeBuiltinProviderConfigFilePath: providerConfigPath });
    services = host.services;
    agent = services.get(AgentServiceToken);
  })();
  return initialized;
}

async function handle(request: Request): Promise<void> {
  const params = request.params ?? {};
  try {
    if (request.method === "runtime.status") {
      await ensureServices();
      const workspacePath = field<string>(params, "workspacePath");
      const ready = await agent!.initialize({ workspacePath });
      reply(request.id, request.method, { ready: ready.available, reason: ready.reason ?? null });
      return;
    }
    if (request.method === "session.create") {
      await ensureServices();
      const workspacePath = field<string>(params, "workspacePath");
      const ready = await agent!.initialize({ workspacePath });
      if (!ready.available) throw new Error(ready.reason || "Agent runtime unavailable; configure a provider first");
      const snapshot = await agent!.createSession({ workspacePath, persistence: "immediate" });
      const sessionId = snapshot.session.sessionId;
      sessions.set(sessionId, { workspacePath, sessionId, sequence: 0 });
      reply(request.id, request.method, { sessionId, workspacePath });
      return;
    }
    if (request.method === "session.send") {
      await ensureServices();
      const session = sessions.get(field<string>(params, "sessionId"));
      if (!session) throw new Error("Unknown session; create or resume the session first");
      const content = field<string>(params, "content");
      reply(request.id, request.method, { accepted: true, sessionId: session.sessionId });
      void agent!.sendPrompt({ workspacePath: session.workspacePath, sessionId: session.sessionId, content, clientMode: "desktop-continuous" }).then(
        (result) => notify("turn.completed", { sessionId: session.sessionId, result }),
        (error: unknown) => notify("turn.failed", { sessionId: session.sessionId, error: error instanceof Error ? error.message : String(error) }),
      );
      return;
    }
    if (request.method === "session.events") {
      await ensureServices();
      const session = sessions.get(field<string>(params, "sessionId"));
      if (!session) throw new Error("Unknown session");
      const events = await agent!.readSessionEvents({ workspacePath: session.workspacePath, sessionId: session.sessionId, afterSeq: session.sequence, limit: 200 });
      if (events.length > 0) {
        session.sequence = Math.max(session.sequence, ...events.map((event) => Number(event.seq ?? 0)));
      }
      reply(request.id, request.method, events);
      return;
    }
    if (request.method === "session.resume") {
      await ensureServices();
      const workspacePath = field<string>(params, "workspacePath");
      const sessionId = field<string>(params, "sessionId");
      const snapshot = await agent!.resumeSession({ workspacePath, sessionId });
      sessions.set(sessionId, { workspacePath, sessionId, sequence: 0 });
      reply(request.id, request.method, { sessionId: snapshot.session.sessionId, workspacePath });
      return;
    }
    if (request.method === "runtime.shutdown") {
      reply(request.id, request.method, { stopping: true });
      input.close();
      return;
    }
    throw new Error(`Unsupported bridge method: ${request.method}`);
  } catch (error) {
    reply(request.id, request.method, undefined, error instanceof Error ? error.message : String(error));
  }
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
const pendingHandlers = new Set<Promise<void>>();
for await (const line of input) {
  if (!line.trim()) continue;
  let request: Request;
  try { request = JSON.parse(line) as Request; }
  catch (error) { notify("protocol.error", { error: error instanceof Error ? error.message : String(error) }); continue; }
  const task = handle(request);
  pendingHandlers.add(task);
  void task.then(() => pendingHandlers.delete(task), () => pendingHandlers.delete(task));
}
await Promise.allSettled(pendingHandlers);
if (services) await disposeServiceResourcesAndWait(services);
