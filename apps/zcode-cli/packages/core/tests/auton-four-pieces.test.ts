import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { builtInTools } from "../src/tool/handlers/index.js";
import { buildAutonSection } from "../src/auton/contextAuton.js";
import { buildOrchestratorSection } from "../src/auton/contextOrchestrator.js";

const here = dirname(fileURLToPath(import.meta.url));
const builderSource = readFileSync(resolve(here, "../src/context/builder.ts"), "utf8");

const autonSection = buildAutonSection().content;
const orchestratorSection = buildOrchestratorSection().content;

/**
 * REGLA DE LAS CUATRO PIEZAS: handler, registro, línea de prompt y prueba.
 * Este archivo cubre la cuarta pieza de las capacidades del núcleo y comprueba
 * que la segunda y la tercera existen de verdad, no solo en un archivo suelto.
 */
describe("las cuatro piezas del núcleo", () => {
  it("AutonPlan y AutonRevert están registradas para el modelo", () => {
    const names = builtInTools.map((tool) => tool.metadata.name);
    expect(names).toContain("AutonPlan");
    expect(names).toContain("AutonRevert");

    for (const name of ["AutonPlan", "AutonRevert"]) {
      const entry = builtInTools.find((tool) => tool.metadata.name === name)!;
      expect(entry.metadata.description?.length ?? 0).toBeGreaterThan(80);
      expect(entry.inputSchema).toBeDefined();
    }
  });

  it("el prompt del orquestador dice CUÁNDO usar cada una", () => {
    expect(autonSection).toContain("AutonPlan");
    expect(autonSection).toContain("Antes de despachar");
    expect(autonSection).toContain("AutonRevert");
    expect(autonSection).toContain("deshacer el trabajo");
    // El esfuerzo es parámetro de la tool Agent, no texto del brief.
    expect(orchestratorSection).toContain("campo effort");
  });

  it("las dos secciones se ensamblan en el prompt real", () => {
    expect(builderSource).toContain("buildAutonSection()");
    expect(builderSource).toContain("buildOrchestratorSection({ workingDirectory:");
    expect(builderSource).toMatch(/sections\.push\(buildAutonSection\(\)\)/);
    expect(builderSource).toMatch(
      /sections\.push\(buildOrchestratorSection\(\{ workingDirectory: this\.config\.workingDirectory \}\)\)/,
    );
  });

  it("el contrato y el diario se nombran en el prompt (el orquestador sabe que existen)", () => {
    expect(autonSection).toContain(".auton/plan.json");
    expect(autonSection).toContain(".auton/changes.jsonl");
    expect(autonSection).toContain(".auton/reverts.jsonl");
  });

  it("los límites llegan al modelo: registro, prompt y prueba", () => {
    const plan = builtInTools.find((tool) => tool.metadata.name === "AutonPlan")!;
    const schema = JSON.stringify(plan.inputSchema);

    // Registro: la forma de los argumentos que el modelo ve.
    expect(schema).toContain("not_evaluable");
    expect(schema).toContain("attempts");
    expect(schema).toContain("limitReports");
    expect(plan.metadata.description).toContain("not_evaluable");
    expect(plan.metadata.description).toContain("limitReports");

    // Prompt: la sección ensamblada dice cuándo usarlos.
    expect(autonSection).toContain("not_evaluable");
    expect(autonSection).toContain("limitReports");
    expect(autonSection).toContain("Los intentos los cuenta el plan");

    // Prueba: la promesa está en el catálogo, no solo en el código.
    const pruebas = readFileSync(
      resolve(here, "../../../../../context/PRUEBAS-QUE-PROMETEMOS.md"),
      "utf8",
    );
    expect(pruebas).toContain("### 8. Los límites se escriben");
    expect(pruebas).toContain("### 9. Si no sabe decidir");
  });
});
