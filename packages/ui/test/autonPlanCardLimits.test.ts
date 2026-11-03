// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readAutonPlanView } from "../src/auton/plan-card.js";

const output = {
  path: "/tmp/proyecto/.auton/plan.json",
  plan: {
    version: 1,
    limits: {
      version: 2,
      maxAttempts: 3,
      approval: {
        deleteMove: true,
        outsideProject: true,
        pushMergeRebase: true,
        installDependencies: false,
        outsideScope: true,
      },
      unknownHandling: "wait",
    },
    limitHistory: [
      {
        at: "2026-11-02T22:00:00.000Z",
        field: "maxAttempts",
        from: "2",
        to: "3",
        reason: "más margen",
        approvedBy: "human",
      },
    ],
    limitReports: [
      {
        at: "2026-11-02T22:10:00.000Z",
        field: "maxAttempts",
        observed: "sin intentos en un item de red",
        expected: "5",
        by: "prog-01",
      },
    ],
    items: [
      {
        id: "s1",
        title: "Landing",
        status: "running",
        attempts: 2,
        needsApproval: ["deleteMove"],
      },
      {
        id: "s2",
        title: "Autenticación",
        status: "not_evaluable",
        questions: ["¿qué proveedor?"],
      },
    ],
  },
  summary: { total: 2, done: 0, running: 1, waiting: 0, blocked: 0, notEvaluable: 1 },
};

describe("AutonPlan card view", () => {
  it("expone límites, intentos, aprobaciones y reportes", () => {
    const view = readAutonPlanView({ toolName: "AutonPlan", output: JSON.stringify(output) } as never);

    expect(view).not.toBeNull();
    expect(view?.limits?.version).toBe(2);
    expect(view?.limits?.maxAttempts).toBe(3);
    expect(view?.limits?.approvalAsk).toContain("deleteMove");
    expect(view?.limits?.approvalAsk).not.toContain("installDependencies");
    expect(view?.limits?.history[0]?.approvedBy).toBe("human");

    expect(view?.items[0]?.attempts).toBe(2);
    expect(view?.items[0]?.needsApproval).toEqual(["deleteMove"]);
    expect(view?.limitReports[0]?.by).toBe("prog-01");
  });

  it("cuenta el estado no evaluable como decisión pendiente", () => {
    const view = readAutonPlanView({ toolName: "AutonPlan", output: JSON.stringify(output) } as never);
    expect(view?.notEvaluable).toBe(1);
    expect(view?.items[1]?.status).toBe("not_evaluable");
    expect(view?.items[1]?.questions).toEqual(["¿qué proveedor?"]);
  });

  it("un plan legado sin límites sigue leyéndose", () => {
    const legacy = {
      plan: { version: 1, limitHistory: [], limitReports: [], items: [] },
      summary: { total: 0, done: 0, running: 0, waiting: 0, blocked: 0 },
    };
    const view = readAutonPlanView({ toolName: "AutonPlan", output: JSON.stringify(legacy) } as never);
    expect(view?.limits).toBeUndefined();
    expect(view?.notEvaluable).toBe(0);
  });
});
