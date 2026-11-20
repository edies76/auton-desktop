import { describe, expect, it } from "vitest";
import type { EventId, SessionEvent, SessionId, TraceId, TurnId } from "@zcode/contracts";
import { SessionEventType } from "@zcode/contracts";
import { ConversationTopicPublisher } from "../src/zcode-protocol-v4/index.js";

function event(seq: number, type: SessionEventType, payload: unknown): SessionEvent {
  return {
    id: `event-${seq}` as EventId,
    sessionId: "session-repro" as SessionId,
    turnId: "turn-repro" as TurnId,
    type,
    timestamp: new Date(1_700_000_000_000 + seq * 1000),
    traceId: "trace-repro" as TraceId,
    sequenceNumber: seq,
    payload,
  };
}

describe("notificaciones auton por el publisher real", () => {
  it("aplica encolado y lectura por el camino atómico (clone/adopt) sin romper", () => {
    const publisher = new ConversationTopicPublisher("session-repro", "epoch-repro", {
      now: () => 1_700_000_999_000,
    });
    publisher.ingest(event(1, SessionEventType.SessionCreated, { workingDirectory: "C:/tmp" }));
    publisher.ingest(event(2, SessionEventType.TurnStarted, { turnNumber: 1, input: "hola" }));
    publisher.ingest(
      event(3, SessionEventType.AutonNotificationQueued, {
        notificationId: "n-1",
        channel: "worker",
        origin: "auton-worker",
        text: "voy por el CSS",
        at: 1_700_000_003_000,
      }),
    );
    publisher.ingest(
      event(4, SessionEventType.AutonNotificationQueued, {
        notificationId: "n-2",
        channel: "external",
        origin: "agente externo",
        text: "terminé la revisión",
        at: 1_700_000_004_000,
      }),
    );
    publisher.ingest(
      event(5, SessionEventType.AutonNotificationRead, {
        notificationIds: ["n-1"],
        readAt: 1_700_000_005_000,
      }),
    );

    const snapshot = publisher.getSnapshot();
    const rows = snapshot.rows.window.filter((row) => row.kind === "autonNotification");
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => (row.kind === "autonNotification" ? row.channel : ""))).toEqual([
      "worker",
      "external",
    ]);
    expect(
      rows.map((row) => (row.kind === "autonNotification" ? row.readAt : undefined)),
    ).toEqual([1_700_000_005_000, undefined]);
  });
});
