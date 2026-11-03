// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { AutonWorkBlock } from "../src/auton/project-space/WorkBlock.js";
import { AutonPlanBlock } from "../src/auton/project-space/PlanBlock.js";
import { AutonEvidenceBlock } from "../src/auton/project-space/EvidenceBlock.js";
import { AutonThreadView } from "../src/auton/project-space/ThreadView.js";
import type {
  AutonProject,
  AutonProjectSpaceData,
  AutonWorkTramo,
  AutonWorkerView,
} from "../src/auton/project-space/model.js";

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

function renderUi(ui: ReactElement) {
  return render(<ZCodeIntlProvider initialLocale="en-US">{ui}</ZCodeIntlProvider>);
}

const WORKERS: AutonWorkerView[] = [
  {
    id: "w1",
    name: "worker 1",
    status: "trabajando",
    startedAt: NOW - 120_000,
    lastSignalAt: NOW - 2_000,
    lastLine: "ajustando el cuadro",
    transcript: [],
  },
  {
    id: "w2",
    name: "worker 2",
    status: "preguntando",
    startedAt: NOW - 60_000,
    lastSignalAt: NOW - 1_000,
    lastLine: "necesita el criterio",
    transcript: [],
  },
];

const TRAMO: AutonWorkTramo = {
  id: "t1",
  startedAt: NOW - 134_000,
  endedAt: NOW,
  workerIds: ["w1", "w2"],
};

const PROJECT: AutonProject = {
  id: "p1",
  name: "Lunar móvil",
  path: "C:\\proyectos\\lunar",
  lastActiveAt: NOW,
};

afterEach(cleanup);

describe("bloque de trabajo", () => {
  it("lista a los workers con su reloj y el tiempo del tramo", () => {
    renderUi(<AutonWorkBlock tramo={TRAMO} workers={WORKERS} now={NOW} />);

    expect(screen.getByTestId("auton-work-block-clock").textContent).toBe("02:14");
    const body = screen.getByTestId("auton-work-block-workers");
    expect(body.textContent).toContain("worker 1");
    expect(body.textContent).toContain("worker 2");
    expect(body.textContent).toContain("02:00");
    expect(body.textContent).toContain("01:00");
    expect(screen.getByTestId("auton-work-block").className).toContain("animate-in");
  });

  it("se contrae y se expande", () => {
    renderUi(<AutonWorkBlock tramo={TRAMO} workers={WORKERS} now={NOW} />);
    const block = screen.getByTestId("auton-work-block");
    expect(block.dataset.expanded).toBe("true");

    fireEvent.click(screen.getByTestId("auton-work-block-toggle"));
    expect(block.dataset.expanded).toBe("false");
    expect(screen.queryByTestId("auton-work-block-workers")).toBeNull();

    fireEvent.click(screen.getByTestId("auton-work-block-toggle"));
    expect(block.dataset.expanded).toBe("true");
    expect(screen.getByTestId("auton-work-block-workers")).toBeTruthy();
  });
});

describe("bloque de plan", () => {
  it("reutiliza la tarjeta del plan con sus items", () => {
    renderUi(
      <AutonPlanBlock
        plan={{
          goalTitle: "Lunar móvil",
          items: [
            { id: "s1", title: "Revisar el diseño", status: "running", owner: "programmer" },
            { id: "s2", title: "Diagnosticar login", status: "waiting" },
          ],
        }}
      />,
    );

    const block = screen.getByTestId("auton-plan-block");
    expect(block.textContent).toContain("Lunar móvil");
    expect(block.textContent).toContain("Revisar el diseño");
    expect(block.textContent).toContain("Diagnosticar login");
  });
});

describe("bloque de evidencia", () => {
  it("muestra comando, salida y archivos", () => {
    renderUi(
      <AutonEvidenceBlock
        evidence={{
          id: "e1",
          command: "pnpm test",
          output: "3 passed",
          files: ["src/a.ts", "src/b.ts"],
        }}
      />,
    );

    expect(screen.getByTestId("auton-evidence-command").textContent).toBe("pnpm test");
    expect(screen.getByTestId("auton-evidence-output").textContent).toContain("3 passed");
    const files = screen.getByTestId("auton-evidence-files");
    expect(files.textContent).toContain("src/a.ts");
    expect(files.textContent).toContain("src/b.ts");
  });
});

describe("hilo del orquestador", () => {
  const DATA: AutonProjectSpaceData = {
    messages: [
      { id: "m1", at: NOW - 150_000, role: "human", text: "Mejora el chat." },
      { id: "m2", at: NOW - 140_000, role: "orchestrator", text: "Reparto dos frentes." },
    ],
    workers: WORKERS,
    tramos: [TRAMO],
    plan: { goalTitle: "Lunar móvil", items: [{ id: "s1", title: "Diseño", status: "running" }] },
    evidence: { id: "e1", command: "pnpm test", output: "ok", files: ["src/a.ts"] },
  };

  it("anida trabajo, plan y evidencia en ese orden", () => {
    renderUi(
      <AutonThreadView
        project={PROJECT}
        data={DATA}
        now={NOW}
        onBack={vi.fn()}
        onStopWorker={vi.fn()}
      />,
    );

    const work = screen.getByTestId("auton-work-block");
    const plan = screen.getByTestId("auton-plan-block");
    const evidence = screen.getByTestId("auton-evidence-block");

    expect(work.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(plan.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sin trabajo muestra un estado vacío claro", () => {
    renderUi(
      <AutonThreadView
        project={PROJECT}
        data={{ messages: [], workers: [], tramos: [] }}
        now={NOW}
        onBack={vi.fn()}
        onStopWorker={vi.fn()}
      />,
    );
    expect(screen.getByTestId("auton-thread-empty").textContent).toContain(
      "El orquestador todavía no ha abierto trabajo",
    );
  });

  it("el compositor es el único campo y envía al orquestador", () => {
    const onSend = vi.fn();
    const { container } = renderUi(
      <AutonThreadView
        project={PROJECT}
        data={DATA}
        now={NOW}
        onBack={vi.fn()}
        onStopWorker={vi.fn()}
        onSend={onSend}
      />,
    );

    expect(container.querySelectorAll("textarea")).toHaveLength(1);
    const composer = screen.getByTestId("auton-composer") as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: "  sigue con el login  " } });
    fireEvent.click(screen.getByTestId("auton-composer-send"));

    expect(onSend).toHaveBeenCalledWith("sigue con el login");
  });
});
