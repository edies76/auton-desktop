// ============================================================
// Auton project space — proyección del estado real de la sesión
// ============================================================
// No inventa datos: toma las filas de conversación que ya produce el runtime
// (mensajes del orquestador, entradas del humano, subagentes, tool calls) y las
// proyecta al modelo de la superficie. Es puro para poder probarlo sin Electron.

import type {
  AssistantTextRow,
  ConversationRow,
  SubagentRow,
  ToolCallRow,
  UserInputRow,
} from "@zcode/shared/zcode-protocol-v4";
import {
  emptySpaceData,
  type AutonEvidence,
  type AutonPlanItemView,
  type AutonPlanView,
  type AutonProjectSpaceData,
  type AutonThreadMessage,
  type AutonWorkTramo,
  type AutonWorkerView,
  type AutonWorkerStatus,
} from "./model.js";

export interface AutonConversationSource {
  rows: readonly ConversationRow[];
  /** Reloj inyectable; solo se usa para el silencio. */
  now?: number;
}

const MAX_MESSAGES = 40;

function timeOf(value: string | number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function recordOf(row: ToolCallRow): Record<string, unknown> {
  if (row.input && typeof row.input === "object" && !Array.isArray(row.input)) {
    return row.input as Record<string, unknown>;
  }
  try {
    const parsed: unknown = JSON.parse(row.inputText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function orderedRows(rows: readonly ConversationRow[]): ConversationRow[] {
  return [...rows].sort((left, right) => {
    if (left.createdAtSeq !== right.createdAtSeq) return left.createdAtSeq - right.createdAtSeq;
    return timeOf(left.createdAt, 0) - timeOf(right.createdAt, 0);
  });
}

/** Mensajes del hilo: el humano escribe, el orquestador narra. */
export function projectAutonMessages(rows: readonly ConversationRow[]): AutonThreadMessage[] {
  const messages: AutonThreadMessage[] = [];
  for (const row of orderedRows(rows)) {
    if (row.kind === "userInput") {
      const user = row as UserInputRow;
      if (user.origin && user.origin !== "realUser") continue;
      if (!user.text.trim()) continue;
      messages.push({
        id: `human-${user.rowId}`,
        at: timeOf(user.createdAt, 0),
        role: "human",
        text: user.text,
      });
      continue;
    }
    if (row.kind === "assistantText") {
      const assistant = row as AssistantTextRow;
      if (!assistant.text.trim()) continue;
      messages.push({
        id: `orchestrator-${assistant.rowId}`,
        at: timeOf(assistant.createdAt, 0),
        role: "orchestrator",
        text: assistant.text,
      });
    }
  }
  return messages.slice(-MAX_MESSAGES);
}

function subagentStatus(row: SubagentRow): AutonWorkerStatus {
  if (row.status === "success") return "terminado";
  if (row.status === "failed" || row.status === "cancelled") return "bloqueado";
  const summary = row.summaryText.trim();
  if (summary.endsWith("?") || /pregunt|question/iu.test(summary)) return "preguntando";
  if (/esper|waiting|blocked/iu.test(summary)) return "esperando";
  return "trabajando";
}

function subagentSessionId(row: SubagentRow): string {
  // Un `auton-worker` siempre vive en el namespace propio; una fila antigua
  // pudo guardar el prefijo `subagent_` antes de la migración.
  if (row.subagentType === "auton-worker" && row.entityId) {
    return `sess_auton_${row.entityId}`;
  }
  if (row.childSessionId) return row.childSessionId;
  if (row.entityId) {
    return `sess_${row.subagentType === "auton-worker" ? "auton" : "subagent"}_${row.entityId}`;
  }
  return `worker-${row.rowId}`;
}

function toolDescription(
  rows: readonly ConversationRow[],
  parentToolCallId: string | undefined,
): string | undefined {
  if (!parentToolCallId) return undefined;
  const tool = rows.find(
    (row): row is ToolCallRow => row.kind === "toolCall" && row.toolCallId === parentToolCallId,
  );
  if (!tool) return undefined;
  const input = recordOf(tool);
  return (
    stringField(input, "description") ??
    stringField(input, "prompt")?.split("\n")[0]?.trim() ??
    undefined
  );
}

function workerName(
  row: SubagentRow,
  index: number,
  rows: readonly ConversationRow[],
): string {
  const description = toolDescription(rows, row.parentToolCallId);
  const summaryLine = row.summaryText.trim().split("\n")[0]?.trim();
  if (row.subagentType === "auton-worker") {
    const title = (row as SubagentRow & { title?: string }).title?.trim();
    return title || description || summaryLine || `worker ${index + 1}`;
  }
  if (row.subagentType.startsWith("auton-")) {
    return description || summaryLine || `worker ${index + 1}`;
  }
  return description || summaryLine || `${row.subagentType || "worker"} ${index + 1}`;
}

/** `auton-worker` es el agente completo de ZCode; el resto son subagentes. */
function workerKind(row: SubagentRow): "agent" | "subagent" {
  return row.subagentType === "auton-worker" ? "agent" : "subagent";
}

/**
 * Workers reales: una fila `subagent` del runtime por worker. El estado sale de
 * la fila; el silencio se calcula después con su última señal.
 */
export function projectAutonWorkers(
  rows: readonly ConversationRow[],
  now = Date.now(),
): AutonWorkerView[] {
  const subagents = orderedRows(rows).filter((row): row is SubagentRow => row.kind === "subagent");
  return subagents.map((row, index) => {
    const startedAt = timeOf(row.startedAt ?? row.createdAt, now);
    const endedAt = row.endedAt ? timeOf(row.endedAt, startedAt) : undefined;
    const lastActivityAt = row.lastActivityAt
      ? timeOf(row.lastActivityAt, startedAt)
      : startedAt;
    const status = subagentStatus(row);
    const summary = row.summaryText.trim();
    return {
      id: subagentSessionId(row),
      name: workerName(row, index, rows),
      status,
      startedAt,
      lastSignalAt: endedAt ?? lastActivityAt,
      kind: workerKind(row),
      engine: "zcode" as const,
      ...(summary ? { lastLine: summary } : {}),
      transcript: [
        ...(summary
          ? [{ id: `${row.rowId}-summary`, at: startedAt, kind: "message" as const, text: summary }]
          : []),
        ...(endedAt
          ? [
              {
                id: `${row.rowId}-close`,
                at: endedAt,
                kind: "close" as const,
                text:
                  status === "terminado"
                    ? "Terminado."
                    : status === "bloqueado"
                      ? "Bloqueado con motivo."
                      : "Cerrado.",
              },
            ]
          : []),
      ],
    };
  });
}

/** Un tramo de trabajo agrupa los subagentes del mismo encargo o turno. */
export function projectAutonTramos(rows: readonly ConversationRow[]): AutonWorkTramo[] {
  const subagents = orderedRows(rows).filter((row): row is SubagentRow => row.kind === "subagent");
  const groups = new Map<string, SubagentRow[]>();
  for (const row of subagents) {
    const key = row.parentToolCallId ?? row.turnId;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()].slice(-3).map(([key, group]) => {
    const starts = group.map((row) => timeOf(row.startedAt ?? row.createdAt, 0));
    const ended = group.every((row) => Boolean(row.endedAt));
    return {
      id: `tramo-${key}`,
      startedAt: Math.min(...starts),
      ...(ended ? { endedAt: Math.max(...group.map((row) => timeOf(row.endedAt, 0))) } : {}),
      workerIds: group.map((row) => row.childSessionId ?? `worker-${row.rowId}`),
    };
  });
}

function planItems(record: Record<string, unknown>): AutonPlanItemView[] {
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items: AutonPlanItemView[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = stringField(item, "id");
    const title = stringField(item, "title");
    const status = stringField(item, "status");
    if (!id || !title || !status) continue;
    const owner = stringField(item, "owner");
    items.push({ id, title, status, ...(owner ? { owner } : {}) });
  }
  return items;
}

/** El plan sale del último AutonPlan que el orquestador escribió. */
export function projectAutonPlan(rows: readonly ConversationRow[]): AutonPlanView | undefined {
  const planRows = orderedRows(rows).filter(
    (row): row is ToolCallRow =>
      row.kind === "toolCall" && row.toolName === "AutonPlan" && row.status === "success",
  );
  const last = planRows.at(-1);
  if (!last) return undefined;
  const input = recordOf(last);
  const goal = input.goal && typeof input.goal === "object" ? (input.goal as Record<string, unknown>) : {};
  const items = planItems(input);
  if (items.length === 0) return undefined;
  const goalTitle = stringField(goal, "title");
  return { ...(goalTitle ? { goalTitle } : {}), items };
}

/** La evidencia sale del último comando con salida y de los archivos tocados. */
export function projectAutonEvidence(rows: readonly ConversationRow[]): AutonEvidence | undefined {
  const ordered = orderedRows(rows);
  const toolRows = ordered.filter((row): row is ToolCallRow => row.kind === "toolCall");
  const withCommand = toolRows.filter((row) => {
    const input = recordOf(row);
    return Boolean(stringField(input, "command")) && Boolean(row.output?.text);
  });
  const last = withCommand.at(-1);
  if (!last) return undefined;

  const command = stringField(recordOf(last), "command") ?? last.toolName;
  const files = new Set<string>();
  for (const row of toolRows) {
    if (row.status !== "success") continue;
    const input = recordOf(row);
    for (const key of ["file_path", "path", "filePath"]) {
      const value = stringField(input, key);
      if (value) files.add(value);
    }
    if (Array.isArray(input.files)) {
      for (const value of input.files) {
        if (typeof value === "string" && value.trim()) files.add(value);
      }
    }
  }

  return {
    id: `evidence-${last.rowId}`,
    command,
    output: last.output?.text ?? "",
    files: [...files].slice(-6),
  };
}

/**
 * Proyección completa: de la conversación real del orquestador al espacio del
 * proyecto. Sin filas, devuelve un espacio vacío (no datos de demostración).
 */
export function projectAutonSpace(source: AutonConversationSource): AutonProjectSpaceData {
  const rows = source.rows;
  if (rows.length === 0) return emptySpaceData();
  const now = source.now ?? Date.now();
  const messages = projectAutonMessages(rows);
  const workers = projectAutonWorkers(rows, now);
  const tramos = projectAutonTramos(rows);
  const plan = projectAutonPlan(rows);
  const evidence = projectAutonEvidence(rows);
  return {
    messages,
    workers,
    tramos,
    ...(plan ? { plan } : {}),
    ...(evidence ? { evidence } : {}),
  };
}
