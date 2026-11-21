// ============================================================
// Soak de rendimiento — sesión grande, un minuto simulado
// ============================================================
// El pedido del humano: "se traba muchísimo y se laguea". Este soak simula la
// sesión que le duele: muchas filas, muchos turnos, muchos workers y una
// transcripción larga; después un minuto de ticks + ráfagas de streaming sobre
// el turno en curso. Lo que debe verse: los turnos terminados no se reconstruyen
// (0 objetos nuevos tras el build inicial), el espacio no se deriva en ticks sin
// cambios, y todo el guion cabe en un presupuesto generoso.

import type { ZCodeTaskMeta } from "@zcode/shared";
import type {
  AssistantTextRow,
  ConversationRow,
  SubagentRow,
  ToolCallRow,
  TurnHeaderRow,
  UserInputRow,
} from "@zcode/shared/zcode-protocol-v4";
import { describe, expect, it } from "vitest";
import {
  createAutonSpaceProducer,
  type AutonSpaceProducerInput,
} from "@/auton/project-space/spaceProducer.js";
import type { AutonSessionWorkerSnapshot } from "@/auton/project-space/sessionWorker.js";
import { buildConversationTurnRenderUnits } from "@/v4/conversationTurnRenderUnits.js";

const T0 = 1_700_000_000_000;
const FINISHED_TURNS = 40;
const TOOLS_PER_TURN = 48;
const RUNNING_ROWS = 260;

let nextRowId = 1;

function rowBase(rowId: number, turnId: string) {
  return {
    rowId,
    turnId,
    createdAt: T0 + rowId,
    createdAtSeq: rowId,
  };
}

function header(rowId: number, turnId: string, state: TurnHeaderRow["state"]): TurnHeaderRow {
  return {
    ...rowBase(rowId, turnId),
    kind: "turnHeader",
    origin: "userInput",
    state,
    startedAt: T0 + rowId,
    // Como el runtime real: activeMs/endedAt se fijan al cerrar el turno; el
    // turno en curso mide contra el reloj.
    ...(state === "running" ? {} : { endedAt: T0 + rowId + 10_000, activeMs: 10_000 }),
  } as TurnHeaderRow;
}

function userInput(rowId: number, turnId: string, text: string): UserInputRow {
  return { ...rowBase(rowId, turnId), kind: "userInput", origin: "realUser", text } as UserInputRow;
}

function toolCall(rowId: number, turnId: string, name: string): ToolCallRow {
  return {
    ...rowBase(rowId, turnId),
    kind: "toolCall",
    toolCallId: `tool-${rowId}`,
    toolName: name,
    status: "success",
    inputText: "{}",
    startedAt: T0 + rowId,
    endedAt: T0 + rowId + 500,
  } as ToolCallRow;
}

function assistantText(rowId: number, turnId: string, text: string): AssistantTextRow {
  return { ...rowBase(rowId, turnId), kind: "assistantText", text, state: "complete" } as AssistantTextRow;
}

function subagentRow(rowId: number, turnId: string, index: number): SubagentRow {
  return {
    ...rowBase(rowId, turnId),
    kind: "subagent",
    subagentType: "auton-worker",
    status: "success",
    summaryText: `worker ${index} hizo su parte`,
    childSessionId: `sess_auton_agent_${index}`,
    startedAt: T0 + rowId,
    endedAt: T0 + rowId + 5_000,
  } as SubagentRow;
}

interface SoakFixture {
  rows: ConversationRow[];
  agents: ZCodeTaskMeta[];
  sessionWorkers: AutonSessionWorkerSnapshot[];
  runningTurnId: string;
}

function buildFixture(): SoakFixture {
  nextRowId = 1;
  const rows: ConversationRow[] = [];
  for (let turn = 0; turn < FINISHED_TURNS; turn += 1) {
    const turnId = `turn-done-${turn}`;
    rows.push(header(nextRowId++, turnId, "completedSuccess"));
    rows.push(userInput(nextRowId++, turnId, `pedido ${turn}`));
    if (turn < 20) {
      // 20 workers repartidos en los primeros turnos.
      rows.push(subagentRow(nextRowId++, turnId, turn));
    }
    for (let tool = 0; tool < TOOLS_PER_TURN; tool += 1) {
      rows.push(toolCall(nextRowId++, turnId, "Read"));
    }
    rows.push(assistantText(nextRowId++, turnId, `respuesta ${turn}`));
  }
  const runningTurnId = "turn-running";
  rows.push(header(nextRowId++, runningTurnId, "running"));
  rows.push(userInput(nextRowId++, runningTurnId, "haz el trabajo grande"));
  for (let index = 0; index < RUNNING_ROWS; index += 1) {
    rows.push(
      index % 3 === 0
        ? toolCall(nextRowId++, runningTurnId, "Bash")
        : assistantText(nextRowId++, runningTurnId, `avance ${index}`),
    );
  }

  // Transcripción larga de un worker de sesión (≥200 entradas).
  const transcript = Array.from({ length: 220 }, (_, index) => ({
    id: `entry-${index}`,
    at: T0 + index * 1_000,
    kind: "message" as const,
    role: index % 2 === 0 ? ("orchestrator" as const) : ("worker" as const),
    text: `línea ${index} de la conversación del worker`,
  }));
  const sessionWorkers: AutonSessionWorkerSnapshot[] = [
    {
      agentId: "agent_soak",
      description: "soak",
      status: "running",
      startedAt: T0,
      childSessionId: "sess_auton_agent_soak",
      transcript,
    },
  ];

  return { rows, agents: [], sessionWorkers, runningTurnId };
}

describe("soak de sesión grande (60 ticks + ráfagas)", () => {
  it("no reconstruye el pasado, no deriva en reposo y cabe en el presupuesto", () => {
    const fixture = buildFixture();
    const producer = createAutonSpaceProducer("p1");
    const startedAt = performance.now();

    const firstUnits = buildConversationTurnRenderUnits(fixture.rows, { nowMs: T0 + 100_000 });
    const firstSpace = producer({
      rows: fixture.rows,
      agents: fixture.agents,
      sessionWorkers: fixture.sessionWorkers,
    });
    const finishedUnits = firstUnits.slice(0, -1);
    expect(firstUnits.at(-1)?.turnId).toBe(fixture.runningTurnId);
    expect(finishedUnits.length).toBeGreaterThanOrEqual(FINISHED_TURNS);
    const initialBuildMs = performance.now() - startedAt;

    // 60 ticks con filas intactas: los terminados no se reconstruyen y el
    // espacio no se deriva (misma referencia), con el reloj avanzando.
    const ticksStart = performance.now();
    let previousDuration = firstUnits.at(-1)?.workStatus?.durationMs ?? 0;
    for (let tick = 1; tick <= 60; tick += 1) {
      const units = buildConversationTurnRenderUnits(fixture.rows, {
        nowMs: T0 + 100_000 + tick * 1_000,
      });
      expect(units.length).toBe(firstUnits.length);
      // 0 objetos nuevos de turnos terminados: solo el turno en curso se rehace.
      for (let index = 0; index < finishedUnits.length; index += 1) {
        expect(units[index]).toBe(firstUnits[index]);
      }
      const running = units.at(-1)!;
      const duration = running.workStatus?.durationMs ?? 0;
      expect(duration).toBeGreaterThan(previousDuration);
      previousDuration = duration;
      const space = producer({
        rows: fixture.rows,
        agents: fixture.agents,
        sessionWorkers: fixture.sessionWorkers,
      });
      expect(space).toBe(firstSpace);
    }
    const ticksMs = performance.now() - ticksStart;

    // 5 ráfagas de 20 appends sobre el turno en curso: el pasado sigue idéntico.
    const burstsStart = performance.now();
    let rows = fixture.rows;
    for (let burst = 0; burst < 5; burst += 1) {
      for (let index = 0; index < 20; index += 1) {
        rows = [
          ...rows,
          assistantText(nextRowId++, fixture.runningTurnId, `ráfaga ${burst}.${index}`),
        ];
      }
      const units = buildConversationTurnRenderUnits(rows, { nowMs: T0 + 200_000 + burst * 1_000 });
      expect(units.length).toBe(firstUnits.length);
      for (let index = 0; index < finishedUnits.length; index += 1) {
        expect(units[index]).toBe(firstUnits[index]);
      }
      expect(units.at(-1)?.assistantTextRows.length).toBeGreaterThan(
        firstUnits.at(-1)?.assistantTextRows.length ?? 0,
      );
      const input: AutonSpaceProducerInput = {
        rows,
        agents: fixture.agents,
        sessionWorkers: fixture.sessionWorkers,
      };
      const space = producer(input);
      expect(space).not.toBe(firstSpace);
    }
    const burstsMs = performance.now() - burstsStart;
    const totalMs = performance.now() - startedAt;

    // eslint-disable-next-line no-console
    console.log(
      `[soak] filas=${rows.length} turnos=${FINISHED_TURNS + 1} workers=20 transcrito=220 ` +
        `build=${initialBuildMs.toFixed(0)}ms ticks60=${ticksMs.toFixed(0)}ms ráfagas=${burstsMs.toFixed(0)}ms total=${totalMs.toFixed(0)}ms`,
    );
    expect(totalMs).toBeLessThan(10_000);
  }, 30_000);
});
