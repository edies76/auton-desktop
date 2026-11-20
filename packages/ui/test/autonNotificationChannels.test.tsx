import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createAutonNotificationRegistry } from "@zcode/shared/auton-notifications";
import {
  NotificationChannelsPanel,
  notificationDisplayText,
} from "../src/auton/NotificationChannelsPanel.js";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * La superficie real de los dos canales: contador de no leídas, detalle y paso a
 * leído cuando se ejecuta la operación real de lectura (el mismo `read` del
 * registro que usa la tool del orquestador). Sin reimplementar el reductor.
 */
describe("panel de canales del orquestador", () => {
  it("la fila muestra el hecho legible, no el envoltorio crudo de la tarea", () => {
    const raw = [
      "<task-notification>",
      "<task-id>exec_854b75fd-4157-495d-a71a-0e17dbb56a45</task-id>",
      "<status>completed</status>",
      '<summary>Background command "esperar 5 segundos" completed (exit code 0)</summary>',
      "</task-notification>",
    ].join("\n");
    expect(notificationDisplayText(raw)).toBe(
      'Background command "esperar 5 segundos" completed (exit code 0)',
    );
    // Entidades (incluido el doble escape real) quedan decodificadas.
    expect(
      notificationDisplayText(
        "<task-notification><summary>envió &amp;quot;prueba&amp;quot; al orquestador</summary></task-notification>",
      ),
    ).toBe('envió "prueba" al orquestador');
    // Sin summary: se quitan etiquetas y se colapsa el espacio.
    expect(
      notificationDisplayText("<task-notification><status>completed</status></task-notification>"),
    ).toBe("completed");
    // Texto llano del canal de worker pasa tal cual.
    expect(notificationDisplayText("voy por el CSS")).toBe("voy por el CSS");
  });

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
    expect(before).toContain('data-testid="auton-notification-channels-toggle"');
    // La tarjeta opaca del dock, como el resto de superficies de la conversación.
    expect(before).toContain("rounded-xl border border-border bg-card");
    expect(before).toContain("Workers");
    expect(before).toContain("Agentes externos");
    expect(before).toContain('data-testid="auton-channel-unread-worker"');
    expect(before).toMatch(/auton-channel-unread-worker"[^>]*>1</);
    expect(before).toMatch(/auton-channel-unread-external"[^>]*>1</);
    expect(before).toContain("voy por el CSS, faltan dos secciones");
    expect(before).toContain("terminé la revisión del README");
    // El texto crudo solo vive en el tooltip de la fila.
    expect(before).toContain('title="terminé la revisión del README"');
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
