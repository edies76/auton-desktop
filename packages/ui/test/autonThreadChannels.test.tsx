import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SubagentRow, ToolCallRow } from "@zcode/shared/zcode-protocol-v4";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import type { ConversationAssistantWorkRenderItem } from "@/v4/conversationAssistantWorkItems.js";
import { buildAssistantWorkRenderItems } from "@/v4/conversationAssistantWorkItems.js";
import { ConversationAgentToolCallRow } from "@/v4/ConversationAgentToolCallRow.js";
import { wakeEventAction } from "@/v4/ConversationTurnGroup.js";
import { WakeEventItem } from "@/auton/WakeEventItem.js";
import type { ConversationRowRenderContext } from "@/v4/conversationRowContext.js";

const START = "2026-11-02T20:00:00.000Z";
const NOW = Date.parse("2026-11-02T20:05:00.000Z");
const HEARTBEAT_MS = 90_000;

type WakeItem = Extract<ConversationAssistantWorkRenderItem, { kind: "wakeEvent" }>;

function agentRow(rowId: number, toolCallId: string, status: ToolCallRow["status"]): ToolCallRow {
  return {
    kind: "toolCall",
    rowId,
    turnId: "turn_1",
    toolCallId,
    toolName: "Agent",
    status,
    inputText: "",
    input: { description: `Landing ${rowId}`, subagent_type: "auton-worker" },
  } as unknown as ToolCallRow;
}

function subagentRow(input: {
  rowId: number;
  parentToolCallId: string;
  status: SubagentRow["status"];
  endedAt?: string;
  lastActivityAt?: string;
  waitingForAnswer?: boolean;
  summaryText: string;
}): SubagentRow {
  return {
    kind: "subagent",
    rowId: input.rowId,
    turnId: "turn_1",
    parentToolCallId: input.parentToolCallId,
    childSessionId: `child_${input.rowId}`,
    subagentType: "auton-worker",
    status: input.status,
    summaryText: input.summaryText,
    startedAt: START,
    ...(input.endedAt ? { endedAt: input.endedAt } : {}),
    ...(input.lastActivityAt ? { lastActivityAt: input.lastActivityAt } : {}),
    ...(input.waitingForAnswer !== undefined
      ? { waitingForAnswer: input.waitingForAnswer }
      : {}),
  } as unknown as SubagentRow;
}

const context = {
  workspacePath: "/workspace",
  theme: {},
  codePreviewSettings: {},
  sessionId: "sess_ui",
  rootSessionId: "sess_ui",
  messageStreamShowTodos: false,
  onOpenSubagentSession: () => {},
} as unknown as ConversationRowRenderContext;

function build(rows: readonly never[], nowMs = NOW) {
  return buildAssistantWorkRenderItems(rows, "hidden", { nowMs, heartbeatMs: HEARTBEAT_MS });
}

function renderAgent(item: WakeItem | Extract<ConversationAssistantWorkRenderItem, { kind: "agentToolCall" }>): string {
  return renderToStaticMarkup(
    createElement(
      ZCodeIntlProvider,
      { initialLocale: "en-US" },
      createElement(ConversationAgentToolCallRow, {
        item: item as never,
        context,
      }),
    ),
  );
}

function renderWake(item: WakeItem, onAction?: () => void): string {
  return renderToStaticMarkup(
    createElement(
      ZCodeIntlProvider,
      { initialLocale: "en-US" },
      createElement(WakeEventItem, {
        event: item.event,
        ...(onAction ? { onAction } : {}),
      }),
    ),
  );
}

const channelsOf = (items: ConversationAssistantWorkRenderItem[]) =>
  items.filter(
    (item): item is Extract<ConversationAssistantWorkRenderItem, { kind: "agentToolCall" }> =>
      item.kind === "agentToolCall",
  );

const wakesOf = (items: ConversationAssistantWorkRenderItem[]): WakeItem[] =>
  items.filter((item): item is WakeItem => item.kind === "wakeEvent");

function kindsOf(html: string): string[] {
  return [...html.matchAll(/data-kind="([a-z]+)"/g)].map((match) => match[1] ?? "");
}

describe("hilo real con dos canales y eventos despertadores", () => {
  it("cada canal se anida con nombre, estado y reloj, y al cerrar deja su estado final", () => {
    const rows = [
      agentRow(1, "tool-run", "running"),
      subagentRow({
        rowId: 11,
        parentToolCallId: "tool-run",
        status: "running",
        lastActivityAt: "2026-11-02T20:04:30.000Z",
        summaryText: "Construir la landing",
      }),
      agentRow(2, "tool-done", "success"),
      subagentRow({
        rowId: 12,
        parentToolCallId: "tool-done",
        status: "success",
        endedAt: "2026-11-02T20:02:14.000Z",
        summaryText: "index.html verificado",
      }),
    ] as never;

    const items = build(rows);
    const channels = channelsOf(items);
    expect(channels).toHaveLength(2);

    const html = channels.map(renderAgent).join("\n");
    expect(html).toContain("en marcha");
    expect(html).toMatch(/en marcha[\s\S]{0,60}?\d{2}:\d{2}/);

    // El cierre lo produce el mapeo y lo pinta la fila centrada del hilo.
    const [closed] = wakesOf(items);
    expect(closed?.event.kind).toBe("closed");
    const closedHtml = closed ? renderWake(closed) : "";
    expect(closedHtml).toContain('data-testid="auton-wake-event"');
    expect(closedHtml).toContain('data-kind="closed"');
    expect(closedHtml).toContain("terminó");
    expect(closedHtml).toContain("02:14");
    // La acción se pinta cuando el hilo puede abrir la sesión del canal.
    expect(renderWake(closed!, () => {})).toContain("Abrir");
  });

  it("dos canales abiertos conviven en el hilo, cada uno con su reloj", () => {
    const rows = [
      agentRow(1, "tool-a", "running"),
      subagentRow({
        rowId: 11,
        parentToolCallId: "tool-a",
        status: "running",
        lastActivityAt: "2026-11-02T20:04:30.000Z",
        summaryText: "uno",
      }),
      agentRow(2, "tool-b", "running"),
      subagentRow({
        rowId: 12,
        parentToolCallId: "tool-b",
        status: "running",
        lastActivityAt: "2026-11-02T20:04:30.000Z",
        summaryText: "dos",
      }),
    ] as never;

    const items = build(rows);
    expect(channelsOf(items)).toHaveLength(2);

    const html = channelsOf(items).map(renderAgent).join("\n");
    const clocks = html.match(/en marcha[\s\S]{0,60}?\d{2}:\d{2}/g) ?? [];
    expect(clocks).toHaveLength(2);
    // Con actividad reciente no hay filas despertadoras.
    expect(wakesOf(items)).toHaveLength(0);
    expect(html).not.toContain('data-kind="closed"');
  });

  it("el mapeo del hilo deriva pregunta, latido y cierre de las filas reales", () => {
    const rows = [
      // Pregunta pendiente: el orquestador marcó requires_answer y el worker
      // sigue esperando. Es el estado que escribe la proyección en la fila.
      agentRow(1, "tool-ask", "running"),
      subagentRow({
        rowId: 11,
        parentToolCallId: "tool-ask",
        status: "running",
        lastActivityAt: "2026-11-02T20:04:30.000Z",
        waitingForAnswer: true,
        summaryText: "¿uso la paleta nueva?",
      }),
      // Latido: worker en marcha sin señales desde hace más del umbral.
      agentRow(2, "tool-silent", "running"),
      subagentRow({
        rowId: 12,
        parentToolCallId: "tool-silent",
        status: "running",
        lastActivityAt: "2026-11-02T20:00:00.000Z",
        waitingForAnswer: false,
        summaryText: "sigue con la landing",
      }),
      // Cierre: el worker terminó.
      agentRow(3, "tool-done", "success"),
      subagentRow({
        rowId: 13,
        parentToolCallId: "tool-done",
        status: "success",
        endedAt: "2026-11-02T20:02:14.000Z",
        summaryText: "verificado",
      }),
    ] as never;

    const items = build(rows);
    const wakes = wakesOf(items);
    expect(wakes.map((item) => item.event.kind)).toEqual(["question", "heartbeat", "closed"]);

    const question = wakes[0]!;
    const questionHtml = renderWake(question, () => {});
    expect(questionHtml).toContain('data-kind="question"');
    expect(questionHtml).toContain("Programador");
    expect(questionHtml).toContain("necesita una decisión");
    expect(questionHtml).toContain("Responder");
    // Sin acción (solo lectura) la pregunta sigue visible, sin botón.
    expect(renderWake(question)).not.toContain("Responder");

    const heartbeat = wakes[1]!;
    expect(heartbeat.event.detail).toBe("05:00 sin noticia");
    const heartbeatHtml = renderWake(heartbeat);
    expect(heartbeatHtml).toContain('data-kind="heartbeat"');
    expect(heartbeatHtml).toContain("sigue trabajando");
    expect(heartbeatHtml).toContain("05:00 sin noticia");

    expect(renderWake(wakes[2]!)).toContain('data-kind="closed"');

    // El canal de la pregunta sigue visible con su reloj; las tres filas son
    // parte del mismo hilo, no componentes sueltos.
    expect(channelsOf(items)).toHaveLength(3);
    const html = [...channelsOf(items).map(renderAgent), ...wakes.map((item) => renderWake(item))].join("\n");
    expect(kindsOf(html).sort()).toEqual(["closed", "heartbeat", "question"]);
  });

  it("la acción del cierre abre el canal; el latido no tiene acción", () => {
    const rows = [
      agentRow(1, "tool-ask", "running"),
      subagentRow({
        rowId: 11,
        parentToolCallId: "tool-ask",
        status: "running",
        lastActivityAt: "2026-11-02T20:04:30.000Z",
        waitingForAnswer: true,
        summaryText: "¿uso la paleta nueva?",
      }),
      agentRow(2, "tool-silent", "running"),
      subagentRow({
        rowId: 12,
        parentToolCallId: "tool-silent",
        status: "running",
        lastActivityAt: "2026-11-02T20:00:00.000Z",
        summaryText: "sigue con la landing",
      }),
      agentRow(3, "tool-done", "success"),
      subagentRow({
        rowId: 13,
        parentToolCallId: "tool-done",
        status: "success",
        endedAt: "2026-11-02T20:02:14.000Z",
        summaryText: "verificado",
      }),
    ] as never;

    const wakes = wakesOf(build(rows));
    const opened: unknown[] = [];
    const ctx = {
      ...context,
      onOpenSubagentSession: (request: unknown) => opened.push(request),
    } as unknown as ConversationRowRenderContext;

    const closed = wakes.find((item) => item.event.kind === "closed");
    const openAction = closed ? wakeEventAction(closed, ctx) : undefined;
    expect(typeof openAction).toBe("function");
    openAction?.();
    expect(opened).toEqual([
      {
        rootSessionId: "sess_ui",
        parentSessionId: "sess_ui",
        childSessionId: "child_13",
        subagentType: "auton-worker",
        title: "Landing 3",
      },
    ]);

    const heartbeat = wakes.find((item) => item.event.kind === "heartbeat");
    expect(heartbeat ? wakeEventAction(heartbeat, ctx) : "missing").toBeUndefined();

    const question = wakes.find((item) => item.event.kind === "question");
    expect(typeof (question ? wakeEventAction(question, ctx) : undefined)).toBe("function");
  });

  it("sin pregunta pendiente ni silencio suficiente no se inventan filas", () => {
    const rows = [
      agentRow(1, "tool-live", "running"),
      subagentRow({
        rowId: 11,
        parentToolCallId: "tool-live",
        status: "running",
        lastActivityAt: "2026-11-02T20:04:30.000Z",
        waitingForAnswer: false,
        summaryText: "trabajando",
      }),
    ] as never;

    // Antes del umbral: nada.
    expect(wakesOf(build(rows, Date.parse("2026-11-02T20:05:10.000Z")))).toHaveLength(0);

    // Pasado el umbral: el latido aparece desde el mismo mapeo.
    const [late] = wakesOf(build(rows, Date.parse("2026-11-02T20:06:01.000Z")));
    expect(late?.event.kind).toBe("heartbeat");
    expect(late?.event.detail).toBe("01:31 sin noticia");
  });
});
