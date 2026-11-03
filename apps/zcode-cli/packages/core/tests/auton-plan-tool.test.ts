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
        limits: {
          version: 1,
          maxAttempts: 3,
          approval: {
            deleteMove: true,
            outsideProject: true,
            pushMergeRebase: true,
            installDependencies: true,
            outsideScope: true,
          },
          unknownHandling: "wait",
        },
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

  it("rejects dispatch without limits and counts attempts up to maxAttempts", async () => {
    const dir = await makeWorkspace();
    const noLimits = (await autonPlanToolEntry.handler(
      {
        action: "write",
        items: [{ id: "s1", title: "Despacho sin gobierno", status: "running" }],
      },
      context(dir),
    )) as { result?: boolean; errorCode?: number; message?: string };
    expect(noLimits.result).toBe(false);
    expect(noLimits.errorCode).toBe(42201);

    await autonPlanToolEntry.handler(
      {
        action: "write",
        limits: {
          version: 1,
          maxAttempts: 2,
          approval: {
            deleteMove: true,
            outsideProject: true,
            pushMergeRebase: true,
            installDependencies: true,
            outsideScope: true,
          },
          unknownHandling: "wait",
        },
        limitHistory: [],
        items: [{ id: "s1", title: "Contar intentos", status: "ready", attempts: 0 }],
      },
      context(dir),
    );
    await autonPlanToolEntry.handler(
      {
        action: "write",
        limits: { version: 1, maxAttempts: 2, unknownHandling: "wait" },
        items: [{ id: "s1", title: "Contar intentos", status: "running", attempts: 0 }],
      },
      context(dir),
    );
    const first = (await autonPlanToolEntry.handler({ action: "read" }, context(dir))) as {
      plan: { items: { attempts: number; status: string }[] };
    };
    expect(first.plan.items[0]?.attempts).toBe(1);
    expect(first.plan.items[0]?.status).toBe("running");

    await autonPlanToolEntry.handler(
      {
        action: "write",
        limits: { version: 1, maxAttempts: 2, unknownHandling: "wait" },
        items: [{ id: "s1", title: "Contar intentos", status: "blocked", attempts: 1 }],
      },
      context(dir),
    );
    await autonPlanToolEntry.handler(
      {
        action: "write",
        limits: { version: 1, maxAttempts: 2, unknownHandling: "wait" },
        items: [{ id: "s1", title: "Contar intentos", status: "running", attempts: 1 }],
      },
      context(dir),
    );
    const second = (await autonPlanToolEntry.handler({ action: "read" }, context(dir))) as {
      plan: { limits?: { version: number }; items: { attempts: number; status: string }[] };
    };
    expect(second.plan.items[0]?.attempts).toBe(2);

    await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Tercer intento" },
        limits: { version: 1, maxAttempts: 2, unknownHandling: "wait" },
        items: [{ id: "s1", title: "Contar intentos", status: "ready", attempts: 2 }],
      },
      context(dir),
    );
    await autonPlanToolEntry.handler(
      {
        action: "write",
        limits: { version: 1, maxAttempts: 2, unknownHandling: "wait" },
        items: [{ id: "s1", title: "Contar intentos", status: "running", attempts: 2 }],
      },
      context(dir),
    );
    const exceeded = (await autonPlanToolEntry.handler({ action: "read" }, context(dir))) as {
      plan: { items: { attempts: number; status: string }[] };
    };
    expect(exceeded.plan.items[0]?.attempts).toBe(2);
  });

  it("writes rejection carries an error code for unhandled dispatch", async () => {
    const dir = await makeWorkspace();
    await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Aprobación previa" },
        limits: {
          version: 1,
          maxAttempts: 3,
          unknownHandling: "wait",
          approval: {
            deleteMove: true,
            outsideProject: true,
            pushMergeRebase: true,
            installDependencies: true,
            outsideScope: true,
          },
        },
        limitHistory: [],
        items: [
          {
            id: "s1",
            title: "Borrar fuera del alcance",
            status: "ready",
            attempts: 0,
            needsApproval: ["deleteMove", "outsideScope"],
          },
        ],
      },
      context(dir),
    );

    const blocked = (await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Aprobación previa" },
        limits: {
          version: 1,
          maxAttempts: 3,
          unknownHandling: "wait",
          approval: {
            deleteMove: true,
            outsideProject: true,
            pushMergeRebase: true,
            installDependencies: true,
            outsideScope: true,
          },
        },
        items: [
          {
            id: "s1",
            title: "Borrar fuera del alcance",
            status: "running",
            attempts: 0,
            needsApproval: ["deleteMove", "outsideScope"],
          },
        ],
      },
      context(dir),
    )) as { result?: boolean; errorCode?: number };
    expect(blocked.result).toBe(false);
    expect(blocked.errorCode).toBe(42203);
  });

  it("rejects unrecorded limit changes and history rewrites", async () => {
    const dir = await makeWorkspace();
    const limitsV1 = {
      version: 1,
      maxAttempts: 3,
      unknownHandling: "wait" as const,
      approval: {
        deleteMove: true,
        outsideProject: true,
        pushMergeRebase: true,
        installDependencies: true,
        outsideScope: true,
      },
    };
    const limitsV2Silent = {
      ...limitsV1,
      version: 2,
      maxAttempts: 5,
    };
    await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Historial" },
        limits: limitsV1,
        limitHistory: [],
        items: [{ id: "s1", title: "Item", status: "ready", attempts: 0 }],
      },
      context(dir),
    );
    const silent = (await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Historial" },
        limits: limitsV2Silent,
        items: [{ id: "s1", title: "Item", status: "ready", attempts: 0 }],
      },
      context(dir),
    )) as { result?: boolean; errorCode?: number; message?: string };
    expect(silent.result).toBe(false);
    expect(silent.result).toBe(false);
    expect(silent.errorCode).toBe(42204);

    const recorded = (await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Historial" },
        limits: limitsV2Silent,
        limitHistory: [
          {
            at: "2026-11-02T11:00:00.000Z",
            field: "maxAttempts",
            from: "3",
            to: "5",
            reason: "Items con red necesitan más aire",
            approvedBy: "human",
          },
        ],
        items: [{ id: "s1", title: "Item", status: "ready", attempts: 0 }],
      },
      context(dir),
    )) as { plan?: { limits?: { version: number }; limitHistory: { field: string }[] } };
    expect(recorded.plan?.limits?.version).toBe(2);
    expect(recorded.plan?.limitHistory).toHaveLength(1);

    const rewritten = (await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Historial" },
        limits: limitsV2Silent,
        limitHistory: [],
        items: [{ id: "s1", title: "Item", status: "ready", attempts: 0 }],
      },
      context(dir),
    )) as { result?: boolean; errorCode?: number };
    expect(rewritten.result).toBe(false);
    expect(rewritten.errorCode).toBe(42204);
  });

  it("accepts not_evaluable with a question and rejects it mute", async () => {
    const dir = await makeWorkspace();
    const limits = {
      version: 1,
      maxAttempts: 3,
      unknownHandling: "wait" as const,
      approval: {
        deleteMove: true,
        outsideProject: true,
        pushMergeRebase: true,
        installDependencies: true,
        outsideScope: true,
      },
    };
    const mute = (await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "No evaluable mudo" },
        limits,
        limitHistory: [],
        items: [{ id: "s1", title: "Decisión de producto", status: "not_evaluable", attempts: 0 }],
      },
      context(dir),
    )) as { result?: boolean; errorCode?: number };
    expect(mute.result).toBe(false);
    expect(mute.errorCode).toBe(42206);

    const spoken = (await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "No evaluable mudo" },
        limits,
        limitHistory: [],
        items: [
          {
            id: "s1",
            title: "Decisión de producto",
            status: "not_evaluable",
            attempts: 0,
            questions: ["¿La pantalla va con el diseño nuevo o con el actual?"],
          },
        ],
      },
      context(dir),
    )) as { summary?: { notEvaluable: number } };
    expect(spoken.summary?.notEvaluable).toBe(1);
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
        limits?: { version: number; unknownHandling: string; maxAttempts: number };
        limitHistory: { field: string; approvedBy: string }[];
      };
    };
    expect(read.plan.limits?.version).toBe(2);
    expect(read.plan.limits?.unknownHandling).toBe("wait");
    expect(read.plan.limits?.maxAttempts).toBe(3);
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
