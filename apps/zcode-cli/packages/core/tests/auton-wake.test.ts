import { describe, expect, it } from "vitest";
import {
  AUTON_WAKE_WINDOW_MS,
  formatAutonWakeNotice,
  resetAutonWakeWindow,
  shouldWakeOrchestrator,
} from "../src/auton/wake.js";

describe("despertador del orquestador", () => {
  it("un aviso despierta y los siguientes dentro de la ventana se absorben", () => {
    const session = "auton-wake-unit";
    resetAutonWakeWindow(session);
    const t0 = 1_000_000;
    expect(shouldWakeOrchestrator(session, t0, 60_000)).toBe(true);
    expect(shouldWakeOrchestrator(session, t0 + 1_000, 60_000)).toBe(false);
    expect(shouldWakeOrchestrator(session, t0 + 59_999, 60_000)).toBe(false);
    // Pasada la ventana, el siguiente aviso vuelve a despertar.
    expect(shouldWakeOrchestrator(session, t0 + 60_000, 60_000)).toBe(true);
    // Y la ventana es por sesión, no global.
    expect(shouldWakeOrchestrator("otra-sesion", t0 + 60_001, 60_000)).toBe(true);
    expect(AUTON_WAKE_WINDOW_MS).toBe(60_000);
  });

  it("la guía del despertar no lleva contenido, solo el estado de los canales", () => {
    const notice = formatAutonWakeNotice([
      { channel: "worker", unread: 2, total: 3 },
      { channel: "external", unread: 1, total: 1 },
    ]);
    expect(notice).toContain("avisos sin leer");
    expect(notice).toContain("Workers: 2");
    expect(notice).toContain("Agentes externos: 1");
    expect(notice).toContain("AutonNotifications");
    expect(formatAutonWakeNotice([])).toContain("avisos sin leer");
  });
});
