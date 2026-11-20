import { describe, expect, it } from "vitest";
import type {
  AssistantTextRow,
  ConversationRow,
  SubagentRow,
  ToolCallRow,
  TurnHeaderRow,
} from "@zcode/shared/zcode-protocol-v4";
import { buildConversationTurnWorkSegments } from "@/v4/conversationTurnWorkSegments.js";

const T0 = 1_700_000_000_000;

function baseRow<T extends ConversationRow>(
  row: Omit<T, "createdAt" | "createdAtSeq" | "rowId" | "turnId"> & { rowId: number },
): T {
  return {
    createdAt: T0 + row.rowId,
    createdAtSeq: row.rowId,
    turnId: "turn-1",
    ...row,
  } as T;
}

function header(overrides: Partial<TurnHeaderRow> = {}): TurnHeaderRow {
  return baseRow<TurnHeaderRow>({
    rowId: 1,
    kind: "turnHeader",
    origin: "userInput",
    executionKind: "agent",
    state: "completedSuccess",
    startedAt: T0,
    endedAt: T0 + 300_000,
    activeMs: 300_000,
    // Un solo hecho de turno completo, como lo emite el runtime por input.
    workSegments: [
      { segmentId: "segment-1", startedAt: T0, endedAt: T0 + 300_000, activeMs: 300_000 },
    ],
    ...overrides,
  });
}

function toolCall(rowId: number, startedAt: number, endedAt: number): ToolCallRow {
  return baseRow<ToolCallRow>({
    rowId,
    kind: "toolCall",
    toolCallId: `tool-${rowId}`,
    toolName: "Read",
    status: "success",
    inputText: "{}",
    startedAt,
    endedAt,
  });
}

function assistantText(rowId: number, text: string): AssistantTextRow {
  return baseRow<AssistantTextRow>({
    rowId,
    kind: "assistantText",
    text,
    state: "complete",
  });
}

function subagentRow(rowId: number, startedAt: number, endedAt: number): SubagentRow {
  return baseRow<SubagentRow>({
    rowId,
    kind: "subagent",
    parentToolCallId: "tool-9",
    subagentType: "auton-worker",
    status: "success",
    summaryText: "worker",
    childSessionId: "sess_auton_1",
    startedAt,
    endedAt,
  });
}

describe("duración de los tramos del loop del orquestador", () => {
  it("cada bloque de narración muestra su propio tramo, no el total del turno", () => {
    // Tres grupos de trabajo separados por narración, como la crónica real del
    // orquestador: tool → narración → tool → narración → tool → cierre.
    const c1 = toolCall(2, T0, T0 + 5_000);
    const a1 = assistantText(3, "narración 1");
    const c2 = toolCall(4, T0 + 10_000, T0 + 50_000);
    const a2 = assistantText(5, "narración 2");
    const c3 = subagentRow(6, T0 + 60_000, T0 + 70_000);
    const a3 = assistantText(7, "cierre");

    const segments = buildConversationTurnWorkSegments({
      key: "turn-1",
      header: header(),
      orderedRows: [c1, a1, c2, a2, c3, a3],
      assistantTailRows: [a3],
      latestAssistantTextRow: a3,
      isRunning: false,
      isLastTurn: true,
      isInterrupted: false,
      forceOpenHistory: false,
      interleaveAssistantText: true,
      timelineOnly: false,
      nowMs: T0 + 300_000,
    });

    expect(segments).toHaveLength(4);
    const durations = segments.map((segment) => segment.workStatus?.durationMs);
    expect(durations).toEqual([5_000, 40_000, 10_000, undefined]);
    // El bug que esto guarda: el total del turno repetido en cada bloque, y
    // también debajo de la narración final que no tiene trabajo propio.
    expect(durations).not.toContain(300_000);
  });

  it("el tramo en curso mide hasta ahora y no repite el total", () => {
    const c1 = toolCall(2, T0, T0 + 5_000);
    const a1 = assistantText(3, "narración 1");
    const c2 = toolCall(4, T0 + 200_000, T0 + 205_000);

    const segments = buildConversationTurnWorkSegments({
      key: "turn-1",
      header: header({ endedAt: undefined, activeMs: undefined }),
      orderedRows: [c1, a1, c2],
      assistantTailRows: [],
      isRunning: true,
      isLastTurn: true,
      isInterrupted: false,
      forceOpenHistory: false,
      interleaveAssistantText: true,
      timelineOnly: false,
      nowMs: T0 + 260_000,
    });

    expect(segments).toHaveLength(2);
    expect(segments[0]?.workStatus?.state).toBe("completed");
    expect(segments[0]?.workStatus?.durationMs).toBe(5_000);
    expect(segments[1]?.workStatus?.state).toBe("running");
    expect(segments[1]?.workStatus?.durationMs).toBe(60_000);
  });

  it("el turno de un solo tramo conserva la duración del header", () => {
    const c1 = toolCall(2, T0, T0 + 5_000);

    const segments = buildConversationTurnWorkSegments({
      key: "turn-1",
      header: header(),
      orderedRows: [c1],
      assistantTailRows: [],
      isRunning: false,
      isLastTurn: true,
      isInterrupted: false,
      forceOpenHistory: false,
      interleaveAssistantText: true,
      timelineOnly: false,
      nowMs: T0 + 300_000,
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]?.workStatus?.durationMs).toBe(300_000);
  });
});
