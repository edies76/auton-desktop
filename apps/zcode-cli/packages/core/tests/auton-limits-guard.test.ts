import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { autonPlanHandler, resolveAutonPlanPath } from "../src/auton/plan-handler.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-limits-guard-"));
  workspaces.push(dir);
  return dir;
}

function context(workspaceRoot: string, sessionId: string): ToolExecutionContext {
  return { workingDirectory: workspaceRoot, workspaceRoot, sessionId } as unknown as ToolExecutionContext;
}

const LIMITS = {
  version: 1,
  maxAttempts: 3,
  approval: {
    deleteMove: true,
    outsideProject: true,
    pushMergeRebase: true,
    installDependencies: true,
    outsideScope: true,
  },
  unknownHandling: "wait" as const,
};

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("límites del plan", () => {
  it("el orquestador los escribe y quedan versionados con su historial", async () => {
    const root = await workspace();

    await autonPlanHandler(
      {
        action: "write",
        goal: { title: "landing" },
        limits: LIMITS,
        limitHistory: [
          {
            at: "2026-11-02T20:00:00.000Z",
            field: "unknownHandling",
            from: null,
            to: "wait",
            reason: "no sé decidir → espera al humano",
            approvedBy: "human",
          },
        ],
        items: [{ id: "s1", title: "index.html", status: "ready" }],
      },
      context(root, "sess_orchestrator"),
    );

    const onDisk = JSON.parse(await readFile(resolveAutonPlanPath(root), "utf8")) as {
      limits: { version: number; unknownHandling: string };
      limitHistory: unknown[];
    };
    expect(onDisk.limits.version).toBe(1);
    expect(onDisk.limits.unknownHandling).toBe("wait");
    expect(onDisk.limitHistory).toHaveLength(1);
  });

  it("rechaza que un programador cambie los límites y no toca el archivo", async () => {
    const root = await workspace();
    await autonPlanHandler(
      {
        action: "write",
        goal: { title: "landing" },
        limits: LIMITS,
        items: [{ id: "s1", title: "index.html", status: "running" }],
      },
      context(root, "sess_orchestrator"),
    );

    await expect(
      autonPlanHandler(
        {
          action: "write",
          goal: { title: "landing" },
          limits: { ...LIMITS, maxAttempts: 9 },
          items: [{ id: "s1", title: "index.html", status: "running" }],
        },
        context(root, "sess_auton_prog1"),
      ),
    ).rejects.toThrow(/programador no puede cambiar los límites/);

    const onDisk = JSON.parse(await readFile(resolveAutonPlanPath(root), "utf8")) as {
      limits: { maxAttempts: number };
    };
    expect(onDisk.limits.maxAttempts).toBe(3);
  });

  it("deja que un programador actualice items mientras los límites no cambien", async () => {
    const root = await workspace();
    await autonPlanHandler(
      {
        action: "write",
        goal: { title: "landing" },
        limits: LIMITS,
        items: [{ id: "s1", title: "index.html", status: "running" }],
      },
      context(root, "sess_orchestrator"),
    );

    const written = (await autonPlanHandler(
      {
        action: "write",
        goal: { title: "landing" },
        limits: LIMITS,
        items: [{ id: "s1", title: "index.html", status: "done" }],
      },
      context(root, "sess_auton_prog1"),
    )) as { plan: { items: { status: string }[] } };

    expect(written.plan.items[0]?.status).toBe("done");
  });
});
