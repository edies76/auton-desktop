import type {
  AssistantTextRow,
  ConversationRow,
  ReasoningRow,
  TurnHeaderRow,
  UserInputRow,
} from "@zcode/shared/zcode-protocol-v4";
import type { ConversationCuaGroupRenderItem } from "@/v4/conversationCuaGroups.js";

export type AssistantWorkRow = Exclude<ConversationRow, TurnHeaderRow | UserInputRow>;

export type ConversationTurnFlowItem =
  | { kind: "userInput"; row: UserInputRow }
  | { kind: "assistantHistory"; rows: AssistantWorkRow[] }
  | { kind: "assistantText"; row: AssistantTextRow; latest: boolean }
  /** Reasoning de cara al humano: planear, decidir o traducir, fuera del loop. */
  | { kind: "assistantReasoning"; row: ReasoningRow }
  /** Reasoning atado a la ejecución: dentro del loop, con el trabajo. */
  | { kind: "assistantLoopReasoning"; row: ReasoningRow }
  | { kind: "assistantWork"; rows: AssistantWorkRow[] }
  | ConversationCuaGroupRenderItem;

function isUserInputRow(row: ConversationRow): row is UserInputRow {
  return row.kind === "userInput";
}

function isAssistantTextRow(row: ConversationRow): row is AssistantTextRow {
  return row.kind === "assistantText";
}

function isAssistantWorkRow(row: ConversationRow): row is AssistantWorkRow {
  return row.kind !== "turnHeader" && row.kind !== "userInput";
}

function isReasoningRow(row: ConversationRow): row is ReasoningRow {
  return row.kind === "reasoning";
}

function isLoopRow(row: ConversationRow): boolean {
  return row.kind === "toolCall" || row.kind === "subagent" || row.kind === "artifact";
}

function appendGroupedAssistantFlowItem(
  items: ConversationTurnFlowItem[],
  kind: "assistantHistory" | "assistantWork",
  row: AssistantWorkRow,
): void {
  const previous = items.at(-1);
  if (previous?.kind === kind) {
    previous.rows.push(row);
    return;
  }
  items.push({ kind, rows: [row] });
}

export function buildConversationFlowItems(options: {
  orderedRows: readonly ConversationRow[];
  assistantHistoryRows: readonly AssistantWorkRow[];
  assistantFollowingRows: readonly AssistantWorkRow[];
  assistantTailRows: readonly AssistantWorkRow[];
  /** 当前 visual work segment 外置展示的末段正文。 */
  visibleAssistantTextRow?: AssistantTextRow;
  /** 整个 product turn 唯一可挂 action 的最终正文。 */
  latestAssistantTextRow?: AssistantTextRow;
  timelineOnly: boolean;
  /**
   * Auton: la narración del orquestador se intercala con el trabajo. Cada
   * assistantText se pinta en su posición, no solo el último.
   */
  interleaveAssistantText?: boolean;
}): ConversationTurnFlowItem[] {
  const historyRowIds = new Set(options.assistantHistoryRows.map((row) => row.rowId));
  const followingRowIds = new Set(options.assistantFollowingRows.map((row) => row.rowId));
  const tailRowIds = new Set(options.assistantTailRows.map((row) => row.rowId));
  const loopRowIds = options.orderedRows.filter(isLoopRow).map((row) => row.rowId);
  const firstLoopRowId = loopRowIds.at(0);
  const lastLoopRowId = loopRowIds.at(-1);
  // Fuera del loop: lo que ocurrió antes del primer tool o después del último.
  // Es el reasoning con el que el orquestador planea, decide o te traduce.
  const isUserFacingReasoning = (rowId: number): boolean =>
    firstLoopRowId === undefined ||
    lastLoopRowId === undefined ||
    rowId < firstLoopRowId ||
    rowId > lastLoopRowId;
  const items: ConversationTurnFlowItem[] = [];

  for (const row of options.orderedRows) {
    if (isUserInputRow(row)) {
      items.push({ kind: "userInput", row });
      continue;
    }
    if (!isAssistantWorkRow(row)) continue;
    // 轮尾 boundary 已从 assistant flow 拆成 assistantTailRows；若再把它追加回
    // flowItems，renderer 会把它渲染在定时任务卡片、文件 summary 和消息操作栏之前。
    // 这里只保留真实 flow；boundary 由 TurnGroup 在全部 turn-local 附属 UI 之后统一收尾。
    if (tailRowIds.has(row.rowId)) continue;
    if (options.interleaveAssistantText && isAssistantTextRow(row)) {
      // Auton: cada mensaje del orquestador va en su sitio, entre las tools y
      // los canales. El último conserva las acciones; los demás son narración.
      items.push({
        kind: "assistantText",
        row,
        latest: row.rowId === options.latestAssistantTextRow?.rowId,
      });
      continue;
    }
    if (options.interleaveAssistantText && isReasoningRow(row)) {
      items.push({
        kind: isUserFacingReasoning(row.rowId)
          ? "assistantReasoning"
          : "assistantLoopReasoning",
        row,
      });
      continue;
    }
    if (
      isAssistantTextRow(row) &&
      (row.rowId === options.visibleAssistantTextRow?.rowId || !historyRowIds.has(row.rowId)) &&
      !followingRowIds.has(row.rowId) &&
      !tailRowIds.has(row.rowId) &&
      !options.timelineOnly
    ) {
      items.push({
        kind: "assistantText",
        row,
        latest: row.rowId === options.latestAssistantTextRow?.rowId,
      });
      continue;
    }
    appendGroupedAssistantFlowItem(
      items,
      historyRowIds.has(row.rowId) && !options.timelineOnly ? "assistantHistory" : "assistantWork",
      row,
    );
  }

  return items;
}
