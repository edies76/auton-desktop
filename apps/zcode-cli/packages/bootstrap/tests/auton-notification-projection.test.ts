import { describe, expect, it } from "vitest";
import { SessionEventType, type SessionEvent } from "@zcode/contracts";
import type { AutonNotificationRow } from "@zcode/shared/zcode-protocol-v4";
import { ProductProjection } from "../src/zcode-protocol-v4/index.js";

function fixture() {
  const projection = new ProductProjection("session", "epoch");
  let sequence = 0;
  const apply = (type: SessionEvent["type"], payload: unknown) => {
    const event = {
      id: `event-${++sequence}`,
      sessionId: "session",
      turnId: "turn_notifications",
      traceId: "trace",
      timestamp: new Date(1_700_000_000_000 + sequence * 1000),
      sequenceNumber: sequence,
      type,
      payload,
    } as SessionEvent;
    const deltas = projection.applyEvent(event);
    return deltas;
  };
  apply(SessionEventType.SessionCreated, { mode: "auton", contextWindow: 200_000 });
  apply(SessionEventType.TurnStarted, { turnNumber: 1, input: "sigue", messageId: "user-1" });
  return { projection, apply };
}

function notificationRows(projection: ProductProjection): AutonNotificationRow[] {
  return projection
    .getSnapshot()
    .rows.window.filter((row): row is AutonNotificationRow => row.kind === "autonNotification");
}

describe("proyección de los dos canales en el hilo", () => {
  it("encola las notificaciones con su canal y las marca leídas al leer", () => {
    const { projection, apply } = fixture();
    apply(SessionEventType.AutonNotificationQueued, {
      notificationId: "n-1",
      channel: "worker",
      origin: "auton-worker",
      text: "avance del worker",
      at: 1_700_000_001_000,
    });
    apply(SessionEventType.AutonNotificationQueued, {
      notificationId: "n-2",
      channel: "external",
      origin: "otra sesión",
      text: "aviso externo",
      at: 1_700_000_002_000,
    });

    const rows = notificationRows(projection);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.channel)).toEqual(["worker", "external"]);
    expect(rows.map((row) => row.origin)).toEqual(["auton-worker", "otra sesión"]);
    expect(rows.every((row) => row.readAt === undefined)).toBe(true);

    apply(SessionEventType.AutonNotificationRead, {
      notificationIds: ["n-1"],
      channel: "worker",
      readAt: 1_700_000_009_000,
    });

    const after = notificationRows(projection);
    const worker = after.find((row) => row.notificationId === "n-1");
    const external = after.find((row) => row.notificationId === "n-2");
    expect(worker?.readAt).toBe(1_700_000_009_000);
    expect(external?.readAt).toBeUndefined();
  });
});
