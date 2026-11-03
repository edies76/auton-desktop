// ============================================================
// Auton live turn - latido del orquestador mientras hay trabajo vivo
// ============================================================
// Mientras haya trabajo en curso, este reloj publica una línea de estado cada
// 90 s de silencio. Si no hay trabajo, calla. Los eventos del worker reinician
// el reloj: lo que el orquestador ya dijo cuenta como noticia.

export const LIVE_HEARTBEAT_MS = 90_000;

export interface LiveHeartbeatInfo {
  running: number;
  silentForMs: number;
}

export interface AutonLiveLoopOptions {
  heartbeatMs?: number;
  onHeartbeat: (info: LiveHeartbeatInfo) => void;
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => { cancel: () => void };
}

export interface LiveLoopSnapshot {
  running: number;
  silentForMs: number;
  phase: "idle" | "working";
}

function defaultSchedule(callback: () => void, delayMs: number): { cancel: () => void } {
  const timer = setTimeout(callback, delayMs);
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }
  return { cancel: () => clearTimeout(timer) };
}

export function formatHeartbeatMessage(info: LiveHeartbeatInfo): string {
  const minutes = Math.floor(info.silentForMs / 60_000);
  const seconds = Math.floor((info.silentForMs % 60_000) / 1000);
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const workers =
    info.running === 1
      ? "1 programador sigue trabajando"
      : `${info.running} programadores siguen trabajando`;
  return `[Auton] ${workers} (${clock} sin noticia). Nada requiere tu decisión; te aviso cuando cierre.`;
}

/**
 * Reloj del turno vivo. Lo alimenta el runtime de subagentes: `dispatch` cuando
 * arranca un worker, `close` cuando termina y `activity` cuando llega cualquier
 * mensaje suyo. Solo dispara si queda trabajo.
 */
export class AutonLiveLoop {
  private readonly heartbeatMs: number;
  private readonly onHeartbeat: (info: LiveHeartbeatInfo) => void;
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, delayMs: number) => { cancel: () => void };
  private running = 0;
  private lastActivityAt: number;
  private timer: { cancel: () => void } | null = null;
  private stopped = false;

  constructor(options: AutonLiveLoopOptions) {
    this.heartbeatMs = options.heartbeatMs ?? LIVE_HEARTBEAT_MS;
    this.onHeartbeat = options.onHeartbeat;
    this.now = options.now ?? (() => Date.now());
    this.schedule = options.schedule ?? defaultSchedule;
    this.lastActivityAt = this.now();
  }

  dispatch(): void {
    if (this.stopped) return;
    this.running += 1;
    this.touch();
  }

  activity(): void {
    if (this.stopped) return;
    this.touch();
  }

  close(): void {
    if (this.stopped) return;
    this.running = Math.max(0, this.running - 1);
    this.touch();
  }

  snapshot(): LiveLoopSnapshot {
    return {
      running: this.running,
      silentForMs: Math.max(0, this.now() - this.lastActivityAt),
      phase: this.running > 0 ? "working" : "idle",
    };
  }

  stop(): void {
    this.stopped = true;
    this.cancelTimer();
  }

  private touch(): void {
    this.lastActivityAt = this.now();
    this.reschedule();
  }

  private cancelTimer(): void {
    this.timer?.cancel();
    this.timer = null;
  }

  private reschedule(): void {
    this.cancelTimer();
    if (this.stopped || this.running <= 0) return;
    const silent = this.now() - this.lastActivityAt;
    const wait = Math.max(0, this.heartbeatMs - silent);
    this.timer = this.schedule(() => this.fire(), wait);
  }

  private fire(): void {
    this.timer = null;
    if (this.stopped || this.running <= 0) return;
    const silent = this.now() - this.lastActivityAt;
    if (silent >= this.heartbeatMs) {
      this.onHeartbeat({ running: this.running, silentForMs: silent });
      this.lastActivityAt = this.now();
    }
    this.reschedule();
  }
}
