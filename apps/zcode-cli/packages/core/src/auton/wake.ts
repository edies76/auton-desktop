// ============================================================
// Despertador del orquestador — avisos de los canales → turno
// ============================================================
// Los avisos (mensajes de workers, cierres, latidos, agentes externos) se
// encolan para lectura con AutonNotifications y además despiertan un turno:
// sin esto el orquestador no dice nada hasta que el humano pregunta, aunque
// tenga la información a mano.
//
// El despertar NO lleva el contenido: solo dice que hay avisos sin leer y cómo
// leerlos. La lectura sigue siendo la única vía del contenido. Varios avisos
// seguidos producen un solo despertar (ventana de coalescencia) para que un
// worker parlanchín no convierta el hilo en una consola.

import { channelLabel, type AutonChannel } from "@zcode/shared/auton-notifications";

export const AUTON_WAKE_WINDOW_MS = 60_000;

/** `AUTON_WAKE_WINDOW_MS` permite ajustar la ventana (pruebas y demos). */
export function resolveAutonWakeWindowMs(): number {
  const raw = Number(process.env.AUTON_WAKE_WINDOW_MS);
  if (!Number.isFinite(raw) || raw <= 0) return AUTON_WAKE_WINDOW_MS;
  return Math.max(0, raw);
}

const lastWakeAt = new Map<string, number>();

/**
 * ¿Toca despertar? Consume la ventana cuando dice sí. Un aviso absorbido por
 * la ventana no se pierde: queda encolado en su canal y el siguiente
 * despertar (o el propio turno en curso) lo ve al leer.
 */
export function shouldWakeOrchestrator(
  sessionId: string,
  now: number = Date.now(),
  windowMs: number = resolveAutonWakeWindowMs(),
): boolean {
  const key = String(sessionId);
  const last = lastWakeAt.get(key);
  if (last !== undefined && now - last < windowMs) return false;
  lastWakeAt.set(key, now);
  return true;
}

/** Solo pruebas: limpia la ventana de una sesión. */
export function resetAutonWakeWindow(sessionId: string): void {
  lastWakeAt.delete(String(sessionId));
}

export function formatAutonWakeNotice(
  summaries: readonly { channel: AutonChannel; unread: number }[],
): string {
  const parts = summaries
    .filter((summary) => summary.unread > 0)
    .map((summary) => `${channelLabel(summary.channel)}: ${summary.unread}`);
  const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return [
    `[Auton] Tienes avisos sin leer en tus canales${detail}.`,
    "Léelos con AutonNotifications y dile al humano lo que importe, en una línea.",
  ].join(" ");
}
