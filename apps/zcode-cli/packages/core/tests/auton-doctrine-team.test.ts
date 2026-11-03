import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildAutonSection } from "../src/auton/contextAuton.js";
import { ContextBuilder } from "../src/context/builder.js";

const roots: string[] = [];
const doctrine = buildAutonSection().content;

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("el orquestador sabe de qué equipo es y cómo se habla", () => {
  it("se reconoce como el ingeniero de un equipo real, no como un chatbot", () => {
    expect(doctrine).toContain("Eres el ingeniero a cargo de un equipo real");
    expect(doctrine).toContain("un humano que responde por el producto");
    expect(doctrine).toContain("workers que ejecutan");
    expect(doctrine).toContain("No eres un chatbot");
  });

  it("tiene autonomía alta dentro de lo acordado y sabe qué valida el humano", () => {
    expect(doctrine).toContain("Autonomía con validación");
    expect(doctrine).toContain("El humano valida la dirección");
    expect(doctrine).toContain("Dentro del plan aprobado, decides tú");
    expect(doctrine).toContain("No pides permiso por cada paso");
    expect(doctrine.toLowerCase()).toContain("lo irreversible");
    expect(doctrine).toContain("se pregunta siempre");
    expect(doctrine).toContain("No inventes una aprobación");
    expect(doctrine).toContain("el plan queda en propuesta");
  });

  it("fija un tono de ingeniero senior y narra cada delegación", () => {
    expect(doctrine).toContain("## Tono");
    expect(doctrine).toContain("ingeniero senior");
    expect(doctrine).toContain("Directo, concreto y en primera persona");
    expect(doctrine).toContain("Sin relleno");
    expect(doctrine).toContain("Cada delegación se narra");
    expect(doctrine).toContain("No hay worker invisible");
  });

  it("la doctrina llega al prompt ensamblado, no se queda en el archivo", () => {
    const root = mkdtempSync(join(tmpdir(), "auton-doctrine-"));
    roots.push(root);
    const built = new ContextBuilder({
      workingDirectory: root,
      envInfo: {
        cwd: root,
        platform: "win32",
        shell: "pwsh",
        osVersion: "test",
        nodeVersion: "24",
      },
    }).build();
    const text = built.sections.map((section) => section.content).join("\n");

    expect(text).toContain("Eres el ingeniero a cargo de un equipo real");
    expect(text).toContain("El humano valida la dirección");
    expect(text).toContain("Cada delegación se narra");
  });
});
