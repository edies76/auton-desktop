import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectAnalysisPath } from "@zcode/shared/auton-project-facts";
import { buildOrchestratorSection } from "../src/auton/contextOrchestrator.js";
import { ContextBuilder } from "../src/context/builder.js";

const roots: string[] = [];

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "auton-orchestrator-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lunar",
      dependencies: { react: "^19.0.0" },
      devDependencies: { typescript: "^6.0.0" },
    }),
  );
  writeFileSync(join(root, "README.md"), "# Lunar\n");
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "state.ts"), "export const state = 1;\n");
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const staticSection = buildOrchestratorSection().content;

describe("el orquestador que sabe planear y conversar", () => {
  it("los cinco pasos están en el prompt y en orden", () => {
    const steps = [
      "Entender la intención",
      "Proponer alternativas",
      "Conversar sobre producto",
      "Construir el plan",
      "Mantenerlo vivo",
    ];
    const positions = steps.map((step) => staticSection.indexOf(step));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);

    // Entender la intención incluye la pregunta de producto con recomendación.
    expect(staticSection).toContain("¿retomar donde");
    expect(staticSection).toContain("Recomiendo retomar");
    // El plan pide resultados, prioridades, dependencias, encargos y prueba.
    expect(staticSection).toContain("resultados, prioridades, dependencias");
    expect(staticSection).toContain("cómo se comprobará cada entrega");
    expect(staticSection).toContain("hecho");
    expect(staticSection).toContain("observable");
    expect(staticSection).toContain("ese informe es un entregable propio");
    // Mantenerlo vivo actualiza sin empezar de cero.
    expect(staticSection).toContain("Nunca empieces");
  });

  it("la proporción es obligatoria y se justifica en una línea", () => {
    expect(staticSection).toContain("La proporción");
    expect(staticSection.toLowerCase()).toContain("un cambio de un botón o de un texto");
    expect(staticSection).toContain("modo de estudio de Lunar");
    expect(staticSection).toContain("es un archivo, así que un encargo");
    expect(staticSection).toContain("No infles lo pequeño ni aplanes lo grande");
  });

  it("se comporta como compañero: una pregunta con recomendación, alcance y aviso", () => {
    expect(staticSection).toContain("Pregunta una vez y con recomendación");
    expect(staticSection).toContain("no empieces explorando ni creando tareas");
    expect(staticSection).toContain("Di lo que NO vas a hacer en esta entrega");
    expect(staticSection).toContain("Admite lo que no sabes");
    expect(staticSection).toContain("Avisa antes de investigar");
    expect(staticSection).toContain("marca lo que viene de fuera");
  });

  it("el escaneo del proyecto entra en la sección y el análisis pendiente se anuncia", () => {
    const root = fixture();
    const section = buildOrchestratorSection({ workingDirectory: root }).content;

    expect(section).toContain("Lo que ya sabes del proyecto");
    expect(section).toContain("react");
    expect(section).toContain("typescript");
    expect(section).toContain("src/");
    expect(section).toContain("Falta el análisis del proyecto");
    expect(section).toContain("worker de solo lectura");
  });

  it("el análisis guardado por el worker se lee y deja de pedirse", () => {
    const root = fixture();
    mkdirSync(join(root, ".auton"), { recursive: true });
    writeFileSync(
      projectAnalysisPath(root),
      "El estado de estudio vive en src/state.ts; las sesiones se guardan por conversación.\n",
    );

    const section = buildOrchestratorSection({ workingDirectory: root }).content;
    expect(section).toContain("src/state.ts");
    expect(section).toContain("ya está en el registro: no lo vuelvas a pedir");
    expect(section).not.toContain("Falta el análisis del proyecto");
  });

  it("el prompt real ensambla la sección con el registro del proyecto", () => {
    const root = fixture();
    const builder = new ContextBuilder({
      workingDirectory: root,
      envInfo: {
        cwd: root,
        platform: "win32",
        shell: "pwsh",
        osVersion: "test",
        nodeVersion: "24",
      },
    });
    const built = builder.build();
    const text = built.sections.map((section) => section.content).join("\n");

    expect(text).toContain("Cómo planear y conversar");
    expect(text).toContain("Entender la intención");
    expect(text).toContain("Lo que ya sabes del proyecto");
    expect(text).toContain("Falta el análisis del proyecto");
  });
});
