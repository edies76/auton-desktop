import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createAutonNotificationRegistry } from "@zcode/shared/auton-notifications";
import { NotificationChannelsPanel } from "../src/auton/NotificationChannelsPanel.js";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * La superficie real de los dos canales: contador de no leídas, detalle y paso a
 * leído cuando se ejecuta la operación real de lectura (el mismo `read` del
 * registro que usa la tool del orquestador). Sin reimplementar el reductor.
 */
describe("panel de canales del orquestador", () => {
  it("la conversación monta el panel sobre las filas reales de notificación", () => {
    const paneSource = readFileSync(resolve(here, "../src/v4/SessionPane.tsx"), "utf8");
    expect(paneSource).toContain("NotificationChannelsPanel");
    expect(paneSource).toContain('row.kind === "autonNotification"');
    expect(paneSource).toContain("{notificationChannels}");

    const unitsSource = readFileSync(
      resolve(here, "../src/v4/conversationTurnRenderUnits.ts"),
      "utf8",
    );
    // Las filas de notificación no duplican contenido dentro del hilo.
    expect(unitsSource).toContain('row.kind !== "autonNotification"');
  });

  it("muestra los dos canales, sus no leídas y cambia a leído tras la lectura real", () => {
    const registry = createAutonNotificationRegistry({ now: () => 1000 });
    registry.enqueue({
      channel: "worker",
      origin: "auton-worker",
      text: "voy por el CSS, faltan dos secciones",
    });
    registry.enqueue({
      channel: "external",
      origin: "Sesión de documentación",
      text: "terminé la revisión del README",
    });

    const before = renderToStaticMarkup(
      <NotificationChannelsPanel notifications={registry.list()} />,
    );
    expect(before).toContain('data-testid="auton-notification-channels"');
    expect(before).toContain("Workers");
    expect(before).toContain("Agentes externos");
    expect(before).toContain('data-testid="auton-channel-unread-worker"');
    expect(before).toMatch(/auton-channel-unread-worker"[^>]*>1</);
    expect(before).toMatch(/auton-channel-unread-external"[^>]*>1</);
    expect(before).toContain("voy por el CSS, faltan dos secciones");
    expect(before).toContain("terminé la revisión del README");
    expect(before).toContain("nuevo");

    // Operación real de lectura: solo el canal de workers.
    const read = registry.read("worker");
    expect(read.map((item) => item.text)).toEqual(["voy por el CSS, faltan dos secciones"]);

    const after = renderToStaticMarkup(
      <NotificationChannelsPanel notifications={registry.list()} />,
    );
    expect(after).toMatch(/auton-channel-unread-worker"[^>]*>0</);
    expect(after).toMatch(/auton-channel-unread-external"[^>]*>1</);
    // El contenido leído sigue visible, marcado como leído.
    expect(after).toContain("voy por el CSS, faltan dos secciones");
    expect(after).toContain("leído");
    // El canal externo sigue pendiente.
    expect(after).toContain("terminé la revisión del README");
    expect(after).toContain("nuevo");
  });
});
