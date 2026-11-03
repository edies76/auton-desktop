import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureProjectFacts,
  projectAnalysisPath,
  projectFactsPath,
  renderProjectFactsForPrompt,
  scanProject,
} from "../src/auton/projectFacts.js";

const roots: string[] = [];

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "auton-facts-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lunar",
      dependencies: { react: "^19.0.0" },
      devDependencies: { typescript: "^6.0.0" },
    }),
  );
  writeFileSync(join(root, "tsconfig.json"), "{}");
  writeFileSync(join(root, "README.md"), "# Lunar\n");
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "index.ts"), "export const app = 1;\n");
  mkdirSync(join(root, "node_modules"));
  writeFileSync(join(root, "node_modules", "ignored.js"), "nope\n");
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "dist", "ignored.js"), "nope\n");
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("registro del proyecto: escaneo determinista", () => {
  it("detecta stack, tamaño y archivos clave sin modelo, ignorando ruido", () => {
    const root = fixture();
    const scan = scanProject(root);

    expect(scan.stack).toEqual(expect.arrayContaining(["node", "react", "typescript"]));
    expect(scan.fileCount).toBe(4);
    expect(scan.keyFiles).toEqual(
      expect.arrayContaining(["package.json", "tsconfig.json", "README.md", "src/"]),
    );
    expect(scan.keyFiles).not.toContain("node_modules/");
    expect(scan.topDirectories).toEqual(["src"]);
    expect(scan.totalBytes).toBeGreaterThan(0);
  });

  it("guarda el escaneo en .auton/project.json y no lo repite", () => {
    const root = fixture();
    const first = ensureProjectFacts(root);
    expect(first?.scan.fileCount).toBe(4);
    expect(projectFactsPath(root)).toBe(join(root, ".auton", "project.json"));

    const second = ensureProjectFacts(root);
    expect(second?.scan.scannedAt).toBe(first?.scan.scannedAt);
  });

  it("el prompt dice que falta el análisis y cómo guardarlo", () => {
    const root = fixture();
    const facts = ensureProjectFacts(root)!;
    const text = renderProjectFactsForPrompt(facts);

    expect(text).toContain("Stack:");
    expect(text).toContain("Falta el análisis del proyecto");
    expect(text).toContain(".auton/project-analysis.md");
    expect(text).toContain("worker de solo lectura");
    expect(text).toContain("no lo pidas otra vez");
  });

  it("cuando el worker ya guardó el resumen, el prompt lo lee y no lo vuelve a pedir", () => {
    const root = fixture();
    mkdirSync(join(root, ".auton"), { recursive: true });
    writeFileSync(
      projectAnalysisPath(root),
      "Lunar guarda el estado en src/state.ts y las sesiones en src/session.ts.\n",
    );
    const facts = ensureProjectFacts(root)!;
    const text = renderProjectFactsForPrompt(facts);

    expect(facts.analysis?.summary).toContain("src/state.ts");
    expect(text).toContain("ya está en el registro: no lo vuelvas a pedir");
    expect(text).not.toContain("Falta el análisis del proyecto");
  });

  it("un proyecto inexistente no rompe: devuelve un registro vacío", () => {
    const root = join(tmpdir(), `auton-missing-${Date.now()}`);
    expect(ensureProjectFacts(root)).toBeUndefined();
    const scan = scanProject(root);
    expect(scan.fileCount).toBe(0);
    expect(scan.stack).toEqual([]);
  });
});
