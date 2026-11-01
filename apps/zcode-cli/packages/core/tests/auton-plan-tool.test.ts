import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { autonPlanToolEntry, resolveAutonPlanPath } from "../src/tool/handlers/auton-plan.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-plan-"));
  workspaces.push(dir);
  return dir;
}

function context(workingDirectory: string): ToolExecutionContext {
  return { workingDirectory, workspaceRoot: workingDirectory } as unknown as ToolExecutionContext;
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("AutonPlan tool", () => {
  it("reads an empty plan when the project has none", async () => {
    const dir = await makeWorkspace();
    const output = (await autonPlanToolEntry.handler(
      { action: "read" },
      context(dir),
    )) as { path: string; plan: { items: unknown[] }; summary: { total: number } };

    expect(output.path).toBe(resolveAutonPlanPath(dir));
    expect(output.plan.items).toEqual([]);
    expect(output.summary.total).toBe(0);
  });

  it("writes the complete plan to .auton/plan.json and reads it back", async () => {
    const dir = await makeWorkspace();
    const items = [
      {
        id: "s1",
        title: "Separar el estado del plan",
        status: "running",
        effort: "standard",
        files: ["packages/ui/src/auton/plan.ts"],
      },
      { id: "s2", title: "Verificador independiente", status: "waiting", questions: ["¿Qué DoD?"] },
    ];

    const written = (await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Auton medianamente funcional", constraints: ["sin tocar la UI base"] },
        items,
      },
      context(dir),
    )) as { path: string; summary: { total: number; running: number; waiting: number } };

    expect(written.summary).toMatchObject({ total: 2, running: 1, waiting: 1 });

    const onDisk = JSON.parse(await readFile(resolveAutonPlanPath(dir), "utf8")) as {
      version: number;
      goal: { title: string };
      items: { id: string; status: string }[];
      updatedAt: string;
    };
    expect(onDisk.version).toBe(1);
    expect(onDisk.goal.title).toBe("Auton medianamente funcional");
    expect(onDisk.items.map((item) => item.id)).toEqual(["s1", "s2"]);
    expect(typeof onDisk.updatedAt).toBe("string");

    const read = (await autonPlanToolEntry.handler({ action: "read" }, context(dir))) as {
      plan: { goal: { title: string }; items: { id: string; status: string }[] };
    };
    expect(read.plan.goal.title).toBe("Auton medianamente funcional");
    expect(read.plan.items.map((item) => item.status)).toEqual(["running", "waiting"]);
  });

  it("falls back to an empty plan when the file is not valid JSON", async () => {
    const dir = await makeWorkspace();
    const path = resolveAutonPlanPath(dir);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(dir, ".auton"), { recursive: true });
    await writeFile(path, "{ not json", "utf8");

    const output = (await autonPlanToolEntry.handler({ action: "read" }, context(dir))) as {
      plan: { items: unknown[] };
    };
    expect(output.plan.items).toEqual([]);
  });
});
