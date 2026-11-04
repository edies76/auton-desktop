// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { AutonProjectsScreen } from "../src/auton/project-space/ProjectListScreen.js";
import { AutonWorkspaceApp } from "../src/auton/project-space/AutonWorkspaceApp.js";
import { AutonProjectList } from "../src/project-sidebar/AutonProjectList.js";
import { ProjectHomeOverview } from "../src/project-sidebar/ProjectHomeOverview.js";
import { useAutonHomeStore } from "../src/auton/project-space/homeStore.js";
import type { AutonProject } from "../src/auton/project-space/model.js";

const projectTreeMock = vi.hoisted(() => ({
  tree: {
    projects: [
      {
        id: "old",
        name: "Antiguo",
        roots: [{ rootPath: "C:\\old", position: 0, isPrimary: true }],
        position: 0,
        pinned: false,
        deleted: false,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "recent",
        name: "Reciente",
        roots: [{ rootPath: "C:\\recent", position: 0, isPrimary: true }],
        position: 1,
        pinned: false,
        deleted: false,
        createdAt: 2,
        updatedAt: 2,
      },
    ],
    tasks: [
      { taskId: "t-old", projectId: "old", title: "Vieja", updatedAt: 10 },
      { taskId: "t-recent", projectId: "recent", title: "Nueva", updatedAt: 20 },
    ],
  },
}));

vi.mock("@/project-sidebar/useProjectTree.js", () => ({
  useProjectTree: () => ({ tree: projectTreeMock.tree, loading: false }),
}));

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

describe("lista real de proyectos", () => {
  it("ordena por la task más reciente y abre el proyecto con su ruta y task", () => {
    const onOpenProject = vi.fn();
    const onOpenWorkspace = vi.fn();
    renderUi(
      <AutonProjectList
        onOpenProject={onOpenProject}
        onOpenWorkspace={onOpenWorkspace}
      />,
    );

    const rows = screen.getAllByTestId("auton-project-row");
    expect(rows.map((row) => row.dataset.projectId)).toEqual(["recent", "old"]);
    expect(rows[0]!.textContent).toContain("Reciente");
    expect(rows[0]!.textContent).toContain("C:\\recent");

    fireEvent.click(rows[0]!);
    expect(onOpenProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "recent" }),
      "C:\\recent",
      "t-recent",
    );
    expect(onOpenWorkspace).not.toHaveBeenCalled();
  });

  it("un proyecto sin sesiones abre el espacio con taskId null, no el workspace", () => {
    const projects = projectTreeMock.tree.projects as unknown as Record<string, unknown>[];
    projects.push({
      id: "solo",
      name: "Sin sesiones",
      roots: [{ rootPath: "C:\\solo", position: 0, isPrimary: true }],
      position: 2,
      pinned: false,
      deleted: false,
      createdAt: 3,
      updatedAt: 3,
    });
    try {
      const onOpenProject = vi.fn();
      const onOpenWorkspace = vi.fn();
      renderUi(
        <AutonProjectList onOpenProject={onOpenProject} onOpenWorkspace={onOpenWorkspace} />,
      );

      const rows = screen.getAllByTestId("auton-project-row");
      const solo = rows.find((row) => row.dataset.projectId === "solo");
      expect(solo?.textContent).toContain("sin sesiones");

      fireEvent.click(solo!);
      expect(onOpenProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: "solo" }),
        "C:\\solo",
        null,
      );
      expect(onOpenWorkspace).not.toHaveBeenCalled();
    } finally {
      projects.pop();
    }
  });
});

describe("lista de proyectos", () => {
  it("el resumen central muestra el último trabajo y pide abrir el proyecto", () => {
    useAutonHomeStore.setState({ requestedProjectId: null });
    renderUi(<ProjectHomeOverview />);

    const rows = screen.getAllByTestId("auton-home-project-row");
    expect(rows[0]!.textContent).toContain("Reciente");
    expect(rows[0]!.textContent).toContain("Última sesión: Nueva");

    fireEvent.click(rows[0]!);
    expect(useAutonHomeStore.getState().requestedProjectId).toBe("recent");
  });

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
