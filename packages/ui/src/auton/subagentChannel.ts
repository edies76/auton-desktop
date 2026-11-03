// ============================================================
// Canal de trabajo en el hilo: estado, reloj y evento despertador
// ============================================================
// Traduce la fila real de un subagente (SubagentRow) a lo que el hilo pinta:
// el canal anidado con su estado y su reloj, y la fila centrada de cierre.

import type { SubagentRow } from "@zcode/shared/zcode-protocol-v4";
import type { WakeEventRowProps } from "./WakeEventRow.js";

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function channelStatusLabel(status: SubagentRow["status"]): string {
  switch (status) {
    case "running":
      return "en marcha";
    case "success":
      return "terminó";
    case "failed":
      return "falló";
    case "cancelled":
      return "detenido";
  }
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function channelElapsedMs(row: SubagentRow, now: number): number | null {
  const start = toMillis(row.startedAt);
  if (start === null) return null;
  const end = row.endedAt === undefined ? now : toMillis(row.endedAt);
  if (end === null) return null;
  return Math.max(0, end - start);
}

/** Reloj del canal: "01:42" con el tiempo transcurrido. */
export function channelClock(row: SubagentRow, now: number): string | null {
  const elapsed = channelElapsedMs(row, now);
  return elapsed === null ? null : formatElapsed(elapsed);
}

/** Umbral del latido en el hilo; el mismo que usa el runtime (90 s). */
export const CHANNEL_HEARTBEAT_MS = 90_000;

/**
 * Latido del canal: un worker que sigue en marcha y lleva demasiado tiempo sin
 * dar señales se pinta como fila centrada. Sin señales nuevas, el silencio es la
 * señal.
 */
export function heartbeatEventForSubagent(
  row: SubagentRow,
  now: number,
  thresholdMs: number = CHANNEL_HEARTBEAT_MS,
): WakeEventRowProps | null {
  if (row.status !== "running") return null;
  const last = toMillis(row.lastActivityAt ?? row.startedAt);
  if (last === null) return null;
  const silentFor = now - last;
  if (silentFor < thresholdMs) return null;
  return {
    kind: "heartbeat",
    title: "sigue trabajando",
    detail: `${formatElapsed(silentFor)} sin noticia`,
  };
}

function tail(text: string | undefined, max = 80): string | undefined {
  const value = text?.trim();
  if (!value) return undefined;
  return value.length > max ? `…${value.slice(-(max - 1))}` : value;
}

/**
 * Deriva las filas despertadoras de una fila real de subagente. Es la única
 * fuente: el hilo pinta lo que devuelve esta función, sea pregunta, latido o
 * cierre. Una pregunta pendiente manda sobre el latido.
 */
export function deriveWakeEvents(
  row: SubagentRow,
  now: number,
  title: string,
  heartbeatMs: number = CHANNEL_HEARTBEAT_MS,
): WakeEventRowProps[] {
  if (row.status === "running") {
    if (row.waitingForAnswer === true) {
      const detail = tail(row.summaryText);
      return [
        {
          kind: "question",
          workerName: "Programador",
          title: "necesita una decisión",
          ...(detail ? { detail } : {}),
          actionLabel: "Responder",
        },
      ];
    }
    const heartbeat = heartbeatEventForSubagent(row, now, heartbeatMs);
    return heartbeat ? [heartbeat] : [];
  }
  const closed = wakeEventForSubagent(row, now, title);
  return closed ? [closed] : [];
}

/**
 * Cuando el canal cierra, el hilo pinta una fila centrada de evento despertador.
 * Mientras corre no hay fila de cierre: el canal ya se ve en marcha con su reloj.
 */
export function wakeEventForSubagent(
  row: SubagentRow,
  now: number,
  title: string,
): WakeEventRowProps | null {
  if (row.status === "running") return null;
  const clock = channelClock(row, now);
  const summary = row.summaryText?.trim();
  const detail = summary && summary !== title.trim() ? tail(summary) : undefined;
  return {
    kind: "closed",
    title: `${title} ${channelStatusLabel(row.status)}`.trim(),
    ...(detail ? { detail } : {}),
    ...(clock ? { at: clock } : {}),
    actionLabel: "Abrir",
  };
}
