import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateApproval,
  evaluateAttempt,
  evaluateDispatch,
  validateLimitChange,
  type AutonLimitChange,
  type AutonLimits,
} from "@zcode/contracts";
import { autonPlanHandler, resolveAutonPlanPath } from "../src/auton/plan-handler.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-limits-governance-"));
  workspaces.push(dir);
  return dir;
}

function context(workspaceRoot: string, sessionId = "sess_orchestrator"): ToolExecutionContext {
  return { workingDirectory: workspaceRoot, workspaceRoot, sessionId } as unknown as ToolExecutionContext;
}

const LIMITS: AutonLimits = {
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
};

async function seed(root: string, limits: AutonLimits = LIMITS): Promise<void> {
  await autonPlanHandler(
    {
      action: "write",
      limits,
      items: [{ id: "s1", title: "landing", status: "ready" }],
    },
    context(root),
  );
}

async function readPlan(root: string): Promise<{
  limits?: AutonLimits;
  limitHistory: AutonLimitChange[];
  limitReports: unknown[];
  items: { id: string; status: string; attempts: number }[];
}> {
  const raw = JSON.parse(await readFile(resolveAutonPlanPath(root), "utf8")) as {
    limits?: AutonLimits;
    limitHistory: AutonLimitChange[];
    limitReports: unknown[];
    items: { id: string; status: string; attempts: number }[];
  };
  return raw;
}

interface Failure {
  result: false;
  errorCode: number;
  message: string;
}

function isFailure(value: unknown): value is Failure {
  return typeof value === "object" && value !== null && (value as Failure).result === false;
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("evaluación pura de límites", () => {
  it("sin límites el veredicto es no evaluable, no un aprobado por defecto", () => {
    expect(evaluateAttempt({ limits: undefined, attempts: 0 })).toEqual({
      kind: "not_evaluable",
      reason: "el plan no tiene límites versionados",
    });
    expect(evaluateDispatch({ limits: undefined, item: { attempts: 0, needsApproval: [] } })).toMatchObject({
      kind: "not_evaluable",
    });
  });

  it("dentro del tope sigue; al alcanzarlo, excede", () => {
    expect(evaluateAttempt({ limits: LIMITS, attempts: 1 })).toEqual({ kind: "within", limitsVersion: 1 });
    expect(evaluateAttempt({ limits: LIMITS, attempts: 2 })).toMatchObject({
      kind: "exceeds",
      rule: "maxAttempts",
    });
  });

  it("la aprobación pendiente gana sobre el intento", () => {
    expect(evaluateApproval({ limits: LIMITS, rules: ["deleteMove"] })).toMatchObject({
      kind: "requires_approval",
      rule: "deleteMove",
    });
    expect(
      evaluateDispatch({ limits: LIMITS, item: { attempts: 99, needsApproval: ["deleteMove"] } }),
    ).toMatchObject({ kind: "requires_approval" });
  });

  it("un cambio sin historial no se acepta y uno versionado sí", () => {
    const previous: AutonLimits = { ...LIMITS, version: 1 };
    const next: AutonLimits = { ...LIMITS, version: 2, maxAttempts: 4 };

    expect(
      validateLimitChange({
        previous,
        next,
        previousHistory: [],
        nextHistory: [],
      }),
    ).toMatch(/subir la versión|limitHistory/);

    expect(
      validateLimitChange({
        previous,
        next,
        previousHistory: [],
        nextHistory: [
          {
            at: "2026-11-02T22:00:00.000Z",
            field: "maxAttempts",
            from: "2",
            to: "4",
            reason: "items con red",
            approvedBy: "human",
          },
        ],
      }),
    ).toBeNull();
  });

  it("el historial ya escrito no se reescribe", () => {
    const entry = {
      at: "2026-11-02T22:00:00.000Z",
      field: "maxAttempts",
      from: "2",
      to: "4",
      reason: "items con red",
      approvedBy: "human",
    } satisfies AutonLimitChange;
    expect(
      validateLimitChange({
        previous: LIMITS,
        next: LIMITS,
        previousHistory: [entry],
        nextHistory: [{ ...entry, reason: "otra razón" }],
      }),
    ).toMatch(/no se puede reescribir/);
  });
});

describe("gobierno del despacho", () => {
  it("sin límites versionados el orquestador sigue al mando: despacha y el plan queda sin versión", async () => {
    const root = await workspace();
    const output = await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "running" }] },
      context(root),
    );

    expect(isFailure(output)).toBe(false);
    const plan = await readPlan(root);
    expect(plan.limits).toBeUndefined();
    expect(plan.items[0]?.status).toBe("running");
    expect(plan.items[0]?.attempts).toBe(1);
  });

  it("la aprobación que escribió el orquestador se respeta aunque no haya límites", async () => {
    const root = await workspace();
    await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "borrar", status: "ready" }] },
      context(root),
    );

    const blocked = await autonPlanHandler(
      {
        action: "write",
        items: [
          { id: "s1", title: "borrar", status: "running", needsApproval: ["deleteMove"] },
        ],
      },
      context(root),
    );

    expect(isFailure(blocked)).toBe(true);
    if (isFailure(blocked)) {
      expect(blocked.errorCode).toBe(42203);
      expect(blocked.message).toMatch(/aprobación humana/);
    }
    const plan = await readPlan(root);
    expect(plan.items[0]?.attempts).toBe(0);
    expect(plan.items[0]?.status).toBe("ready");
  });

  it("los intentos los cuenta el plan y frenan al agotarse", async () => {
    const root = await workspace();
    await seed(root);

    await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "running" }] },
      context(root),
    );
    expect((await readPlan(root)).items[0]?.attempts).toBe(1);

    await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "blocked" }] },
      context(root),
    );
    await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "running" }] },
      context(root),
    );
    expect((await readPlan(root)).items[0]?.attempts).toBe(2);

    await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "blocked" }] },
      context(root),
    );
    const third = await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "running" }] },
      context(root),
    );

    expect(isFailure(third)).toBe(true);
    if (isFailure(third)) {
      expect(third.errorCode).toBe(42202);
      expect(third.message).toMatch(/límite de intentos/);
    }
    expect((await readPlan(root)).items[0]?.attempts).toBe(2);
  });

  it("una aprobación pendiente no arranca ni consume intento", async () => {
    const root = await workspace();
    await seed(root);

    const blocked = await autonPlanHandler(
      {
        action: "write",
        items: [
          { id: "s1", title: "borrar", status: "running", needsApproval: ["deleteMove"] },
        ],
      },
      context(root),
    );
    expect(isFailure(blocked)).toBe(true);
    if (isFailure(blocked)) {
      expect(blocked.errorCode).toBe(42203);
      expect(blocked.message).toMatch(/aprobación humana/);
    }
    expect((await readPlan(root)).items[0]?.attempts).toBe(0);

    const waiting = await autonPlanHandler(
      {
        action: "write",
        items: [
          {
            id: "s1",
            title: "borrar",
            status: "waiting",
            needsApproval: ["deleteMove"],
            questions: ["¿Borro el archivo viejo?"],
          },
        ],
      },
      context(root),
    );
    expect(isFailure(waiting)).toBe(false);
  });

  it("no evaluable es un estado de primera clase y exige pregunta", async () => {
    const root = await workspace();
    await seed(root);

    const mute = await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "not_evaluable" }] },
      context(root),
    );
    expect(isFailure(mute)).toBe(true);
    if (isFailure(mute)) {
      expect(mute.errorCode).toBe(42206);
      expect(mute.message).toMatch(/questions/);
    }

    const resolved = (await autonPlanHandler(
      {
        action: "write",
        items: [
          {
            id: "s1",
            title: "landing",
            status: "not_evaluable",
            questions: ["¿Qué paleta uso?"],
          },
        ],
      },
      context(root),
    )) as { summary: { notEvaluable: number } };
    expect(resolved.summary.notEvaluable).toBe(1);
  });

  it("safe_default exige la decisión escrita en detail", async () => {
    const root = await workspace();
    await seed(root, { ...LIMITS, unknownHandling: "safe_default" });

    const mute = await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "not_evaluable" }] },
      context(root),
    );
    expect(isFailure(mute)).toBe(true);

    const resolved = await autonPlanHandler(
      {
        action: "write",
        items: [
          {
            id: "s1",
            title: "landing",
            status: "not_evaluable",
            detail: "Elegí no tocar el archivo compartido; es lo menos riesgoso.",
          },
        ],
      },
      context(root),
    );
    expect(isFailure(resolved)).toBe(false);
  });

  it("cambiar límites exige versión nueva y su entrada de historial", async () => {
    const root = await workspace();
    await seed(root);

    const silent = await autonPlanHandler(
      {
        action: "write",
        limits: { ...LIMITS, maxAttempts: 5 },
        items: [{ id: "s1", title: "landing", status: "ready" }],
      },
      context(root),
    );
    expect(isFailure(silent)).toBe(true);
    if (isFailure(silent)) {
      expect(silent.errorCode).toBe(42204);
      expect(silent.message).toMatch(/subir la versión/);
    }

    const recorded = await autonPlanHandler(
      {
        action: "write",
        limits: { ...LIMITS, version: 2, maxAttempts: 5 },
        limitHistory: [
          {
            at: "2026-11-02T22:00:00.000Z",
            field: "maxAttempts",
            from: "2",
            to: "5",
            reason: "más margen para items con red",
            approvedBy: "human",
          },
        ],
        items: [{ id: "s1", title: "landing", status: "ready" }],
      },
      context(root),
    );
    expect(isFailure(recorded)).toBe(false);
    expect((await readPlan(root)).limits?.version).toBe(2);
  });

  it("omitir los límites conserva la versión vigente", async () => {
    const root = await workspace();
    await seed(root);

    const removed = await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "ready" }] },
      context(root),
    );
    // Omitir limits conserva los vigentes; el gobierno no se pierde por omisión.
    expect(isFailure(removed)).toBe(false);
    expect((await readPlan(root)).limits?.version).toBe(1);
  });

  it("un programador reporta, nunca escribe el reporte", async () => {
    const root = await workspace();
    await seed(root);

    await expect(
      autonPlanHandler(
        {
          action: "write",
          limitReports: [
            {
              at: "2026-11-02T22:00:00.000Z",
              field: "maxAttempts",
              observed: "me quedé sin intentos en un item de red",
              by: "prog-01",
            },
          ],
          items: [{ id: "s1", title: "landing", status: "ready" }],
        },
        context(root, "sess_auton_prog1"),
      ),
    ).rejects.toThrow(/programador no puede cambiar los límites/);

    const report = (await autonPlanHandler(
      {
        action: "write",
        limitReports: [
          {
            at: "2026-11-02T22:00:00.000Z",
            field: "maxAttempts",
            observed: "me quedé sin intentos en un item de red",
            expected: "5",
            by: "prog-01",
          },
        ],
        items: [{ id: "s1", title: "landing", status: "ready" }],
      },
      context(root),
    )) as { plan: { limitReports: unknown[] } };
    expect(report.plan.limitReports).toHaveLength(1);
  });

  it("el historial y los reportes sobreviven a un write que los omite", async () => {
    const root = await workspace();
    await seed(root);
    await autonPlanHandler(
      {
        action: "write",
        limitReports: [
          { at: "2026-11-02T22:00:00.000Z", field: "maxAttempts", observed: "poco margen", by: "prog-01" },
        ],
        items: [{ id: "s1", title: "landing", status: "ready" }],
      },
      context(root),
    );

    await autonPlanHandler(
      { action: "write", items: [{ id: "s1", title: "landing", status: "ready" }] },
      context(root),
    );

    const plan = await readPlan(root);
    expect(plan.limitReports).toHaveLength(1);
    expect(plan.limits?.version).toBe(1);
  });
});
