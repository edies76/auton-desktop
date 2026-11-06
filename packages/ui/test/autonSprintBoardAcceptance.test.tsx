// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { AutonSprintBoard } from "../src/auton/project-space/SprintBoard.js";
import { AutonProjectSpace } from "../src/auton/project-space/ProjectSpaceScreen.js";
import {
  parseAutonPlanFile,
  type AutonPlanFile,
} from "../src/auton/project-space/planFile.js";
import type { AutonProject, AutonProjectSpaceData } from "../src/auton/project-space/model.js";

const STAMP = Date.UTC(2027, 0, 18, 9, 30, 0);

const MY_PROJECT: AutonProject = {
  id: "accept-orbital-7",
  name: "Cuaderno orbital",
  path: "/tmp/acceptance/cuaderno-orbital",
  lastActiveAt: STAMP,
};

const NO_DATA: AutonProjectSpaceData = { messages: [], workers: [], tramos: [] };

// JSON crudo escrito a mano para esta verificacion (no un objeto ya tipado).
const RAW_PLAN_JSON = `{
  "version": 99,
  "goal": {
    "title": "Publicar el cuaderno orbital",
    "statement": "Que cada entrega quede probada antes de anunciarla.",
    "constraints": ["Sin atajos visuales"],
    "done": ["Hay una captura firmada del resultado"]
  },
  "updatedAt": "2027-01-18T09:30:00.000Z",
  "limitHistory": [{"nota": "techo alcanzado una vez"}],
  "limitReports": [],
  "items": [
    {
      "id": "orb-cerrado",
      "title": "Sellar el indice del cuaderno",
      "status": "done",
      "detail": "Indice cerrado y enlazado desde la portada.",
      "owner": "verifier-x",
      "files": ["docs/orbital/indice-orbital.md"],
      "evidence": [
        {"kind": "capture", "label": "Captura firmada del indice sellado", "ref": "artifacts/orbital/indice-2027.png"}
      ],
      "questions": [],
      "attempts": 4
    },
    {
      "id": "orb-vivo",
      "title": "Calibrar el telescopio de escritorio",
      "status": "running",
      "owner": "worker-q",
      "files": ["src/orbital/calibrar-telescopio.ts"],
      "evidence": [
        {"kind": "log", "label": "Registro de calibracion en curso", "ref": "logs/calibrar.log"}
      ],
      "questions": ["¿Se repite la calibracion tras reiniciar?"],
      "attempts": 1
    },
    {
      "id": "orb-varado",
      "title": "Importar efemerides heredadas",
      "status": "blocked",
      "files": ["src/orbital/efemerides.ts"],
      "evidence": [],
      "questions": [],
      "attempts": 7
    },
    {
      "id": "orb-cola",
      "title": "Ordenar anexos lunares",
      "status": "ready",
      "files": [],
      "evidence": [],
      "questions": [],
      "attempts": 0
    },
    {
      "id": "orb-cerrado-2",
      "title": "Archivar borradores del cometa",
      "status": "done",
      "files": ["docs/orbital/cometa.md"],
      "evidence": [
        {"kind": "test", "label": "Prueba de archivo del cometa en verde local", "ref": "pnpm test cometa"}
      ],
      "questions": [],
      "attempts": 2
    }
  ]
}`;

function myPlan(): AutonPlanFile {
  const parsed = parseAutonPlanFile(RAW_PLAN_JSON);
  if (!parsed) throw new Error("el JSON crudo de aceptacion deberia parsear");
  return parsed;
}

function mount(ui: ReactElement) {
  return render(<ZCodeIntlProvider initialLocale="es-ES">{ui}</ZCodeIntlProvider>);
}

afterEach(cleanup);

describe("aceptacion independiente del tablero de sprints", () => {
  it("parsea un JSON crudo propio y agrupa en las 7 columnas de estado", () => {
    const plan = myPlan();
    expect(plan.goalTitle).toBe("Publicar el cuaderno orbital");
    expect(plan.items.map((i) => i.id)).toEqual([
      "orb-cerrado",
      "orb-vivo",
      "orb-varado",
      "orb-cola",
      "orb-cerrado-2",
    ]);

    mount(<AutonSprintBoard project={MY_PROJECT} plan={plan} onBack={() => undefined} />);

    const columnEls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid^="auton-sprint-column-"]'),
    );
    expect(columnEls).toHaveLength(7);
    expect(columnEls.map((el) => el.dataset.testid)).toEqual([
      "auton-sprint-column-ready",
      "auton-sprint-column-running",
      "auton-sprint-column-waiting",
      "auton-sprint-column-blocked",
      "auton-sprint-column-not_evaluable",
      "auton-sprint-column-done",
      "auton-sprint-column-dropped",
    ]);

    const doneCol = screen.getByTestId("auton-sprint-column-done");
    const runningCol = screen.getByTestId("auton-sprint-column-running");
    const blockedCol = screen.getByTestId("auton-sprint-column-blocked");
    expect(doneCol.dataset.count).toBe("2");
    expect(runningCol.dataset.count).toBe("1");
    expect(blockedCol.dataset.count).toBe("1");
    expect(screen.getByTestId("auton-sprint-column-ready").dataset.count).toBe("1");
    expect(screen.getByTestId("auton-sprint-column-waiting").dataset.count).toBe("0");

    // Cada tarjeta cae en su columna, no en otra.
    expect(within(doneCol).getAllByTestId("auton-sprint-card").map((c) => c.dataset.sprintId)).toEqual([
      "orb-cerrado",
      "orb-cerrado-2",
    ]);
    expect(within(runningCol).getByTestId("auton-sprint-card").dataset.sprintId).toBe("orb-vivo");
    expect(within(blockedCol).getByTestId("auton-sprint-card").dataset.sprintId).toBe("orb-varado");
    expect(within(doneCol).queryByText("Calibrar el telescopio de escritorio")).toBeNull();
    expect(screen.getAllByTestId("auton-sprint-card")).toHaveLength(5);
  });

  it("al hacer click en una tarjeta, el inspector muestra ESE sprint concreto", () => {
    mount(<AutonSprintBoard project={MY_PROJECT} plan={myPlan()} onBack={() => undefined} />);

    // Antes de elegir, el inspector esta vacio.
    expect(screen.getByTestId("auton-evidence-inspector").dataset.empty).toBe("true");

    const runningCol = screen.getByTestId("auton-sprint-column-running");
    fireEvent.click(within(runningCol).getByTestId("auton-sprint-card"));

    const inspector = screen.getByTestId("auton-evidence-inspector");
    expect(inspector.dataset.sprintId).toBe("orb-vivo");
    expect(inspector.dataset.empty).toBeUndefined();
    expect(within(inspector).getByTestId("auton-evidence-id").textContent).toContain("orb-vivo");
    expect(within(inspector).getByTestId("auton-evidence-requirement").textContent).toContain(
      "Calibrar el telescopio de escritorio",
    );
    expect(within(inspector).getByTestId("auton-evidence-files").textContent).toContain(
      "src/orbital/calibrar-telescopio.ts",
    );
    const entries = within(inspector).getAllByTestId("auton-evidence-entry");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.textContent).toContain("Registro de calibracion en curso");
    expect(entries[0]?.textContent).toContain("logs/calibrar.log");
    // No es el sprint vecino.
    expect(inspector.textContent).not.toContain("Sellar el indice del cuaderno");
    expect(inspector.textContent).not.toContain("indice-2027.png");

    // Cambiar de tarjeta cambia el inspector al nuevo sprint.
    const doneCol = screen.getByTestId("auton-sprint-column-done");
    fireEvent.click(within(doneCol).getAllByTestId("auton-sprint-card")[0]!);
    const inspector2 = screen.getByTestId("auton-evidence-inspector");
    expect(inspector2.dataset.sprintId).toBe("orb-cerrado");
    expect(inspector2.textContent).toContain("Sellar el indice del cuaderno");
    expect(inspector2.textContent).toContain("docs/orbital/indice-orbital.md");
    expect(inspector2.textContent).toContain("Captura firmada del indice sellado");
  });

  it("un sprint done sin evidencia muestra el aviso de no demostrado", () => {
    const plan: AutonPlanFile = {
      constraints: [],
      done: [],
      limitHistoryCount: 0,
      limitReportsCount: 0,
      items: [
        {
          id: "fantasma-1",
          title: "Cerrar sin dejar rastro verificable",
          status: "done",
          files: ["src/fantasma.ts"],
          evidence: [],
          questions: [],
          attempts: 3,
        },
      ],
    };
    mount(<AutonSprintBoard project={MY_PROJECT} plan={plan} onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId("auton-sprint-card"));

    const warning = screen.getByTestId("auton-evidence-undemonstrated");
    expect(warning.textContent).toContain("terminado sin evidencia");
    expect(warning.textContent).toContain("Falta demostrar");
    expect(screen.getByTestId("auton-evidence-missing").textContent).toContain(
      "Sin evidencia declarada",
    );
  });

  it("sin plan se ve el estado vacio y con loading el de carga (no se confunden)", () => {
    const empty = mount(
      <AutonSprintBoard project={MY_PROJECT} plan={null} onBack={() => undefined} />,
    );
    expect(screen.getByTestId("auton-sprint-board-empty").textContent).toContain(
      "no tiene plan",
    );
    expect(screen.queryByTestId("auton-sprint-board-loading")).toBeNull();
    expect(screen.queryByTestId("auton-sprint-columns")).toBeNull();
    empty.unmount();

    mount(
      <AutonSprintBoard project={MY_PROJECT} plan={null} loading onBack={() => undefined} />,
    );
    expect(screen.getByTestId("auton-sprint-board-loading").textContent).toContain(
      "Leyendo el plan",
    );
    expect(screen.queryByTestId("auton-sprint-board-empty")).toBeNull();
  });

  it("el HTML del tablero + inspector no usa clases de colores saturados", () => {
    const { container } = mount(
      <AutonSprintBoard project={MY_PROJECT} plan={myPlan()} onBack={() => undefined} />,
    );
    // Inspector poblado, no solo el tablero.
    fireEvent.click(
      within(screen.getByTestId("auton-sprint-column-done")).getAllByTestId("auton-sprint-card")[0]!,
    );
    expect(screen.getByTestId("auton-evidence-inspector").dataset.sprintId).toBe("orb-cerrado");

    const html = container.innerHTML;
    expect(html.length).toBeGreaterThan(500);
    const banned = [
      "amber-", "emerald-", "violet-", "green-", "blue-", "red-", "yellow-",
      "orange-", "pink-", "purple-", "cyan-", "teal-", "lime-", "rose-",
      "sky-", "indigo-", "fuchsia-",
    ];
    for (const fragment of banned) {
      expect(html, `clase saturada prohibida presente: ${fragment}`).not.toContain(fragment);
    }
  });

  it("la entrada Plan del espacio abre el tablero y el boton Hilo vuelve", () => {
    mount(
      <AutonProjectSpace
        project={MY_PROJECT}
        data={NO_DATA}
        now={STAMP}
        onBack={() => undefined}
        onStopWorker={() => undefined}
        plan={myPlan()}
      />,
    );

    expect(screen.queryByTestId("auton-sprint-board")).toBeNull();
    expect(screen.getByTestId("auton-thread")).toBeTruthy();

    fireEvent.click(screen.getByTestId("auton-plan-open"));
    expect(screen.getByTestId("auton-sprint-board")).toBeTruthy();
    expect(screen.getByTestId("auton-plan-open").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByTestId("auton-sprint-column-blocked")).not.toBeNull();

    fireEvent.click(screen.getByTestId("auton-sprint-board-back"));
    expect(screen.queryByTestId("auton-sprint-board")).toBeNull();
    expect(screen.getByTestId("auton-thread")).toBeTruthy();
    expect(screen.getByTestId("auton-plan-open").getAttribute("aria-pressed")).toBe("false");
  });
});
