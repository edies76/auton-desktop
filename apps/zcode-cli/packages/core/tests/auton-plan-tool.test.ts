import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { autonPlanToolEntry, resolveAutonPlanPath } from "../src/auton/plan-handler.js";
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

  it("round-trips versioned limits and their history", async () => {
    const dir = await makeWorkspace();
    const limits = {
      version: 2,
      maxAttempts: 3,
      approval: {
        deleteMove: true,
        outsideProject: true,
        pushMergeRebase: true,
        installDependencies: true,
        outsideScope: true,
      },
      unknownHandling: "wait",
    };
    const limitHistory = [
      {
        at: "2026-11-02T10:00:00.000Z",
        field: "unknownHandling",
        from: null,
        to: "wait",
        reason: "Dejar el item en espera y preguntar",
        approvedBy: "human",
      },
    ];

    await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Límites versionados" },
        limits,
        limitHistory,
        items: [{ id: "s1", title: "Aplicar límites", status: "waiting", questions: ["¿Cuál eliges?"] }],
      },
      context(dir),
    );

    const read = (await autonPlanToolEntry.handler({ action: "read" }, context(dir))) as {
      plan: {
        limits?: { version: number; unknownHandling: string };
        limitHistory: { field: string; approvedBy: string }[];
      };
    };
    expect(read.plan.limits?.version).toBe(2);
    expect(read.plan.limits?.unknownHandling).toBe("wait");
    expect(read.plan.limitHistory).toHaveLength(1);
    expect(read.plan.limitHistory[0]).toMatchObject({ field: "unknownHandling", approvedBy: "human" });
  });

  it("preserves the limit history when a write omits it", async () => {
    const dir = await makeWorkspace();
    const limitHistory = [
      {
        at: "2026-11-02T10:00:00.000Z",
        field: "maxAttempts",
        from: "3",
        to: "5",
        reason: "Más intentos para items con red",
        approvedBy: "human",
      },
    ];

    await autonPlanToolEntry.handler(
      {
        action: "write",
        limits: { version: 2, maxAttempts: 5, unknownHandling: "wait" },
        limitHistory,
        items: [{ id: "s1", title: "Uno", status: "ready" }],
      },
      context(dir),
    );
    await autonPlanToolEntry.handler(
      {
        action: "write",
        limits: { version: 2, maxAttempts: 5, unknownHandling: "wait" },
        items: [{ id: "s1", title: "Uno", status: "running" }],
      },
      context(dir),
    );

    const read = (await autonPlanToolEntry.handler({ action: "read" }, context(dir))) as {
      plan: { limitHistory: { field: string }[]; items: { status: string }[] };
    };
    expect(read.plan.limitHistory).toHaveLength(1);
    expect(read.plan.limitHistory[0]?.field).toBe("maxAttempts");
    expect(read.plan.items[0]?.status).toBe("running");
  });

  it("reads a legacy plan without limits and keeps it unversioned", async () => {
    const dir = await makeWorkspace();
    const path = resolveAutonPlanPath(dir);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(dir, ".auton"), { recursive: true });
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        goal: { title: "Plan anterior" },
        items: [{ id: "s1", title: "Viejo", status: "done" }],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const output = (await autonPlanToolEntry.handler({ action: "read" }, context(dir))) as {
      plan: { limits?: unknown; limitHistory: unknown[]; items: { id: string }[] };
    };
    expect(output.plan.limits).toBeUndefined();
    expect(output.plan.limitHistory).toEqual([]);
    expect(output.plan.items.map((item) => item.id)).toEqual(["s1"]);
  });

  it("falls back to an empty plan when the file is not valid JSON", async () => {
    const dir = await makeWorkspace();
    const path = resolveAutonPlanPath(dir);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(dir, ".auton"), { recursive: true });
    await writeFile(path, "{ not json", "utf8");

    const output = (await autonPlanToolEntry.handler({ action: "read" }, context(dir))) as {
      plan: { items: unknown[]; limitHistory: unknown[] };
    };
    expect(output.plan.items).toEqual([]);
    expect(output.plan.limitHistory).toEqual([]);
  });
});
