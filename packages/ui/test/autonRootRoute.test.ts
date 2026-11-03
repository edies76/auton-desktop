import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootSource = readFileSync(
  fileURLToPath(new URL("../src/Root.tsx", import.meta.url)),
  "utf8",
);

/**
 * Verificación estática de la rama de entrada. La app real requiere Electron
 * y los servicios del host; aquí se comprueba que la ruta y el bypass existen
 * en el código que se sirve.
 */
describe("entrada de Auton en Root", () => {
  it("la lista es la ruta por defecto y ?auton=zcode conserva el shell", () => {
    expect(rootSource).toContain('get("auton") !== "zcode"');
    expect(rootSource).toContain("AutonProjectList");
    expect(rootSource).toContain("AutonProjectSpaceRoute");
    expect(rootSource).toContain("autonBypass");
    expect(rootSource).toContain("handleSelectProject");
  });
});
