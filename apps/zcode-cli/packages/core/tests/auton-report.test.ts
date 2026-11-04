import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { autonPlanToolEntry, resolveAutonPlanPath } from "../src/auton/plan-handler.js";
import { autonReportToolEntry } from "../src/auton/report-handler.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-report-"));
  workspaces.push(dir);
  return dir;
}

function context(workingDirectory: string, sessionId = "sess_auton_worker"): ToolExecutionContext {
  return { workingDirectory, workspaceRoot: workingDirectory, sessionId } as unknown as ToolExecutionContext;
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("AutonReport", () => {
  it("appends a worker report without touching limits or items", async () => {
    const dir = await makeWorkspace();
    await autonPlanToolEntry.handler(
      {
        action: "write",
        limits: { version: 1, maxAttempts: 3, unknownHandling: "wait" },
        items: [{ id: "s1", title: "Revisar", status: "running" }],
      },
      context(dir, "sess_orchestrator"),
    );

    const output = (await autonReportToolEntry.handler(
      {
        field: "maxAttempts",
        observed: "el item necesitó cinco intentos",
        expected: "cinco intentos",
        note: "el tercero falló por una dependencia externa",
      },
      context(dir),
    )) as { report: { field: string; by: string; observed: string } };

    expect(output.report.field).toBe("maxAttempts");
    expect(output.report.by).toBe("sess_auton_worker");
    const plan = JSON.parse(await readFile(resolveAutonPlanPath(dir), "utf8")) as {
      items: Array<{ id: string; status: string }>;
      limits: { maxAttempts: number; version: number };
      limitReports: Array<{ field: string; observed: string }>;
    };
    expect(plan.items).toEqual([{ id: "s1", title: "Revisar", status: "running", attempts: 1 }]);
    expect(plan.limits).toMatchObject({ version: 1, maxAttempts: 3 });
    expect(plan.limitReports).toHaveLength(1);
    expect(plan.limitReports[0]).toMatchObject({
      field: "maxAttempts",
      observed: "el item necesitó cinco intentos",
    });
  });
});
