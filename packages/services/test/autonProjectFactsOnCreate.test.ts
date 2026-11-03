import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fixture, port } from "#src/project-storage/test-fixture.js";

const roots: string[] = [];

function projectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "auton-create-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "lunar", dependencies: { react: "^19.0.0" } }),
  );
  writeFileSync(join(root, "README.md"), "# Lunar\n");
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("registro del proyecto al crear", () => {
  it("escribe el escaneo en .auton/project.json sin modelo", async () => {
    const { db, context } = await fixture();
    await port.migrate(db, context);
    const root = projectRoot();

    port.repository(db).saveProject({ roots: [root] });

    const facts = JSON.parse(
      readFileSync(join(root, ".auton", "project.json"), "utf8"),
    ) as {
      stack: string[];
      fileCount: number;
      keyFiles: string[];
    };
    expect(facts.stack).toEqual(expect.arrayContaining(["node", "react"]));
    expect(facts.fileCount).toBe(2);
    expect(facts.keyFiles).toEqual(expect.arrayContaining(["package.json", "README.md"]));
  });

  it("un root inexistente no rompe la creación ni escribe un registro falso", async () => {
    const { db, context } = await fixture();
    await port.migrate(db, context);

    const project = port.repository(db).saveProject({ roots: ["/workspace/missing"] });
    expect(project.roots).toHaveLength(1);
  });
});
