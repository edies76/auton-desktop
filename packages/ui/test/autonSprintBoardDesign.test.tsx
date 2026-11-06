// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { AutonSprintBoard } from "../src/auton/project-space/SprintBoard.js";
import { AUTON_SPRINT_COLUMNS, type AutonPlanFile } from "../src/auton/project-space/planFile.js";
import type { AutonProject } from "../src/auton/project-space/model.js";

const PROJECT: AutonProject = {
  id: "p1",
  name: "Lunar móvil",
  path: "/home/edi/lunar",
  lastActiveAt: Date.UTC(2026, 10, 4, 12, 0, 0),
};

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
      evidence: [{ kind: "test", label: "La suite de estudio pasa", ref: "pnpm test estudio" }],
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
      questions: [],
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
    {
      id: "s4",
      title: "Esperar la ventana de datos",
      status: "waiting",
      files: [],
      evidence: [],
      questions: [],
      attempts: 0,
    },
    {
      id: "s5",
      title: "Revisar el alcance",
      status: "not_evaluable",
      files: [],
      evidence: [],
      questions: [],
      attempts: 0,
    },
  ],
  updatedAt: "2026-11-04T12:00:00.000Z",
  limitHistoryCount: 0,
  limitReportsCount: 0,
};

const SATURATED = /(?:amber|emerald|violet|red|green|blue)-/;

function renderUi(ui: ReactElement) {
  return render(<ZCodeIntlProvider initialLocale="en-US">{ui}</ZCodeIntlProvider>);
}

function classNamesOf(root: HTMLElement): string {
  const elements = [root, ...root.querySelectorAll<HTMLElement>("*")];
  return elements.map((element) => element.className.toString()).join(" ");
}

afterEach(cleanup);

describe("tablero de sprints — diseño minimalista", () => {
  it("no usa clases de color saturado por estado en el tablero", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={PLAN} onBack={() => undefined} />);

    const board = screen.getByTestId("auton-sprint-board");
    // Sin selección el inspector está en su estado vacío (neutro); el chequeo
    // cubre header, objetivo, resumen, columnas y tarjetas renderizadas.
    expect(classNamesOf(board)).not.toMatch(SATURATED);
    for (const testId of ["auton-sprint-goal", "auton-sprint-summary", "auton-sprint-columns"]) {
      expect(classNamesOf(screen.getByTestId(testId))).not.toMatch(SATURATED);
    }
    // El único acento permitido es el punto de "running".
    const runningColumn = screen.getByTestId("auton-sprint-column-running");
    expect(runningColumn.innerHTML).toContain("bg-primary");
    const doneColumn = screen.getByTestId("auton-sprint-column-done");
    expect(doneColumn.innerHTML).not.toContain("bg-primary");
  });

  it("el detalle del objetivo empieza plegado y se abre con el botón", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={PLAN} onBack={() => undefined} />);

    expect(screen.queryByTestId("auton-sprint-goal-detail")).toBeNull();
    fireEvent.click(screen.getByTestId("auton-sprint-goal-toggle"));
    expect(screen.getByTestId("auton-sprint-goal-detail").textContent).toContain(
      "Que estudiar sea menos fricción.",
    );
  });

  it("el inspector va debajo de las columnas, no al lado", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={PLAN} onBack={() => undefined} />);

    const columns = screen.getByTestId("auton-sprint-columns");
    const below = screen.getByTestId("auton-sprint-inspector-below");
    expect(columns.parentElement?.contains(below)).toBe(true);
    expect(below.querySelector('[data-testid="auton-evidence-inspector"]')).toBeTruthy();
  });

  it("muestra las 7 columnas del plan", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={PLAN} onBack={() => undefined} />);

    expect(AUTON_SPRINT_COLUMNS).toHaveLength(7);
    const columns = screen.getByTestId("auton-sprint-columns");
    expect(columns.children).toHaveLength(7);
    // Sin barra horizontal: las columnas envuelven hacia abajo (auto-fill).
    expect(columns.className).toContain("repeat(auto-fill,minmax(180px,1fr))");
    expect(columns.className).not.toContain("overflow-x-auto");
    for (const column of AUTON_SPRINT_COLUMNS) {
      expect(screen.getByTestId(`auton-sprint-column-${column.status}`)).toBeTruthy();
      expect(
        within(screen.getByTestId(`auton-sprint-column-${column.status}`)).getAllByText(
          column.label,
        ).length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("marca la tarjeta seleccionada sin recurrir a color", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={PLAN} onBack={() => undefined} />);

    const cards = screen.getAllByTestId("auton-sprint-card");
    expect(cards.length).toBeGreaterThan(1);
    const target = cards[0]!;
    expect(target.getAttribute("aria-pressed")).toBe("false");
    expect(target.className).not.toContain("bg-selected");

    fireEvent.click(target);

    expect(target.getAttribute("aria-pressed")).toBe("true");
    expect(target.className).toContain("bg-selected");
    for (const other of cards.slice(1)) {
      expect(other.getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("tiene un estado vacío sobrio y sin color saturado", () => {
    renderUi(<AutonSprintBoard project={PROJECT} plan={null} onBack={() => undefined} />);

    const empty = screen.getByTestId("auton-sprint-board-empty");
    expect(empty.textContent).toContain("Este proyecto no tiene plan todavía");
    expect(screen.queryByTestId("auton-sprint-columns")).toBeNull();
    expect(classNamesOf(screen.getByTestId("auton-sprint-board"))).not.toMatch(SATURATED);
  });
});
