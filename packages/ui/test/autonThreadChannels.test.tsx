import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SubagentRow, ToolCallRow } from "@zcode/shared/zcode-protocol-v4";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { buildAssistantWorkRenderItems } from "@/v4/conversationAssistantWorkItems.js";
import { ConversationAgentToolCallRow } from "@/v4/ConversationAgentToolCallRow.js";
import { WakeEventRow } from "@/auton/WakeEventRow.js";
import { resolveToolCallRenderer } from "@/ToolCallBlocks/resolveRenderer.js";
import type { ConversationRowRenderContext } from "@/v4/conversationRowContext.js";

const START = "2026-11-02T20:00:00.000Z";

function agentRow(rowId: number, toolCallId: string, status: ToolCallRow["status"]): ToolCallRow {
  return {
    kind: "toolCall",
    rowId,
    turnId: "turn_1",
    toolCallId,
    toolName: "Agent",
    status,
    inputText: "",
    input: { description: "Landing de Auton", subagent_type: "auton-worker" },
  } as unknown as ToolCallRow;
}

function subagentRow(input: {
  rowId: number;
  parentToolCallId: string;
  status: SubagentRow["status"];
  endedAt?: string;
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

function renderRow(item: unknown): string {
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

describe("hilo real con dos canales y eventos despertadores", () => {
  it("cada canal se anida con nombre, estado y reloj, y al cerrar deja su estado final", () => {
    const running = agentRow(1, "tool-run", "running");
    const finished = agentRow(2, "tool-done", "success");
    const rows = [
      running,
      subagentRow({
        rowId: 11,
        parentToolCallId: "tool-run",
        status: "running",
        summaryText: "Construir la landing",
      }),
      finished,
      subagentRow({
        rowId: 12,
        parentToolCallId: "tool-done",
        status: "success",
        endedAt: "2026-11-02T20:02:14.000Z",
        summaryText: "index.html verificado",
      }),
    ] as never;

    const items = buildAssistantWorkRenderItems(rows, "hidden").filter(
      (item) => item.kind === "agentToolCall",
    );
    expect(items).toHaveLength(2);

    const html = items.map(renderRow).join("\n");

    // Canal en marcha: nombre, estado y reloj.
    expect(html).toContain("en marcha");
    expect(html).toMatch(/en marcha[\s\S]{0,60}?\d{2}:\d{2}/);

    // Canal cerrado: estado final y fila centrada del evento despertador.
    expect(html).toContain('data-testid="auton-wake-event"');
    expect(html).toContain('data-kind="closed"');
    expect(html).toContain("terminó");
    expect(html).toContain("02:14");
    expect(html).toContain("Abrir");
  });

  it("dos canales abiertos conviven en el hilo, cada uno con su reloj", () => {
    const rows = [
      agentRow(1, "tool-a", "running"),
      subagentRow({ rowId: 11, parentToolCallId: "tool-a", status: "running", summaryText: "uno" }),
      agentRow(2, "tool-b", "running"),
      subagentRow({ rowId: 12, parentToolCallId: "tool-b", status: "running", summaryText: "dos" }),
    ] as never;

    const items = buildAssistantWorkRenderItems(rows, "hidden").filter(
      (item) => item.kind === "agentToolCall",
    );
    expect(items).toHaveLength(2);

    const html = items.map(renderRow).join("\n");
    const clocks = html.match(/en marcha[\s\S]{0,60}?\d{2}:\d{2}/g) ?? [];
    expect(clocks).toHaveLength(2);
    // Sin filas de cierre mientras ambos siguen vivos.
    expect(html).not.toContain('data-kind="closed"');
  });

  it("el hilo produce las tres filas despertadoras desde las filas reales", () => {
    // Pregunta: fila real de SendMessage con waitingForAnswer.
    const questionRow = {
      kind: "toolCall",
      rowId: 3,
      turnId: "turn_1",
      toolCallId: "tool-ask",
      toolName: "SendMessage",
      status: "success",
      inputText: "",
      input: { message: "¿uso la paleta nueva?", summary: "decisión", waitingForAnswer: true },
    } as unknown as ToolCallRow;

    const questionContext = {
      toolCallNode: { toolCall: questionRow, childToolCalls: [] },
    } as never;
    const questionBlock = resolveToolCallRenderer(questionContext) as (
      ctx: never,
    ) => unknown;
    const question = renderToStaticMarkup(
      createElement(questionBlock as never, questionContext),
    );

    // Latido y cierre: filas reales de subagente a través del mapeo del hilo.
    const rows = [
      agentRow(1, "tool-old", "running"),
      subagentRow({
        rowId: 11,
        parentToolCallId: "tool-old",
        status: "running",
        summaryText: "sigue con la landing",
      }),
      agentRow(2, "tool-done", "success"),
      subagentRow({
        rowId: 12,
        parentToolCallId: "tool-done",
        status: "success",
        endedAt: "2026-11-02T20:02:14.000Z",
        summaryText: "verificado",
      }),
    ] as never;

    const channels = buildAssistantWorkRenderItems(rows, "hidden")
      .filter((item) => item.kind === "agentToolCall")
      .map(renderRow)
      .join("\n");

    const html = [question, channels].join("\n");
    const kinds = [...html.matchAll(/data-kind="([a-z]+)"/g)].map((match) => match[1]);
    expect(kinds.sort()).toEqual(["closed", "heartbeat", "question"]);
  });});
