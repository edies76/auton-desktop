import { describe, expect, it } from "vitest";
import {
  AutonLiveLoop,
  LIVE_HEARTBEAT_MS,
  formatHeartbeatMessage,
} from "../src/auton/live-loop.js";

/** Reloj y planificador manuales: nada de esperas reales. */
function harness() {
  let now = 1_000_000;
  const timers: Array<{ callback: () => void; delay: number; cancelled: boolean }> = [];
  const heartbeats: Array<{ running: number; silentForMs: number }> = [];

  const loop = new AutonLiveLoop({
    onHeartbeat: (info) => heartbeats.push(info),
    now: () => now,
    schedule: (callback, delay) => {
      const timer = { callback, delay, cancelled: false };
      timers.push(timer);
      return {
        cancel: () => {
          timer.cancelled = true;
        },
      };
    },
  });

  const advance = (ms: number) => {
    now += ms;
    const pending = timers.splice(0);
    for (const timer of pending) {
      if (!timer.cancelled) {
        timer.cancelled = true;
        timer.callback();
      }
    }
  };

  return { loop, heartbeats, advance };
}

describe("latido del turno vivo", () => {
  it("no habla si no hay trabajo en curso", () => {
    const { heartbeats, advance } = harness();
    advance(LIVE_HEARTBEAT_MS * 3);
    expect(heartbeats).toHaveLength(0);
  });

  it("al despachar arranca el reloj y late a los 90 s de silencio", () => {
    const { loop, heartbeats, advance } = harness();

    loop.dispatch();
    expect(loop.snapshot().phase).toBe("working");

    advance(LIVE_HEARTBEAT_MS - 1);
    expect(heartbeats).toHaveLength(0);

    advance(1);
    expect(heartbeats).toHaveLength(1);
    expect(heartbeats[0]).toMatchObject({ running: 1, silentForMs: LIVE_HEARTBEAT_MS });
  });

  it("un mensaje del worker reinicia el silencio", () => {
    const { loop, heartbeats, advance } = harness();
    loop.dispatch();

    advance(60_000);
    loop.activity();
    advance(60_000);
    expect(heartbeats).toHaveLength(0);

    advance(30_000);
    expect(heartbeats).toHaveLength(1);
  });

  it("al cerrar el último canal se detiene", () => {
    const { loop, heartbeats, advance } = harness();
    loop.dispatch();
    loop.dispatch();
    loop.close();
    expect(loop.snapshot().running).toBe(1);

    loop.close();
    expect(loop.snapshot()).toMatchObject({ running: 0, phase: "idle" });

    advance(LIVE_HEARTBEAT_MS * 2);
    expect(heartbeats).toHaveLength(0);
  });

  it("sigue latiendo cada 90 s mientras haya trabajo", () => {
    const { loop, heartbeats, advance } = harness();
    loop.dispatch();
    advance(LIVE_HEARTBEAT_MS);
    advance(LIVE_HEARTBEAT_MS);
    expect(heartbeats).toHaveLength(2);
  });

  it("formatea el mensaje de estado con reloj y número de workers", () => {
    expect(formatHeartbeatMessage({ running: 1, silentForMs: 92_000 })).toContain("1 programador");
    expect(formatHeartbeatMessage({ running: 1, silentForMs: 92_000 })).toContain("01:32");
    expect(formatHeartbeatMessage({ running: 3, silentForMs: 90_000 })).toContain("3 programadores");
  });

  it("waitForIdle espera al último cierre del canal", async () => {
    const { loop } = harness();
    loop.dispatch();
    loop.dispatch();

    let resolved: boolean | null = null;
    const waiting = loop.waitForIdle({ timeoutMs: 5_000 }).then((value) => {
      resolved = value;
    });

    await Promise.resolve();
    expect(resolved).toBeNull();

    loop.close();
    await Promise.resolve();
    expect(resolved).toBeNull();

    loop.close();
    await waiting;
    expect(resolved).toBe(true);
  });

  it("waitForIdle vence por tiempo y devuelve false (nunca cuelga el turno)", async () => {
    const { loop } = harness();
    loop.dispatch();
    await expect(loop.waitForIdle({ timeoutMs: 10 })).resolves.toBe(false);
  });

  it("waitForIdle se libera al abortar el turno", async () => {
    const { loop } = harness();
    loop.dispatch();
    const controller = new AbortController();
    const waiting = loop.waitForIdle({ timeoutMs: 5_000, signal: controller.signal });
    controller.abort();
    await expect(waiting).resolves.toBe(false);
  });
});
