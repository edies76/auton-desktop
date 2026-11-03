// ============================================================
// Cliente MSP de Muse Code — la sesión conversacional
// ============================================================
// `muse serve` habla JSON-RPC 2.0 por líneas sobre stdio. Handshake:
// initialize → initialized → session/start. Después: turn/start y turn/steer
// sobre la MISMA sesión, con notificaciones item/* (deltas) y turn/completed.
// Este cliente es el transporte; la política de worker vive en el adaptador.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import {
  buildMuseSpawnSpec,
  museCommand,
  museModeArgs,
} from "./workerEngine.js";
import { uuidv7 } from "./uuid7.js";

export interface MuseMspItem {
  itemId: string;
  kind: string;
  status: string;
  text?: string;
  turnId?: string;
  summary?: string;
  statusLine?: string;
  fallbackText?: string;
  displayText?: string;
  visibleOutput?: string;
}

export interface MuseMspTurn {
  turnId: string;
  terminal?: string;
  reason?: string;
  userText: string;
  assistantText: string;
  items: MuseMspItem[];
}

export interface MuseMspNotification {
  method: string;
  params: Record<string, unknown>;
}

export interface MuseMspClientOptions {
  workspace: string;
  command?: string;
  commandPrefix?: readonly string[];
  env?: NodeJS.ProcessEnv;
  provider?: string;
  model?: string;
  mode?: unknown;
  requestTimeoutMs?: number;
  onEvent?: (event: MuseMspNotification) => void;
}

interface PendingRequest {
  resolve: (result: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class MuseMspClient {
  private readonly options: MuseMspClientOptions;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly turns = new Map<string, MuseMspTurn>();
  private readonly turnOrder: string[] = [];
  private readonly waiters = new Map<string, Array<() => void>>();
  private child?: ChildProcess;
  private nextId = 1;
  private stdoutBuffer = "";
  private stderr = "";
  private closed = false;
  private started = false;
  sessionId?: string;
  activeTurnId?: string;

  constructor(options: MuseMspClientOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const env = this.options.env ?? process.env;
    const command = this.options.command ?? museCommand(env);
    const prefix = [...(this.options.commandPrefix ?? [])];
    const args = [
      "serve",
      ...(this.options.provider ? ["--provider", this.options.provider] : []),
      ...(this.options.model ? ["--model", this.options.model] : []),
      "--disable-request-user-input",
      ...museModeArgs(this.options.mode),
    ];
    const spec = buildMuseSpawnSpec(command, [...prefix, ...args], env);
    const child = spawn(spec.command, spec.args, {
      cwd: this.options.workspace,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      ...(spec.windowsVerbatimArguments
        ? { windowsVerbatimArguments: spec.windowsVerbatimArguments }
        : {}),
    });
    this.child = child;
    if (!child.stdout || !child.stderr || !child.stdin) {
      throw new Error("Muse serve no expuso stdin/stdout/stderr.");
    }
    child.stderr.on("data", (chunk: Buffer) => {
      this.stderr = `${this.stderr}${chunk.toString("utf8")}`.slice(-8_192);
    });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => this.handleLine(line));
    child.once("error", (error) => {
      this.closed = true;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(
          new Error(
            `No se pudo arrancar Muse serve (${spec.command}): ${error.message}`,
          ),
        );
      }
      this.pending.clear();
    });
    child.once("close", (code) => {
      this.closed = true;
      const error = new Error(
        `Muse serve terminó (exit ${code ?? "?"}). ${this.stderr.trim().slice(0, 400)}`,
      );
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
    });

    await this.request("initialize", {
      clientInfo: { name: "auton_worker", title: "Auton worker", version: "0.1.0" },
    });
    this.notify("initialized", {});
    const session = await this.request("session/start", {
      commandId: uuidv7(),
      workspaceRoot: this.options.workspace,
      approvalMode: "allowAll",
    });
    const record = session.session as Record<string, unknown> | undefined;
    this.sessionId =
      typeof record?.sessionId === "string" ? record.sessionId : undefined;
    if (!this.sessionId) {
      throw new Error("Muse serve no devolvió un sessionId al abrir la sesión.");
    }
  }

  async startTurn(text: string): Promise<{ turnId: string; disposition: string }> {
    this.requireSession();
    const result = await this.request("turn/start", {
      commandId: uuidv7(),
      sessionId: this.sessionId,
      ifBusy: "steer",
      input: [{ type: "text", text }],
    });
    const turnId = String(result.turnId);
    this.ensureTurn(turnId);
    return { turnId, disposition: String(result.disposition ?? "started") };
  }

  async steer(text: string): Promise<{ turnId: string; disposition: string }> {
    this.requireSession();
    if (!this.activeTurnId) return this.startTurn(text);
    const result = await this.request("turn/steer", {
      commandId: uuidv7(),
      sessionId: this.sessionId,
      expectedTurnId: this.activeTurnId,
      input: [{ type: "text", text }],
    });
    const turnId = String(result.turnId ?? this.activeTurnId);
    this.ensureTurn(turnId);
    return { turnId, disposition: String(result.disposition ?? "steered") };
  }

  async waitForTurn(turnId: string): Promise<MuseMspTurn> {
    const turn = this.turns.get(turnId);
    if (turn?.terminal) return turn;
    await new Promise<void>((resolve) => {
      const list = this.waiters.get(turnId) ?? [];
      list.push(resolve);
      this.waiters.set(turnId, list);
    });
    return this.turns.get(turnId)!;
  }

  async waitForIdle(): Promise<void> {
    const active = this.activeTurnId;
    if (!active) return;
    await this.waitForTurn(active);
  }

  async interrupt(): Promise<void> {
    if (!this.sessionId || !this.activeTurnId) return;
    try {
      await this.request("turn/interrupt", {
        commandId: uuidv7(),
        sessionId: this.sessionId,
        turnId: this.activeTurnId,
      });
    } catch {
      // El cierre del proceso es el respaldo.
    }
  }

  conversation(): readonly MuseMspTurn[] {
    return this.turnOrder
      .map((id) => this.turns.get(id))
      .filter((turn): turn is MuseMspTurn => turn !== undefined);
  }

  close(): void {
    this.closed = true;
    if (this.child && this.child.exitCode === null && this.child.pid) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(this.child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } else {
        this.child.kill("SIGTERM");
      }
    }
  }

  private requireSession(): void {
    if (!this.sessionId) throw new Error("Muse serve no tiene sesión abierta.");
  }

  private ensureTurn(turnId: string): MuseMspTurn {
    const existing = this.turns.get(turnId);
    if (existing) return existing;
    const turn: MuseMspTurn = {
      turnId,
      userText: "",
      assistantText: "",
      items: [],
    };
    this.turns.set(turnId, turn);
    this.turnOrder.push(turnId);
    return turn;
  }

  private request(
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.closed) {
      return Promise.reject(new Error("Muse serve está cerrado."));
    }
    const id = this.nextId;
    this.nextId += 1;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Muse serve no respondió a ${method} (timeout).`));
      }, this.options.requestTimeoutMs ?? 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  private notify(method: string, params: Record<string, unknown>): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  private write(frame: Record<string, unknown>): void {
    if (!this.child?.stdin?.writable) {
      throw new Error("Muse serve no tiene stdin abierto.");
    }
    this.child.stdin.write(`${JSON.stringify(frame)}\n`);
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return;
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return;
    }
    const id = typeof frame.id === "number" ? frame.id : undefined;
    if (id !== undefined && (frame.result !== undefined || frame.error !== undefined)) {
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      clearTimeout(pending.timer);
      if (frame.error) {
        const error = frame.error as Record<string, unknown>;
        pending.reject(
          new Error(
            `Muse serve ${String(error.message ?? "error")}${error.data ? `: ${JSON.stringify(error.data)}` : ""}`,
          ),
        );
      } else {
        pending.resolve((frame.result ?? {}) as Record<string, unknown>);
      }
      return;
    }
    if (typeof frame.method === "string") {
      const params = (frame.params ?? {}) as Record<string, unknown>;
      this.options.onEvent?.({ method: frame.method, params });
      this.handleNotification(frame.method, params);
    }
  }

  private handleNotification(method: string, params: Record<string, unknown>): void {
    if (method === "turn/started") {
      const turnId = String(params.turnId ?? "");
      if (turnId) {
        this.activeTurnId = turnId;
        this.ensureTurn(turnId);
      }
      return;
    }
    if (method === "item/started" || method === "item/updated" || method === "item/completed") {
      const item = params.item as Record<string, unknown> | undefined;
      if (!item) return;
      this.storeItem(item);
      return;
    }
    if (method === "item/delta") {
      const itemId = String(params.itemId ?? "");
      const delta = typeof params.delta === "string" ? params.delta : "";
      if (!itemId || !delta) return;
      const field = typeof params.field === "string" ? params.field : "text";
      const turnId = this.activeTurnId;
      if (!turnId) return;
      const turn = this.ensureTurn(turnId);
      let item = turn.items.find((entry) => entry.itemId === itemId);
      if (!item) {
        item = { itemId, kind: "unknown", status: "inProgress", turnId };
        turn.items.push(item);
      }
      if (field === "text") {
        item.text = `${item.text ?? ""}${delta}`;
      }
      return;
    }
    if (method === "turn/completed") {
      const turnId = String(params.turnId ?? "");
      if (!turnId) return;
      const turn = this.ensureTurn(turnId);
      turn.terminal = String(params.terminal ?? "completed");
      if (typeof params.reason === "string") turn.reason = params.reason;
      if (this.activeTurnId === turnId) this.activeTurnId = undefined;
      const list = this.waiters.get(turnId) ?? [];
      this.waiters.delete(turnId);
      for (const resolve of list) resolve();
    }
  }

  private storeItem(raw: Record<string, unknown>): void {
    const itemId = String(raw.itemId ?? "");
    if (!itemId) return;
    const turnId = typeof raw.turnId === "string" ? raw.turnId : this.activeTurnId;
    if (!turnId) return;
    const turn = this.ensureTurn(turnId);
    const item: MuseMspItem = {
      itemId,
      kind: String(raw.kind ?? "unknown"),
      status: String(raw.status ?? "inProgress"),
      ...(typeof raw.text === "string" ? { text: raw.text } : {}),
      ...(typeof raw.turnId === "string" ? { turnId: raw.turnId } : {}),
      ...(typeof raw.summary === "string" ? { summary: raw.summary } : {}),
      ...(typeof raw.statusLine === "string" ? { statusLine: raw.statusLine } : {}),
      ...(typeof raw.fallbackText === "string" ? { fallbackText: raw.fallbackText } : {}),
      ...(typeof raw.displayText === "string" ? { displayText: raw.displayText } : {}),
      ...(typeof raw.visibleOutput === "string" ? { visibleOutput: raw.visibleOutput } : {}),
    };
    const index = turn.items.findIndex((entry) => entry.itemId === itemId);
    if (index >= 0) turn.items[index] = item;
    else turn.items.push(item);

    const text = item.text ?? item.displayText ?? "";
    if (item.kind === "userMessage" && text) {
      turn.userText = text;
    }
    if (item.kind === "agentMessage" && text) {
      turn.assistantText = text;
    }
  }
}
