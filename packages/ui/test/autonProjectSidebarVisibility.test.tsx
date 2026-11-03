// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, type ReactNode, type Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectSidebarProps } from "@/project-sidebar/contract.js";
import { ProjectSidebar } from "@/project-sidebar/index.js";
import { useAutonHomeStore } from "@/auton/project-space/homeStore.js";

const fixture = vi.hoisted(() => ({
  view: "workers" as "workers" | "projects",
  onSelectTask: vi.fn(),
  tree: {
    projects: [
      {
        id: "p1",
        hostId: "local",
        name: "Lunar",
        nameOverridden: false,
        roots: [{ rootPath: "/workspace/lunar" }],
        position: 0,
        pinned: false,
        deleted: false,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "p2",
        hostId: "local",
        name: "Otro",
        nameOverridden: false,
        roots: [{ rootPath: "/workspace/otro" }],
        position: 1,
        pinned: false,
        deleted: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    tasks: [] as Array<Record<string, unknown>>,
  },
}));

function task(
  taskId: string,
  projectId: string | null,
  createdAt: number,
  title = taskId,
): Record<string, unknown> {
  return {
    taskId,
    title,
    projectId,
    hostId: "local",
    workspacePath: projectId === "p2" ? "/workspace/otro" : "/workspace/lunar",
    status: "completed",
    createdAt,
    updatedAt: createdAt,
    archived: false,
    pinned: false,
  };
}

vi.mock("@/project-sidebar/ProjectDirectoryProvider.js", () => ({
  ProjectDirectoryProvider: ({ children }: { children: ReactNode }) => children,
  useOptionalProjectDirectory: () => null,
  useProjectDirectory: () => ({
    tree: fixture.tree,
    directory: { hosts: [], entries: [] },
    service: undefined,
    remoteService: undefined,
    availability: new Map(),
    refresh: vi.fn(async () => {}),
    error: null,
    loading: false,
    preferences: {
      get view() {
        return fixture.view;
      },
      setView: (value: typeof fixture.view) => {
        fixture.view = value;
      },
      sort: <T,>(items: T[]) => items,
      isExpanded: () => false,
      setExpanded: vi.fn(),
      reorder: vi.fn(),
      setAllExpanded: vi.fn(),
    },
    groups: { groups: [], parents: new Map() },
    deviceNames: new Map(),
  }),
}));

vi.mock("@/project-sidebar/useProjectTaskNavigation.js", () => ({
  useProjectTaskNavigation: () => fixture.onSelectTask,
}));
vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({
    intl: { formatMessage: ({ id }: { id: string }) => id },
    localePreference: "es",
    setLocalePreference: vi.fn(),
  }),
}));
vi.mock("@/store/TabStoreProvider.js", () => ({
  useTabStoreApi: () => ({ getState: () => ({ openSettingsTab: vi.fn() }) }),
}));
vi.mock("@/store/zcodeSessionStore.js", () => {
  const state = { workspaces: { "/workspace/lunar": { activeTaskId: "orch1" } } };
  const useZCodeSessionStore = (selector: (value: typeof state) => unknown) => selector(state);
  useZCodeSessionStore.getState = () => ({
    getWorkspaceState: () => ({ activeTaskId: "orch1", draftTaskGroupId: null }),
  });
  return { useZCodeSessionStore };
});
vi.mock("@/store/StoreProvider.js", () => ({
  useZCodeStore: (selector: (value: { setTheme: () => void }) => unknown) =>
    selector({ setTheme: vi.fn() }),
}));
vi.mock("@/settings/CodingPlanUpgradeDialogProvider.js", () => ({
  useCodingPlanUpgradeDialog: () => ({ openCodingPlanUpgrade: vi.fn() }),
}));
vi.mock("@/components/ui/scroll-fade-viewport.js", () => ({
  ScrollFadeViewport: forwardRef(
    ({ children }: { children: ReactNode }, ref: Ref<HTMLDivElement>) => (
      <div ref={ref}>{children}</div>
    ),
  ),
}));
vi.mock("@/project-sidebar/ProjectSidebarNavigation.js", () => ({
  ProjectSidebarNavigation: () => null,
}));
vi.mock("@/project-sidebar/AutonWorkersSidebar.js", () => ({
  AutonWorkersSidebar: () => <div data-testid="workers-panel-placeholder" />,
}));
vi.mock("@/project-sidebar/ProjectCreation.js", () => ({ ProjectCreation: () => null }));
vi.mock("@/project-sidebar/ProjectEditor.js", () => ({ ProjectEditor: () => null }));
vi.mock("@/project-sidebar/RemoteProjectPicker.js", () => ({ RemoteProjectPicker: () => null }));
vi.mock("@/WorkspaceSidebarFooter.js", () => ({ WorkspaceSidebarFooter: () => null }));
vi.mock("@/sidebar-activity/SidebarBottomActivity.js", () => ({
  SidebarBottomActivity: () => null,
}));

function props(): ProjectSidebarProps {
  return {
    workspacePath: "/workspace/lunar",
    theme: "dark",
    onSelectTask: fixture.onSelectTask,
    onCreateTask: vi.fn(),
    onCreateConversationTask: vi.fn(),
    onStartDraftInWorkspace: vi.fn(),
    onOpenFolderFromWorkspaceMenu: vi.fn(),
    onConnectRemote: vi.fn(async () => "logical"),
    onSelectRemoteProject: vi.fn(async () => {}),
    onCancelRemoteProject: vi.fn(async () => {}),
    onReconnectRemoteWorkspace: vi.fn(async () => {}),
    reconnectingRemoteWorkspaceKeys: [],
    remoteWorkspaceErrorByWorkspaceKey: {},
    onOpenCommandCenter: vi.fn(),
  } as unknown as ProjectSidebarProps;
}

beforeEach(() => {
  localStorage.clear();
  useAutonHomeStore.setState({ homeVisible: true });
  fixture.view = "workers";
  fixture.onSelectTask.mockClear();
  fixture.tree.tasks = [
    task("orch1", "p1", 1, "Orquestador Lunar"),
    task("legacy1", "p1", 2, "Chat legado Lunar"),
    task("sess_auton_agent_1", "p1", 3, "Worker Lunar"),
    task("orch2", "p2", 1, "Orquestador Otro"),
    task("legacy2", "p2", 2, "Chat legado Otro"),
  ];
});

afterEach(cleanup);

describe("panel del proyecto", () => {
  it("la app arranca en proyectos, sin chats ni menú nativo", () => {
    render(<ProjectSidebar {...props()} />);

    expect(screen.getByTestId("auton-project-picker")).toBeTruthy();
    expect(screen.getByRole("option", { name: /Lunar/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Otro/ })).toBeTruthy();
    expect(screen.queryByTestId("workers-panel-placeholder")).toBeNull();
    expect(screen.queryByTestId("auton-project-switcher")).toBeNull();
    expect(screen.queryByTestId("sidebar-view-menu")).toBeNull();
    expect(screen.queryByText("Chat legado Lunar")).toBeNull();
    expect(screen.queryByText("Orquestador Lunar")).toBeNull();
    expect(screen.queryByText("taskList.title")).toBeNull();
    expect(screen.queryByText("New task")).toBeNull();
    expect(screen.queryByTestId("virtual-project-create-task")).toBeNull();
  });

  it("dentro del proyecto la cabecera muestra nombre y ruta, sin chats", () => {
    useAutonHomeStore.setState({ homeVisible: false });
    fixture.view = "workers";
    render(<ProjectSidebar {...props()} />);

    expect(screen.getByTestId("workers-panel-placeholder")).toBeTruthy();
    expect(screen.queryByTestId("auton-project-picker")).toBeNull();
    expect(screen.queryByText("Chat legado Lunar")).toBeNull();
    expect(screen.queryByText("Orquestador Lunar")).toBeNull();

    const switcher = screen.getByTestId("auton-project-switcher");
    expect(switcher.textContent).toContain("Lunar");
    expect(switcher.textContent).toContain("/workspace/lunar");
    expect(switcher.querySelector("[data-desktop-logo-badge]")).toBeNull();
  });

  it("elegir el proyecto abre su orquestador y vuelve a workers", () => {
    render(<ProjectSidebar {...props()} />);

    fireEvent.click(screen.getByRole("option", { name: /Lunar/ }));

    expect(fixture.onSelectTask).toHaveBeenCalledWith("/workspace/lunar", "orch1", undefined);
    expect(fixture.view).toBe("workers");
    expect(useAutonHomeStore.getState().homeVisible).toBe(false);
  });
});
