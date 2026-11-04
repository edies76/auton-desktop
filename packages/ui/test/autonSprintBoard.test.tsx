// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { AutonSprintBoard } from "../src/auton/project-space/SprintBoard.js";
import { AutonProjectSpace } from "../src/auton/project-space/ProjectSpaceScreen.js";
import {
  AUTON_SPRINT_COLUMNS,
  groupSprints,
  parseAutonPlanFile,
  planFilePath,
  summarizePlan,
  type AutonPlanFile,
} from "../src/auton/project-space/planFile.js";
import type { AutonProject, AutonProjectSpaceData } from "../src/auton/project-space/model.js";

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);

const PROJECT: AutonProject = {
  id: "p1",
  name: "Lunar móvil",
  path: "/home/edi/lunar",
  lastActiveAt: NOW,
};

const EMPTY_DATA: AutonProjectSpaceData = { messages: [], workers: [], tramos: [] };

const PLAN: AutonPlanFile = {
  goalTitle: "Mejorar Lunar para estudiar",
  statement: "Que estudiar sea menos fricción.",
  constraints: ["No tocar la UI de ZCode"],
  done: ["Un sprint cerrado con evidencia"],
  items: [
    {
      id: "s1",
      title: "Leer el diario del proyecto",
      status: "done",
      owner: "programmer",
      effort: "minimal",
      files: ["src/estudio.ts"],
      evidence: [
        { kind: "test", label: "La suite de estudio pasa", ref: "pnpm test estudio" },
      ],
      questions: [],
      attempts: 2,
    },
    {
      id: "s2",
      title: "Diseñar el modo enfoque",
      status: "running",
      owner: "orchestrator",
      mode: "build",
      engine: "zcode",
      files: [],
      evidence: [],
      questions: ["¿Bloquear notificaciones del sistema?"],
      attempts: 1,
    },
    {
      id: "s3",
      title: "Migrar datos viejos",
      status: "blocked",
      files: ["db/migrate.ts"],
      evidence: [],
      questions: [],
      attempts: 3,
    },
  ],
  updatedAt: "2026-11-04T12:00:00.000Z",
  limitHistoryCount: 1,
  limitReportsCount: 2,
};

function renderUi(ui: ReactElement) {
  return render(<ZCodeIntlProvider initialLocale="en-US">{ui}</ZCodeIntlProvider>);
}

afterEach(cleanup);

describe("lectura de .auton/plan.json", () => {
  it("convierte el plan en sprints con evidencia, archivos y preguntas", () => {
    const raw = JSON.stringify({
      version: 1,
      goal: {
        title: "Mejorar Lunar",
        statement: "Estudiar sin fricción",
        constraints: ["No tocar ZCode"],
        done: ["Sprint cerrado con evidencia"],
      },
      updatedAt: "2026-11-04T12:00:00.000Z",
      limitHistory: [{}, {}],
      limitReports: [{}],
      items: [
        {
          id: "s1",
          title: "Leer el diario",
          status: "done",
          files: ["src/a.ts"],
          evidence: [{ kind: "test", label: "pasa", ref: "pnpm test" }],
          questions: ["¿Sigo?"],
          attempts: 2,
        },
      ],
    });

    const plan = parseAutonPlanFile(raw);
    expect(plan?.goalTitle).toBe("Mejorar Lunar");
    expect(plan?.constraints).toEqual(["No tocar ZCode"]);
    expect(plan?.done).toEqual(["Sprint cerrado con evidencia"]);
    expect(plan?.items[0]).toMatchObject({
      id: "s1",
      status: "done",
      files: ["src/a.ts"],
      attempts: 2,
    });
    expect(plan?.items[0]?.evidence[0]).toEqual({
      kind: "test",
      label: "pasa",
      ref: "pnpm test",
    });
    expect(plan?.limitHistoryCount).toBe(2);
    expect(plan?.limitReportsCount).toBe(1);
  });

  it("devuelve null si no hay un plan legible", () => {
    expect(parseAutonPlanFile("no es json")).toBeNull();
    expect(parseAutonPlanFile("{}")).toBeNull();
    expect(parseAutonPlanFile(JSON.stringify({ items: "no" }))).toBeNull();
  });

  it("no inventa un estado que no entiende y descarta items sin id o título", () => {
    const raw = JSON.stringify({
      items: [
        { id: "s1", title: "Válido", status: "raro" },
        { id: "", title: "Sin id", status: "ready" },
        { id: "s3", status: "ready" },
        { id: "s1", title: "Duplicado", status: "done" },
      ],
    });
    const plan = parseAutonPlanFile(raw);
    expect(plan?.items).toHaveLength(1);
    expect(plan?.items[0]).toMatchObject({ id: "s1", title: "Válido", status: "not_evaluable" });
  });

  it("agrupa por estado en el orden del tablero y cuenta el resumen", () => {
    const columns = groupSprints(PLAN);
    expect(columns.map((column) => column.status)).toEqual(
      AUTON_SPRINT_COLUMNS.map((column) => column.status),
    );
    expect(columns.find((column) => column.status === "done")?.items.map((item) => item.id)).toEqual([
      "s1",
    ]);
    expect(summarizePlan(PLAN)).toMatchObject({
      total: 3,
      done: 1,
      running: 1,
      blocked: 1,
      ready: 0,
    });
  });

  it("arma la ruta del plan con el separador del workspace", () => {
    expect(planFilePath("/home/edi/lunar")).toBe("/home/edi/lunar/.auton/plan.json");
    expect(planFilePath("C:\\lunar\\")).toBe("C:\\lunar\\.auton\\plan.json");
  });
});

describe("tablero de sprints", () => {
  it("muestra el objetivo, el resumen y una columna por estado", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={PLAN} onBack={() => undefined} />);

    expect(screen.getByTestId("auton-sprint-goal").textContent).toContain(
      "Mejorar Lunar para estudiar",
    );
    expect(screen.getByTestId("auton-sprint-summary").textContent).toContain("Total");
    expect(screen.getByTestId("auton-sprint-column-done").getAttribute("data-count")).toBe("1");
    expect(screen.getByTestId("auton-sprint-column-ready").getAttribute("data-count")).toBe("0");
    expect(screen.getByTestId("auton-sprint-column-blocked").getAttribute("data-count")).toBe("1");
    expect(screen.getAllByTestId("auton-sprint-card")).toHaveLength(3);
  });

  it("al elegir un sprint muestra su requisito, archivos y evidencia", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={PLAN} onBack={() => undefined} />);

    fireEvent.click(
      within(screen.getByTestId("auton-sprint-column-done")).getByTestId("auton-sprint-card"),
    );

    const inspector = screen.getByTestId("auton-evidence-inspector");
    expect(inspector.getAttribute("data-sprint-id")).toBe("s1");
    expect(within(inspector).getByTestId("auton-evidence-requirement").textContent).toContain(
      "Leer el diario del proyecto",
    );
    expect(within(inspector).getByTestId("auton-evidence-files").textContent).toContain(
      "src/estudio.ts",
    );
    expect(within(inspector).getByTestId("auton-evidence-entry").textContent).toContain(
      "La suite de estudio pasa",
    );
    expect(within(inspector).getByTestId("auton-evidence-counters").textContent).toContain("2");
  });

  it("marca la falta de evidencia en vez de inventarla", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={PLAN} onBack={() => undefined} />);

    fireEvent.click(
      within(screen.getByTestId("auton-sprint-column-running")).getByTestId("auton-sprint-card"),
    );

    expect(screen.getByTestId("auton-evidence-missing").textContent).toContain(
      "Sin evidencia declarada",
    );
    expect(screen.getByTestId("auton-evidence-questions").textContent).toContain(
      "¿Bloquear notificaciones del sistema?",
    );
  });

  it("avisa cuando un sprint terminado no tiene evidencia", () => {
    const withoutEvidence: AutonPlanFile = {
      ...PLAN,
      items: [{ ...PLAN.items[0]!, evidence: [] }],
    };
    renderUi(
      <AutonSprintBoard project={PROJECT} plan={withoutEvidence} onBack={() => undefined} />,
    );
    fireEvent.click(screen.getByTestId("auton-sprint-card"));
    expect(screen.getByTestId("auton-evidence-undemonstrated").textContent).toContain(
      "sin evidencia",
    );
  });

  it("tiene un estado vacío cuando el proyecto no tiene plan", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={null} onBack={() => undefined} />);
    expect(screen.getByTestId("auton-sprint-board-empty").textContent).toContain(
      "Este proyecto no tiene plan todavía",
    );
  });

  it("distingue la lectura en curso del plan ausente", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={null} loading onBack={() => undefined} />);
    expect(screen.getByTestId("auton-sprint-board-loading").textContent).toContain("Leyendo el plan");
  });
});

describe("entrada Plan en el espacio del proyecto", () => {
  it("abre el tablero desde la barra lateral y vuelve al hilo", () => {
    renderUi(
      <AutonProjectSpace
        project={PROJECT}
        data={EMPTY_DATA}
        now={NOW}
        onBack={() => undefined}
        onStopWorker={() => undefined}
        plan={PLAN}
      />,
    );

    expect(screen.queryByTestId("auton-thread")).not.toBeNull();
    fireEvent.click(screen.getByTestId("auton-plan-open"));
    expect(screen.queryByTestId("auton-sprint-board")).not.toBeNull();
    expect(screen.getByTestId("auton-plan-open").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByTestId("auton-sprint-board-back"));
    expect(screen.queryByTestId("auton-thread")).not.toBeNull();
    expect(screen.getByTestId("auton-plan-open").getAttribute("aria-pressed")).toBe("false");
  });
});
