// ============================================================
// Auton project space — muestra de conversación real
// ============================================================
// La entrada de demostración no inventa el modelo de la UI: entrega filas con
// la misma forma que produce el runtime y las pasa por `projectAutonSpace`.
// Así lo que se ve en el navegador es la proyección real, no un mock paralelo.

import type { ConversationRow } from "@zcode/shared/zcode-protocol-v4";
import type { AutonProject } from "./model.js";

const SAMPLE_NOW = Date.now();

const at = (offsetMs: number) => SAMPLE_NOW + offsetMs;

let seq = 0;
function row(partial: Record<string, unknown>): ConversationRow {
  seq += 1;
  return {
    rowId: seq,
    turnId: "turn-sample",
    createdAt: at(0),
    createdAtSeq: seq,
    ...partial,
  } as unknown as ConversationRow;
}

export function sampleProjects(): AutonProject[] {
  return [
    {
      id: "lunar-movil",
      name: "Lunar móvil",
      path: "C:\\proyectos\\lunar-movil",
      lastActiveAt: SAMPLE_NOW - 2 * 60_000,
    },
    {
      id: "auton-docs",
      name: "Auton docs",
      path: "C:\\proyectos\\auton-docs",
      lastActiveAt: SAMPLE_NOW - 3 * 60 * 60_000,
    },
    {
      id: "landing-meta",
      name: "Landing Meta",
      path: "C:\\proyectos\\landing-meta",
      lastActiveAt: SAMPLE_NOW - 26 * 60 * 60_000,
    },
  ];
}

/**
 * Filas con la forma del protocolo v4: entrada del humano, narración del
 * orquestador, un plan escrito, tres workers (uno callado, uno preguntando y
 * uno terminado), un comando con salida y dos archivos tocados.
 */
export function sampleConversationRows(): ConversationRow[] {
  return [
    row({
      kind: "userInput",
      origin: "realUser",
      text: "Mejora el diseño del chat y arregla el error de inicio de sesión.",
      createdAt: at(-150_000),
    }),
    row({
      kind: "assistantText",
      state: "complete",
      text: "Voy a trabajar los dos frentes. Un worker revisa el diseño y otro investiga el inicio de sesión.",
      createdAt: at(-140_000),
    }),
    row({
      kind: "toolCall",
      toolCallId: "plan-1",
      toolName: "AutonPlan",
      status: "success",
      inputText: "",
      input: {
        action: "write",
        goal: { title: "Lunar móvil" },
        items: [
          { id: "s1", title: "Revisar el diseño del chat", status: "running", owner: "programmer" },
          { id: "s2", title: "Diagnosticar el inicio de sesión", status: "waiting", owner: "programmer" },
          { id: "s3", title: "Cerrar con evidencia", status: "ready", owner: "orchestrator" },
        ],
      },
      output: { text: "plan escrito" },
      createdAt: at(-145_000),
    }),
    row({
      kind: "assistantText",
      state: "complete",
      text: "El problema de sesión parece estar en la recuperación del usuario. Le pedí que confirme la causa antes de tocarla.",
      createdAt: at(-70_000),
    }),
    row({
      kind: "subagent",
      parentToolCallId: "agent-1",
      subagentType: "auton-worker",
      status: "running",
      summaryText: "ajustando el cuadro de mensajes",
      childSessionId: "worker-1",
      startedAt: at(-134_000),
      createdAt: at(-134_000),
    }),
    row({
      kind: "subagent",
      parentToolCallId: "agent-1",
      subagentType: "auton-worker",
      status: "running",
      summaryText: "¿el login debe recordar la sesión entre reinicios?",
      childSessionId: "worker-2",
      startedAt: at(-98_000),
      createdAt: at(-98_000),
    }),
    row({
      kind: "subagent",
      parentToolCallId: "agent-1",
      subagentType: "auton-worker",
      status: "success",
      summaryText: "2 archivos, build en verde",
      childSessionId: "worker-3",
      startedAt: at(-300_000),
      endedAt: at(-120_000),
      createdAt: at(-300_000),
    }),
    row({
      kind: "toolCall",
      toolCallId: "bash-1",
      toolName: "Bash",
      status: "success",
      inputText: "",
      input: { command: "pnpm --filter @zcode/ui test" },
      output: { text: "Test Files  1 passed (1)\nTests  3 passed (3)" },
      createdAt: at(-60_000),
    }),
    row({
      kind: "toolCall",
      toolCallId: "edit-1",
      toolName: "Edit",
      status: "success",
      inputText: "",
      input: { file_path: "packages/ui/src/chat/MessageBubble.tsx" },
      output: { text: "ok" },
      createdAt: at(-55_000),
    }),
    row({
      kind: "toolCall",
      toolCallId: "edit-2",
      toolName: "Edit",
      status: "success",
      inputText: "",
      input: { file_path: "packages/ui/src/chat/messageSpacing.ts" },
      output: { text: "ok" },
      createdAt: at(-50_000),
    }),
  ];
}
