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

/**
 * Cuando el canal cierra, el hilo pinta una fila centrada de evento despertador.
 * Mientras corre no hay fila: el canal ya se ve en marcha con su reloj.
 */
export function wakeEventForSubagent(
  row: SubagentRow,
  now: number,
  title: string,
): WakeEventRowProps | null {
  if (row.status === "running") return null;
  const clock = channelClock(row, now);
  const detail = row.summaryText?.trim();
  return {
    kind: "closed",
    title: `${title} ${channelStatusLabel(row.status)}`.trim(),
    ...(detail ? { detail: detail.length > 80 ? `${detail.slice(0, 77)}…` : detail } : {}),
    ...(clock ? { at: clock } : {}),
    actionLabel: "Abrir",
  };
}
