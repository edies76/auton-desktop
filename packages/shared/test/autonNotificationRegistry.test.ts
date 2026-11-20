import { describe, expect, it, vi } from "vitest";
import {
  channelLabel,
  createAutonNotificationRegistry,
  enqueueNotification,
  readNotifications,
  summarizeNotifications,
  type AutonNotification,
} from "../src/auton/notificationRegistry.js";

function idFactory(): () => string {
  let sequence = 0;
  return () => `n-${++sequence}`;
}

describe("registro de notificaciones del orquestador", () => {
  it("encola en dos canales con origen, hora y estado no leído", () => {
    const list = enqueueNotification(
      enqueueNotification([], { channel: "worker", origin: "auton-worker", text: "listo" }, 10, idFactory()),
      { channel: "external", origin: "otra sesión", text: "aviso" },
      20,
      idFactory(),
    ) as readonly AutonNotification[];

    expect(list).toHaveLength(2);
    expect(list.map((item) => item.channel)).toEqual(["worker", "external"]);
    expect(list.map((item) => item.origin)).toEqual(["auton-worker", "otra sesión"]);
    expect(list.every((item) => item.readAt === undefined)).toBe(true);
    expect(summarizeNotifications(list)).toEqual([
      { channel: "worker", unread: 1, total: 1 },
      { channel: "external", unread: 1, total: 1 },
    ]);
  });

  it("la lectura explícita por canal devuelve contenido y marca leído; no toca el otro canal", () => {
    const registry = createAutonNotificationRegistry({ now: () => 100 });
    registry.enqueue({ channel: "worker", origin: "w1", text: "uno" });
    registry.enqueue({ channel: "worker", origin: "w2", text: "dos" });
    registry.enqueue({ channel: "external", origin: "e1", text: "tres" });

    const workers = registry.read("worker");
    expect(workers.map((item) => item.text)).toEqual(["uno", "dos"]);
    expect(workers.every((item) => item.readAt === 100)).toBe(true);
    expect(registry.summaries()).toEqual([
      { channel: "worker", unread: 0, total: 2 },
      { channel: "external", unread: 1, total: 1 },
    ]);

    // Segunda lectura del mismo canal no devuelve nada.
    expect(registry.read("worker")).toEqual([]);
    // El canal externo sigue pendiente y se lee después.
    const external = registry.read("external");
    expect(external.map((item) => item.text)).toEqual(["tres"]);
    expect(registry.unread()).toEqual([]);
  });

  it("leer los dos canales los marca todos; el reductor puro no muta la lista", () => {
    const original = enqueueNotification([], { channel: "worker", origin: "w", text: "uno" }, 1, idFactory());
    const result = readNotifications(
      [...original, { id: "n-2", channel: "external", origin: "e", text: "dos", at: 2 }],
      undefined,
      5,
    );
    expect(original[0]?.readAt).toBeUndefined();
    expect(result.read).toHaveLength(2);
    expect(result.list.every((item) => item.readAt === 5)).toBe(true);
  });

  it("notifica a los suscriptores al encolar y al leer", () => {
    const registry = createAutonNotificationRegistry({ now: () => 7 });
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.enqueue({ channel: "worker", origin: "w", text: "uno" });
    expect(listener).toHaveBeenCalledTimes(1);
    registry.read("worker");
    expect(listener).toHaveBeenCalledTimes(2);
    // Leer sin nada nuevo no emite.
    registry.read("worker");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    registry.enqueue({ channel: "external", origin: "e", text: "dos" });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("etiqueta legible por canal", () => {
    expect(channelLabel("worker")).toBe("Workers");
    expect(channelLabel("external")).toBe("Agentes externos");
  });
});
