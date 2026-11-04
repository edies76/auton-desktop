// Relojes de Auton: aritmética pura de intervalos, sin I/O.
// La unión cuenta solapamientos una vez (total de la tarea); el split
// separa trabajo de espera (sprint de punta a punta). Ofrecidos para la
// UI; el cableado a datos reales lo decide el orquestador.

export interface TimeInterval {
  startMs: number;
  endMs: number | null;
}

function clampInterval(startMs: number, endMs: number | null, now: number): [number, number] | null {
  if (!Number.isFinite(startMs)) return null;
  const end = endMs === null ? now : endMs;
  if (!Number.isFinite(end)) return null;
  if (end <= startMs) return null;
  return [startMs, end];
}

/** Total con solapamientos contados una vez (unión de intervalos). */
export function unionTotalMs(intervals: TimeInterval[], now: number): number {
  const ranges: Array<[number, number]> = [];
  for (const iv of intervals) {
    const r = clampInterval(iv.startMs, iv.endMs, now);
    if (r) ranges.push(r);
  }
  if (ranges.length === 0) return 0;
  ranges.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [cs, ce] = ranges[0]!;
  for (let i = 1; i < ranges.length; i++) {
    const [s, e] = ranges[i]!;
    if (s <= ce) {
      if (e > ce) ce = e;
    } else {
      total += ce - cs;
      cs = s;
      ce = e;
    }
  }
  total += ce - cs;
  return total;
}

/** Sprint: trabajo y espera separados. */
export function sprintSplitMs(
  work: TimeInterval[],
  wait: TimeInterval[],
  now: number,
): { workMs: number; waitMs: number } {
  return { workMs: unionTotalMs(work, now), waitMs: unionTotalMs(wait, now) };
}

/** Silencio desde la última señal; null si nunca hubo señal. */
export function silenceMs(lastSignalAt: number | null, now: number): number | null {
  if (lastSignalAt === null || !Number.isFinite(lastSignalAt)) return null;
  const d = now - lastSignalAt;
  return d > 0 ? d : 0;
}
