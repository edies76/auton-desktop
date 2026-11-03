// ============================================================
// Auton live loop - qué evento hace hablar al orquestador y cuándo
// ============================================================
// El orquestador no abre turnos: recibe eventos y decide si narra, si
// interrumpe o si se calla. Este módulo es la tabla de prioridades de la spec
// (ARQUITECTURA-ORQUESTADOR §2) hecha código puro, sin runtime ni UI.

export const LOOP_HEARTBEAT_MS = 90_000;

export type LoopEventKind =
  | "human_message"
  | "worker_question"
  | "worker_closed"
  | "dispatch"
  | "heartbeat";

export interface LoopEvent {
  kind: LoopEventKind;
  at: number;
  workerId?: string;
  status?: "done" | "blocked" | "stopped";
}

export interface LoopState {
  /** Programadores con trabajo en curso. */
  running: number;
  /** Preguntas de workers esperando respuesta del orquestador. */
  openQuestions: number;
  /** Última vez que el orquestador dijo algo. */
  lastNarrationAt: number | null;
  phase: "idle" | "working" | "waiting_human";
}

export interface LoopDecision {
  /** Si el orquestador debe decir algo ahora. */
  narrate: boolean;
  /** Por qué habla; null cuando se calla. */
  reason: LoopEventKind | null;
  /** Si el evento corta lo que estuviera narrando. */
  interrupt: boolean;
  state: LoopState;
}

export function initialLoopState(): LoopState {
  return { running: 0, openQuestions: 0, lastNarrationAt: null, phase: "idle" };
}

function phaseAfter(state: LoopState): LoopState["phase"] {
  if (state.openQuestions > 0) return "waiting_human";
  return state.running > 0 ? "working" : "idle";
}

/**
 * Aplica un evento al estado del bucle y devuelve qué debe hacer el orquestador.
 *
 * Prioridad (spec §2): humano > pregunta de worker > cierre/fallo > latido.
 * Un evento de prioridad baja no interrumpe: se acumula y sale en la siguiente
 * narración, para que el hilo no se convierta en una consola.
 */
export function applyLoopEvent(
  previous: LoopState,
  event: LoopEvent,
  options: { heartbeatMs?: number } = {},
): LoopDecision {
  const heartbeatMs = options.heartbeatMs ?? LOOP_HEARTBEAT_MS;
  const state: LoopState = { ...previous };
  let narrate = false;
  let interrupt = false;

  switch (event.kind) {
    case "human_message": {
      // El humano siempre tiene la voz: se responde ya, sin esperar turno.
      narrate = true;
      interrupt = true;
      break;
    }
    case "worker_question": {
      state.openQuestions = previous.openQuestions + 1;
      narrate = true;
      interrupt = true;
      break;
    }
    case "worker_closed": {
      state.running = Math.max(0, previous.running - 1);
      narrate = true;
      break;
    }
    case "dispatch": {
      state.running = previous.running + 1;
      // Abrir un canal se cuenta siempre: es la presencia que el humano perdió.
      narrate = true;
      break;
    }
    case "heartbeat": {
      const silentFor = previous.lastNarrationAt === null ? Infinity : event.at - previous.lastNarrationAt;
      narrate = previous.running > 0 && silentFor >= heartbeatMs;
      break;
    }
  }

  if (narrate) state.lastNarrationAt = event.at;
  state.phase = phaseAfter(state);

  return {
    narrate,
    reason: narrate ? event.kind : null,
    interrupt,
    state,
  };
}

/** Responde a una pregunta de worker: la cola baja y el bucle sigue. */
export function resolveQuestion(previous: LoopState): LoopState {
  const state = { ...previous, openQuestions: Math.max(0, previous.openQuestions - 1) };
  return { ...state, phase: phaseAfter(state) };
}
