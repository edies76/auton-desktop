// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AutonEvidenceInspector } from "../src/auton/project-space/EvidenceInspector.js";
import type { AutonSprintItem } from "../src/auton/project-space/planFile.js";

const SPRINT: AutonSprintItem = {
  id: "s1",
  title: "Leer el diario del proyecto",
  detail: "Que el diario se pueda consultar sin fricción.",
  status: "done",
  files: ["src/estudio.ts", "src/diario.ts"],
  evidence: [{ kind: "test", label: "La suite de estudio pasa", ref: "pnpm test estudio" }],
  questions: ["¿Bloquear notificaciones del sistema?"],
  attempts: 2,
};

const SATURATED_CLASS_FRAGMENTS = ["amber-", "emerald-", "violet-", "green-", "blue-"];

afterEach(cleanup);

describe("inspector de evidencia minimalista", () => {
  it("sin selección muestra el estado vacío sobrio", () => {
    render(<AutonEvidenceInspector item={null} />);

    const inspector = screen.getByTestId("auton-evidence-inspector");
    expect(inspector.getAttribute("data-empty")).toBe("true");
    expect(inspector.textContent).toContain("Elige un sprint del tablero.");
    expect(screen.queryByTestId("auton-evidence-requirement")).toBeNull();
  });

  it("con sprint muestra requisito, archivos, evidencia, contadores y preguntas", () => {
    render(<AutonEvidenceInspector item={SPRINT} />);

    const inspector = screen.getByTestId("auton-evidence-inspector");
    expect(inspector.getAttribute("data-sprint-id")).toBe("s1");
    expect(within(inspector).getByTestId("auton-evidence-id").textContent).toContain("s1");
    expect(within(inspector).getByTestId("auton-evidence-status").textContent).toContain(
      "Terminado",
    );
    expect(within(inspector).getByTestId("auton-evidence-requirement").textContent).toContain(
      "Leer el diario del proyecto",
    );
    const files = within(inspector).getByTestId("auton-evidence-files");
    expect(files.textContent).toContain("src/estudio.ts");
    expect(files.textContent).toContain("src/diario.ts");
    expect(within(inspector).getByTestId("auton-evidence-entry").textContent).toContain(
      "La suite de estudio pasa",
    );
    const counters = within(inspector).getByTestId("auton-evidence-counters");
    expect(counters.textContent).toContain("Intentos");
    expect(counters.textContent).toContain("2");
    expect(counters.textContent).toContain("Preguntas");
    expect(within(inspector).getByTestId("auton-evidence-questions").textContent).toContain(
      "¿Bloquear notificaciones del sistema?",
    );
    expect(screen.queryByTestId("auton-evidence-missing")).toBeNull();
    expect(screen.queryByTestId("auton-evidence-undemonstrated")).toBeNull();
  });

  it("done sin evidencia avisa en tono neutro que falta demostrar", () => {
    render(<AutonEvidenceInspector item={{ ...SPRINT, evidence: [] }} />);

    expect(screen.getByTestId("auton-evidence-missing").textContent).toContain(
      "Sin evidencia declarada",
    );
    expect(screen.getByTestId("auton-evidence-undemonstrated").textContent).toContain(
      "sin evidencia",
    );
    expect(screen.getByTestId("auton-evidence-undemonstrated").textContent).toContain(
      "Falta demostrar",
    );
  });

  it("el HTML renderizado no contiene clases de color saturado en ningún estado", () => {
    const items: (AutonSprintItem | null)[] = [
      null,
      SPRINT,
      { ...SPRINT, evidence: [] },
      { ...SPRINT, status: "blocked", evidence: [] },
      { ...SPRINT, status: "waiting", evidence: [] },
      { ...SPRINT, status: "not_evaluable", evidence: [] },
      { ...SPRINT, status: "running", evidence: [] },
    ];

    for (const item of items) {
      const { container, unmount } = render(<AutonEvidenceInspector item={item} />);
      for (const fragment of SATURATED_CLASS_FRAGMENTS) {
        expect(container.innerHTML).not.toContain(fragment);
      }
      unmount();
    }
  });
});
