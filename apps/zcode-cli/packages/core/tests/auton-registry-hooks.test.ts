// ============================================================
// Registro durable de Auton — hooks de plan y reversión (Nivel 1C)
// ============================================================
// Los hooks solo anexan lo que cambió, con ids deterministas e idempotencia.
// Nunca escriben before/after ni el contenido de archivos.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AutonPlanSchema,
  type AutonPlan,
} from "@zcode/contracts";
import { autonPlanToolEntry } from "../src/auton/plan-handler.js";
import { autonRevertHandler } from "../src/auton/revert-handler.js";
import { recordFileChange } from "../src/auton/journal.js";
import { recordPlanWrite, recordRevert, type AutonRevertResult } from "../src/auton/registry-hooks.js";
import type { RevertExecution } from "../src/auton/revert-executor.js";
import {
  readRegistryLog,
  registryLogPath,
} from "../src/auton/registry-store.js";
import {
  readRegistryIndex,
  registryIndexPath,
} from "../src/auton/registry-index.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];
const FIXED_AT = "2026-11-04T12:00:00.000Z";

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-registry-hooks-"));
  workspaces.push(dir);
  return dir;
}

function context(workspaceRoot: string): ToolExecutionContext {
  return {
    workingDirectory: workspaceRoot,
    workspaceRoot,
    sessionId: "sess_orchestrator",
  } as unknown as ToolExecutionContext;
}

function plan(input: unknown): AutonPlan {
  return AutonPlanSchema.parse(input) as AutonPlan;
}

function emptyPlan(): AutonPlan {
  return plan({ version: 1, limitHistory: [], limitReports: [], items: [] });
}

function limitChange(overrides: Record<string, unknown> = {}) {
  return {
    at: FIXED_AT,
    field: "approval.deleteMove",
    from: "true",
    to: "false",
    reason: "el humano delegó los borrados pequeños",
    approvedBy: "human" as const,
    ...overrides,
  };
}

function limitReport(overrides: Record<string, unknown> = {}) {
  return {
    at: FIXED_AT,
    field: "maxAttempts",
    observed: "3 intentos agotados",
    expected: "5",
    by: "prog1",
    ...overrides,
  };
}

async function logLines(root: string): Promise<string[]> {
  const raw = await readFile(registryLogPath(root), "utf8");
  return raw.split("\n").filter((line) => line.length > 0);
}

function execution(
  selection: { agentId?: string; itemId?: string; paths?: string[]; all?: boolean },
  result: AutonRevertResult = "reverted",
): RevertExecution {
  const files = [{ path: "src/login.ts", outcome: "reverted" }];
  return {
    results: files,
    reverted: result === "reverted" ? 1 : 0,
    already: result === "already" ? 1 : 0,
    conflicts: result === "partial" ? 1 : 0,
    blocked: result === "blocked" ? 1 : 0,
    auditPath: join(".auton", "reverts.jsonl"),
    audit: { at: FIXED_AT, selection, files },
  };
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("hooks del registro durable (Nivel 1C)", () => {
  it("un plan nuevo anexa goal, dispatch/sprint, decision y report", async () => {
    const root = await workspace();
    const next = plan({
      version: 1,
      goal: {
        title: "Memoria durable",
        statement: "Registrar lo que pasó",
        constraints: ["sin UI"],
        done: ["el registro tiene eventos"],
      },
      limitHistory: [limitChange()],
      limitReports: [limitReport()],
      items: [
        {
          id: "s1",
          title: "Escribir el hook",
          status: "running",
          owner: "programmer",
          files: ["src/a.ts"],
        },
      ],
    });

    const results = recordPlanWrite({
      workspaceRoot: root,
      previous: emptyPlan(),
      plan: next,
      now: new Date(FIXED_AT),
    });
    const log = readRegistryLog(root);

    expect(results.every((result) => result.appended)).toBe(true);
    expect(log.records.map((record) => record.kind)).toEqual([
      "goal",
      "dispatch",
      "decision",
      "report",
    ]);
    expect(log.records[0]?.source).toBe("plan.json:goal");
    expect(log.records[1]?.summary).toContain("running");
  });

  it("repetir exactamente el mismo plan no anexa nada nuevo", async () => {
    const root = await workspace();
    const next = plan({
      goal: { title: "Sin duplicados" },
      items: [{ id: "s1", title: "Un item", status: "ready" }],
    });

    recordPlanWrite({ workspaceRoot: root, previous: emptyPlan(), plan: next, now: new Date(FIXED_AT) });
    const before = await logLines(root);
    const results = recordPlanWrite({
      workspaceRoot: root,
      previous: next,
      plan: next,
      now: new Date(FIXED_AT),
    });

    expect(results).toEqual([]);
    expect(await logLines(root)).toHaveLength(before.length);
  });

  it("cambiar el status de un item anexa un evento nuevo y conserva el anterior", async () => {
    const root = await workspace();
    const first = plan({
      items: [{ id: "s1", title: "Un item", status: "ready" }],
    });
    recordPlanWrite({ workspaceRoot: root, previous: emptyPlan(), plan: first, now: new Date(FIXED_AT) });
    const firstId = readRegistryLog(root).records[0]?.id;

    const second = plan({
      items: [{ id: "s1", title: "Un item", status: "done" }],
    });
    recordPlanWrite({ workspaceRoot: root, previous: first, plan: second, now: new Date(FIXED_AT) });

    const records = readRegistryLog(root).records;
    expect(records).toHaveLength(2);
    expect(records[0]?.id).toBe(firstId);
    expect(records[1]?.status).toBe("done");
    expect(records[1]?.id).not.toBe(firstId);
  });

  it("recordRevert anexa el evento con paths y status, y no duplica el mismo audit", async () => {
    const root = await workspace();
    const run = execution({ agentId: "prog1" });

    const first = recordRevert({
      workspaceRoot: root,
      selection: { agentId: "prog1" },
      execution: run,
      result: "reverted",
    });
    const second = recordRevert({
      workspaceRoot: root,
      selection: { agentId: "prog1" },
      execution: run,
      result: "reverted",
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.reason).toBe("duplicate_id");
    expect(await logLines(root)).toHaveLength(1);

    const record = readRegistryLog(root).records[0];
    expect(record?.kind).toBe("revert");
    expect(record?.status).toBe("reverted");
    expect(record?.paths).toEqual(["src/login.ts"]);
    expect(record?.refs).toEqual(["src/login.ts"]);
    expect(record?.summary).toContain("1 revertidos");
    expect(record?.source).toBe("reverts.jsonl");
  });

  it("ningún evento contiene before/after ni contenido de archivos", async () => {
    const root = await workspace();
    const next = plan({
      items: [
        {
          id: "s1",
          title: "Un item",
          detail: "BODY-SECRET",
          status: "ready",
          files: ["src/a.ts"],
        },
      ],
    });
    recordPlanWrite({ workspaceRoot: root, previous: emptyPlan(), plan: next, now: new Date(FIXED_AT) });
    recordRevert({
      workspaceRoot: root,
      selection: { agentId: "prog1" },
      execution: execution({ agentId: "prog1" }),
      result: "reverted",
    });

    const serialized = JSON.stringify(readRegistryLog(root).records);
    expect(serialized).not.toContain("BODY-SECRET");
    expect(serialized).not.toContain('"before"');
    expect(serialized).not.toContain('"after"');
  });

  it("AutonPlan deja eventos y un índice fresco en disco", async () => {
    const root = await workspace();
    await autonPlanToolEntry.handler(
      {
        action: "write",
        goal: { title: "Registrar el plan" },
        items: [{ id: "s1", title: "Un item", status: "ready" }],
      },
      context(root),
    );

    const log = readRegistryLog(root);
    expect(log.records.map((record) => record.kind)).toEqual(["goal", "sprint"]);

    const index = readRegistryIndex(root);
    expect(index).not.toBeNull();
    expect(index?.sourceBytes).toBe(statSync(registryLogPath(root)).size);
    expect(index?.records).toEqual(log.records);
    expect(index?.records.length).toBeGreaterThan(0);
    const raw = await readFile(registryIndexPath(root), "utf8");
    expect(raw.length).toBeGreaterThan(0);
  });

  it("una segunda escritura idéntica del plan no hace crecer el registro", async () => {
    const root = await workspace();
    const input = {
      action: "write" as const,
      goal: { title: "Idempotente" },
      items: [{ id: "s1", title: "Un item", status: "ready" as const }],
    };

    await autonPlanToolEntry.handler(input, context(root));
    const lines = await logLines(root);
    await autonPlanToolEntry.handler(input, context(root));

    expect(await logLines(root)).toHaveLength(lines.length);
  });

  it("AutonRevert deja un evento revert en el registro", async () => {
    const root = await workspace();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "login.ts"), "nuevo", "utf8");
    recordFileChange({
      workspaceRoot: root,
      sessionId: "auton_prog1",
      path: join(root, "src", "login.ts"),
      before: "viejo",
      after: "nuevo",
      now: new Date(FIXED_AT),
    });

    const output = (await autonRevertHandler({ agentId: "prog1" }, context(root))) as {
      result: string;
    };
    expect(output.result).toBe("reverted");

    const revert = readRegistryLog(root).records.find((record) => record.kind === "revert");
    expect(revert).toBeDefined();
    expect(revert?.status).toBe("reverted");
    expect(revert?.paths).toEqual(["src/login.ts"]);
  });

  it("los ids de los eventos son deterministas para el mismo contenido", async () => {
    const firstRoot = await workspace();
    const secondRoot = await workspace();
    const next = plan({
      goal: { title: "Mismo contenido" },
      limitHistory: [limitChange()],
      limitReports: [limitReport()],
      items: [{ id: "s1", title: "Un item", status: "ready", attempts: 1 }],
    });

    recordPlanWrite({
      workspaceRoot: firstRoot,
      previous: emptyPlan(),
      plan: next,
      now: new Date(FIXED_AT),
    });
    recordPlanWrite({
      workspaceRoot: secondRoot,
      previous: emptyPlan(),
      plan: next,
      now: new Date(FIXED_AT),
    });

    expect(readRegistryLog(firstRoot).records.map((record) => record.id)).toEqual(
      readRegistryLog(secondRoot).records.map((record) => record.id),
    );
  });

  it("el índice contiene los eventos escritos por los hooks", async () => {
    const root = await workspace();
    const next = plan({
      goal: { title: "Índice con hooks" },
      items: [{ id: "s1", title: "Un item", status: "ready" }],
    });
    recordPlanWrite({ workspaceRoot: root, previous: emptyPlan(), plan: next, now: new Date(FIXED_AT) });

    const index = readRegistryIndex(root);
    expect(index?.records.map((record) => record.id)).toEqual(
      readRegistryLog(root).records.map((record) => record.id),
    );
    expect(index?.records.some((record) => record.source === "plan.json:goal")).toBe(true);
  });
});
