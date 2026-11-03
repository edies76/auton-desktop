// ============================================================
// Espacio del proyecto — worker de sesión a fila del panel
// ============================================================
// El panel de workers se alimenta de filas de subagente. Un worker que corre
// como sesión completa no produce esa fila, así que aquí se traduce su estado
// real a la MISMA forma (`AutonWorkerView`) que ya consume la superficie.
// Es puro: no conoce React ni el runtime.

import type { AutonWorkerView, AutonWorkerEvent, AutonWorkerStatus } from "./model.js";

/** Estado mínimo que el runtime ya conoce de un worker de sesión. */
export interface AutonSessionWorkerSnapshot {
  agentId: string;
  description: string;
  status: "running" | "completed" | "failed" | "stopped" | "cancelled";
  startedAt: number;
  completedAt?: number;
  childSessionId?: string;
  /** El orquestador marcó una decisión pendiente. */
  waitingForAnswer?: boolean;
  /** Última línea publicada por el canal del worker. */
  lastLine?: string;
  error?: string;
  /** Eventos del canal, si el runtime los tiene a mano. */
  events?: readonly { id: string; at: number; kind: AutonWorkerEvent["kind"]; text: string }[];
}

export function sessionWorkerStatus(snapshot: AutonSessionWorkerSnapshot): AutonWorkerStatus {
  if (snapshot.waitingForAnswer) return "preguntando";
  if (snapshot.status === "completed") return "terminado";
  if (snapshot.status === "failed" || snapshot.status === "cancelled") return "bloqueado";
  if (snapshot.status === "stopped") return "esperando";
  return "trabajando";
}

/**
 * Devuelve la misma fila que el panel ya pinta: nombre, estado, tiempos,
 * última señal y transcripción. Un worker terminado deja de correr el reloj.
 */
export function projectSessionWorkerView(
  snapshot: AutonSessionWorkerSnapshot,
): AutonWorkerView {
  const status = sessionWorkerStatus(snapshot);
  const lastSignalAt = snapshot.completedAt ?? snapshot.startedAt;
  const transcript: AutonWorkerEvent[] = [];
  for (const event of snapshot.events ?? []) {
    transcript.push({ id: event.id, at: event.at, kind: event.kind, text: event.text });
  }
  if (snapshot.lastLine && !transcript.some((event) => event.text === snapshot.lastLine)) {
    transcript.push({
      id: `${snapshot.agentId}-last`,
      at: lastSignalAt,
      kind: "message",
      text: snapshot.lastLine,
    });
  }
  if (snapshot.error) {
    transcript.push({
      id: `${snapshot.agentId}-error`,
      at: lastSignalAt,
      kind: "close",
      text: snapshot.error,
    });
  }

  return {
    id: snapshot.childSessionId ?? snapshot.agentId,
    agentId: snapshot.agentId,
    name: `worker ${snapshot.description}`.trim(),
    status,
    startedAt: snapshot.startedAt,
    lastSignalAt,
    ...(snapshot.lastLine ? { lastLine: snapshot.lastLine } : {}),
    transcript,
  };
}

/**
 * Añade los workers de sesión a la proyección existente sin duplicar los que
 * ya llegaron como fila de subagente.
 */
export function mergeSessionWorkers<T extends { workers: AutonWorkerView[] }>(
  space: T,
  snapshots: readonly AutonSessionWorkerSnapshot[],
): T & { workers: AutonWorkerView[] } {
  const existing = new Set(space.workers.map((worker) => worker.id));
  const added = snapshots
    .map(projectSessionWorkerView)
    .filter((worker) => !existing.has(worker.id));
  return { ...space, workers: [...space.workers, ...added] };
}
