import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const runnerSource = readFileSync(resolve(here, "../src/subagent/runner.ts"), "utf8");

/**
 * El latido se engancha en el camino real del subagente: arranque en background
 * y los dos cierres (completado y fallido). Sin esto el reloj existiría pero
 * nunca se alimentaría.
 */
describe("enganche del latido en el runner de subagentes", () => {
  it("arranca el reloj al despachar un worker en background", () => {
    expect(runnerSource).toMatch(
      /const output = createAgentBackgroundedOutput\(request, lifecycle\);[\s\S]{0,400}autonLiveLoopFor\([\s\S]{0,200}\)\.dispatch\(\);/,
    );
  });

  it("cierra el reloj al completar y al fallar", () => {
    const closes = runnerSource.match(/autonLiveLoopFor\([\s\S]{0,200}\)\.close\(\);/g) ?? [];
    expect(closes.length).toBeGreaterThanOrEqual(2);
    expect(runnerSource).toContain("finalizeBackgroundCompletion");
    expect(runnerSource).toContain("finalizeBackgroundFailure");
  });

  it("el latido entra por la cola del orquestador, no como mensaje del humano", () => {
    expect(runnerSource).toContain("formatHeartbeatMessage");
    expect(runnerSource).toMatch(/enqueue\?\.\(\{[\s\S]{0,300}backgroundSource: "subagent"/);
  });

  it("el turno cierra y el evento del worker lo despierta por la cola", () => {
    const turnLoop = readFileSync(
      resolve(here, "../src/runtime/methods/turn-loop.ts"),
      "utf8",
    );
    // El turno no se queda esperando: cierra para que el humano pueda escribir.
    expect(turnLoop).not.toContain("waitForAutonIdle(");
    // La notificación del worker entra por la cola de comandos del runtime,
    // que abre un turno nuevo.
    const backgroundNotifications = readFileSync(
      resolve(here, "../src/runtime/methods/background-notifications.ts"),
      "utf8",
    );
    expect(backgroundNotifications).toContain("enqueueRuntimeCommand(");
  });
});
