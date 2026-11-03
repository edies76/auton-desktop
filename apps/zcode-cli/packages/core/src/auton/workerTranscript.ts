// ============================================================
// Transcripción del worker — un contrato para los dos motores
// ============================================================
// El panel del worker pinta filas de mensaje, herramienta, pregunta y cierre.
// Muse llega por items MSP; ZCode por eventos de sesión. Los dos se normalizan
// aquí para que la UI no sepa de qué motor viene la conversación.

import type { MessageWithParts, SessionEvent } from "@zcode/contracts";
import type { MuseMspItem, MuseMspTurn } from "./museMspClient.js";

export type WorkerTranscriptKind = "message" | "tool" | "question" | "close";

export interface WorkerTranscriptEntry {
  id: string;
  at: number;
  kind: WorkerTranscriptKind;
  role?: "worker" | "orchestrator";
  text: string;
  status?: string;
}

export function transcriptFromMuseTurns(
  turns: readonly MuseMspTurn[],
  now: number = Date.now(),
): WorkerTranscriptEntry[] {
  const entries: WorkerTranscriptEntry[] = [];
  let order = 0;
  const push = (entry: Omit<WorkerTranscriptEntry, "id" | "at">): void => {
    entries.push({ ...entry, id: `muse-${order}`, at: now + order });
    order += 1;
  };

  for (const turn of turns) {
    if (turn.userText) {
      push({ kind: "message", role: "orchestrator", text: turn.userText });
    }
    for (const item of turn.items) {
      const mapped = transcriptFromMuseItem(item);
      if (mapped) push(mapped);
    }
    if (turn.terminal) {
      push({
        kind: "close",
        text:
          turn.terminal === "completed"
            ? (turn.reason ?? "Turno completado.")
            : (turn.reason ?? `turno ${turn.terminal}`),
        status: turn.terminal,
      });
    }
  }
  return entries;
}

function transcriptFromMuseItem(
  item: MuseMspItem,
): Omit<WorkerTranscriptEntry, "id" | "at"> | undefined {
  if (item.kind === "userMessage") return undefined;
  if (item.kind === "agentMessage") {
    const text = item.text ?? item.displayText ?? "";
    return text ? { kind: "message", role: "worker", text } : undefined;
  }
  if (item.kind === "toolCall" || item.kind === "subagent" || item.kind === "workflow") {
    return {
      kind: "tool",
      text:
        item.statusLine ??
        item.summary ??
        item.fallbackText ??
        item.visibleOutput ??
        item.kind,
      status: item.status,
    };
  }
  if (item.kind === "reasoning") return undefined;
  return undefined;
}

const TEXT_KEYS = ["text", "message", "summary", "content", "delta"] as const;

function eventText(payload: unknown): string | undefined {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  for (const key of TEXT_KEYS) {
    if (typeof record[key] === "string" && record[key].length > 0) {
      return record[key] as string;
    }
  }
  if (Array.isArray(record.content)) {
    const text = record.content
      .map((part) =>
        part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : "",
      )
      .join("");
    if (text) return text;
  }
  return undefined;
}

function lastUserText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.prompt === "string" && record.prompt.length > 0) return record.prompt;
  if (!Array.isArray(record.messages)) return undefined;
  for (let index = record.messages.length - 1; index >= 0; index -= 1) {
    const message = record.messages[index];
    if (!message || typeof message !== "object") continue;
    const entry = message as Record<string, unknown>;
    if (entry.role !== "user") continue;
    if (typeof entry.content === "string") return entry.content;
    if (Array.isArray(entry.content)) {
      const text = entry.content
        .map((part) =>
          part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
            ? (part as { text: string }).text
            : "",
        )
        .join("");
      if (text) return text;
    }
  }
  return undefined;
}

export function transcriptFromSessionEvents(
  events: readonly SessionEvent[],
): WorkerTranscriptEntry[] {
  const entries: WorkerTranscriptEntry[] = [];
  let lastUser = "";
  for (const event of events) {
    const type = String(event.type);
    const text = eventText(event.payload);
    const id = `${type}-${event.sequenceNumber}`;
    const at = event.timestamp instanceof Date ? event.timestamp.getTime() : Date.now();
    if (type === "user_message" && text) {
      entries.push({ id, at, kind: "message", role: "orchestrator", text });
      lastUser = text;
      continue;
    }
    if (type === "model_request") {
      const prompt = lastUserText(event.payload);
      if (prompt && prompt !== lastUser) {
        entries.push({ id, at, kind: "message", role: "orchestrator", text: prompt });
        lastUser = prompt;
      }
      continue;
    }
    if (type === "assistant_message" && text) {
      entries.push({ id, at, kind: "message", role: "worker", text });
      continue;
    }
    if (type === "model_complete" && text) {
      entries.push({ id, at, kind: "message", role: "worker", text });
      continue;
    }
    if (type === "tool_call_started" || type === "tool_call_result" || type === "tool_call_error") {
      entries.push({
        id,
        at,
        kind: "tool",
        text: text ?? type.replaceAll("_", " "),
        status: type === "tool_call_error" ? "failed" : "completed",
      });
      continue;
    }
    if (type === "turn_error") {
      entries.push({ id, at, kind: "close", text: text ?? "turno fallido", status: "failed" });
    }
  }
  return entries;
}

/** La fuente durable del transcript de ZCode: los mensajes de su sesión. */
export function transcriptFromSessionMessages(
  messages: readonly MessageWithParts[],
): WorkerTranscriptEntry[] {
  const entries: WorkerTranscriptEntry[] = [];
  for (const message of messages) {
    const info = message.info;
    const at = info.time?.created ?? Date.now();
    const text = message.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => (part as { text: string }).text)
      .join("")
      .trim();
    if (text) {
      entries.push({
        id: info.id,
        at,
        kind: "message",
        role: info.role === "user" ? "orchestrator" : "worker",
        text,
      });
    }
    for (const part of message.parts) {
      if (part.type !== "tool") continue;
      const state = part.state as { status?: string } | undefined;
      entries.push({
        id: part.id,
        at,
        kind: "tool",
        text: part.tool,
        ...(state?.status ? { status: state.status } : {}),
      });
    }
  }
  return entries;
}
