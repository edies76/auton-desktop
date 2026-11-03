// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { AutonProjectsScreen } from "../src/auton/project-space/ProjectListScreen.js";
import { AutonWorkspaceApp } from "../src/auton/project-space/AutonWorkspaceApp.js";
import type { AutonProject } from "../src/auton/project-space/model.js";

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

function renderUi(ui: ReactElement) {
  return render(<ZCodeIntlProvider initialLocale="en-US">{ui}</ZCodeIntlProvider>);
}

const PROJECTS: AutonProject[] = [
  { id: "reciente", name: "Lunar móvil", path: "C:\\proyectos\\lunar", lastActiveAt: NOW - 60_000 },
  { id: "antiguo", name: "Auton docs", path: "C:\\proyectos\\docs", lastActiveAt: NOW - 3 * 3_600_000 },
];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe("lista de proyectos", () => {
  it("ordena por actividad reciente y muestra nombre y ruta", () => {
    const onOpen = vi.fn();
    renderUi(      <AutonProjectsScreen
        projects={[...PROJECTS].reverse()}
        now={NOW}
        onOpen={onOpen}
        onCreate={vi.fn()}
      />,
    );

    const rows = screen.getAllByTestId("auton-project-row");
    expect(rows.map((row) => row.dataset.projectId)).toEqual(["reciente", "antiguo"]);
    expect(within(rows[0]!).getByText("Lunar móvil")).toBeTruthy();
    expect(within(rows[0]!).getByText("C:\\proyectos\\lunar")).toBeTruthy();

    fireEvent.click(rows[0]!);
    expect(onOpen).toHaveBeenCalledWith(PROJECTS[0]);
  });

  it("no deja crear sin nombre o sin ruta", () => {
    const onCreate = vi.fn();
    renderUi(      <AutonProjectsScreen projects={[]} now={NOW} onOpen={vi.fn()} onCreate={onCreate} />,
    );

    fireEvent.click(screen.getByTestId("auton-new-project"));
    const confirm = screen.getByTestId("auton-create-project-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("auton-project-name"), { target: { value: "Nuevo" } });
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("auton-project-path"), {
      target: { value: "  " },
    });
    expect(confirm.disabled).toBe(true);

    fireEvent.click(confirm);
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("auton-project-space")).toBeNull();
  });

  it("con nombre y ruta crea y entra al proyecto", () => {
    const onCreate = vi.fn();
    renderUi(      <AutonProjectsScreen projects={[]} now={NOW} onOpen={vi.fn()} onCreate={onCreate} />,
    );

    fireEvent.click(screen.getByTestId("auton-new-project"));
    fireEvent.change(screen.getByTestId("auton-project-name"), { target: { value: "  Nuevo  " } });
    fireEvent.change(screen.getByTestId("auton-project-path"), {
      target: { value: "  C:\\nuevo  " },
    });

    const confirm = screen.getByTestId("auton-create-project-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    expect(onCreate).toHaveBeenCalledWith({ name: "Nuevo", path: "C:\\nuevo" });
  });

  it("la app real entra al espacio y el botón atrás vuelve a la lista", () => {
    renderUi(<AutonWorkspaceApp initialProjects={PROJECTS} now={NOW} />);

    fireEvent.click(screen.getAllByTestId("auton-project-row")[0]!);
    expect(screen.getByTestId("auton-project-space")).toBeTruthy();
    expect(screen.getByTestId("auton-thread")).toBeTruthy();

    fireEvent.click(screen.getByTestId("auton-project-back"));
    expect(screen.getByTestId("auton-project-list")).toBeTruthy();
    expect(screen.queryByTestId("auton-project-space")).toBeNull();
  });

  it("crear desde la app abre el espacio del proyecto nuevo", () => {
    renderUi(<AutonWorkspaceApp initialProjects={[]} now={NOW} />);

    fireEvent.click(screen.getByTestId("auton-new-project"));
    fireEvent.change(screen.getByTestId("auton-project-name"), { target: { value: "Proyecto X" } });
    fireEvent.change(screen.getByTestId("auton-project-path"), {
      target: { value: "C:\\proyectos\\x" },
    });
    fireEvent.click(screen.getByTestId("auton-create-project-confirm"));

    expect(screen.getByTestId("auton-project-space")).toBeTruthy();
    expect(screen.getByText("Proyecto X")).toBeTruthy();

    fireEvent.click(screen.getByTestId("auton-project-back"));
    expect(screen.getAllByTestId("auton-project-row")).toHaveLength(1);
  });
});
