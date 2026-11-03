// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { forwardRef, Fragment, type ReactNode, type Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectSidebarProps } from "@/project-sidebar/contract.js";
import { ProjectSidebar } from "@/project-sidebar/index.js";

const fixture = vi.hoisted(() => ({
  view: "workers" as "workers" | "timeline" | "grouped" | "projects",
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
  captured: {
    timeline: [] as string[],
    pinned: [] as string[],
    grouped: [] as string[],
    projectRows: {} as Record<string, string[]>,
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

vi.mock("@/project-sidebar/useProjectPinIntent.js", () => ({
  useProjectPinIntent: () => ({ tree: fixture.tree, pin: vi.fn() }),
}));
vi.mock("@/project-sidebar/useProjectRemoteSync.js", () => ({
  useProjectRemoteSync: () => ({ actions: [], dialog: null }),
}));
vi.mock("@/project-sidebar/useProjectConnectionDiagnostics.js", () => ({
  useProjectConnectionDiagnostics: () => new Map(),
}));
vi.mock("@/project-sidebar/useProjectTaskNavigation.js", () => ({
  useProjectTaskNavigation: () => fixture.onSelectTask,
}));
vi.mock("@/project-sidebar/useProjectFileTree.js", () => ({
  useProjectFileTree: () => ({ openFiles: vi.fn(), openTaskFiles: vi.fn() }),
}));
vi.mock("@/hooks/useWebRemoteControlStatus.js", () => ({
  useWebRemoteControlStatus: () => ({ mobileConnected: false }),
}));
vi.mock("@/WebRemoteControlFeatureProvider.js", () => ({
  useWebRemoteControlFeatureEnabled: () => false,
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
  AutonWorkersSidebar: () => null,
}));
vi.mock("@/project-sidebar/ProjectSidebarListHeader.js", () => ({
  ProjectSidebarListHeader: () => <div data-testid="list-header" />,
}));
vi.mock("@/project-sidebar/ProjectTaskRows.js", () => ({
  ProjectTaskRows: ({
    kind,
    tasks,
  }: {
    kind: "timeline" | "pinned";
    tasks: Array<{ taskId: string }>;
  }) => {
    fixture.captured[kind] = tasks.map((entry) => entry.taskId);
    return <div data-testid={`task-rows-${kind}`} />;
  },
}));
vi.mock("@/project-sidebar/TaskGroupedView.js", () => ({
  TaskGroupedView: ({ tasks }: { tasks: Array<{ taskId: string }> }) => {
    fixture.captured.grouped = tasks.map((entry) => entry.taskId);
    return <div data-testid="grouped-view" />;
  },
}));
vi.mock("@/project-sidebar/SortableProjects.js", () => ({ SortableProjects: () => null }));
vi.mock("@/project-sidebar/ProjectSections.js", () => ({
  ProjectSections: ({
    projects,
    renderProject,
  }: {
    projects: Array<{ id: string }>;
    renderProject: (project: { id: string }) => ReactNode;
  }) => (
    <div data-testid="project-sections">
      {projects.map((project) => (
        <Fragment key={project.id}>{renderProject(project)}</Fragment>
      ))}
    </div>
  ),
}));
vi.mock("@/project-sidebar/ProjectSidebarNode.js", () => ({
  ProjectSidebarNode: ({
    project,
    tasks,
  }: {
    project: { id: string };
    tasks: Array<{ taskId: string }>;
  }) => {
    fixture.captured.projectRows[project.id] = tasks.map((task) => task.taskId);
    return <div data-testid={`project-node-${project.id}`} />;
  },
  runProjectAction: (action: () => void) => action(),
}));
vi.mock("@/project-sidebar/ProjectCreation.js", () => ({ ProjectCreation: () => null }));
vi.mock("@/project-sidebar/ProjectEditor.js", () => ({ ProjectEditor: () => null }));
vi.mock("@/project-sidebar/RemoteProjectPicker.js", () => ({ RemoteProjectPicker: () => null }));
vi.mock("@/WorkspaceSidebarFooter.js", () => ({ WorkspaceSidebarFooter: () => null }));
vi.mock("@/sidebar-activity/SidebarBottomActivity.js", () => ({ SidebarBottomActivity: () => null }));

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
  fixture.view = "workers";
  fixture.onSelectTask.mockClear();
  fixture.captured.timeline = [];
  fixture.captured.pinned = [];
  fixture.captured.grouped = [];
  fixture.captured.projectRows = {};
  fixture.tree.tasks = [
    task("orch1", "p1", 1, "Orquestador Lunar"),
    task("legacy1", "p1", 2, "Chat legado Lunar"),
    task("sess_auton_agent_1", "p1", 3, "Worker Lunar"),
    task("sess_subagent_agent_1", "p1", 4, "Subagente Lunar"),
    task("orch2", "p2", 1, "Orquestador Otro"),
    task("legacy2", "p2", 2, "Chat legado Otro"),
    task("suelto", null, 3, "Chat sin proyecto"),
  ];
});

afterEach(() => {
  cleanup();
});

describe("vistas de tareas del proyecto", () => {
  it("timeline no muestra chats legados ni sesiones de worker", () => {
    const element = () => <ProjectSidebar {...props()} />;
    const { rerender } = render(element());
    act(() => {
      fixture.view = "timeline";
    });
    rerender(element());

    expect(screen.getByTestId("task-rows-timeline")).toBeTruthy();
    expect(fixture.captured.timeline.sort()).toEqual(["orch1", "orch2"]);
  });

  it("grouped no muestra chats legados ni sesiones de worker", () => {
    const element = () => <ProjectSidebar {...props()} />;
    const { rerender } = render(element());
    act(() => {
      fixture.view = "grouped";
    });
    rerender(element());

    expect(screen.getByTestId("grouped-view")).toBeTruthy();
    expect([...fixture.captured.grouped].sort()).toEqual(["orch1", "orch2"]);
  });

  it("la sección fijada no muestra el chat legado fijado ni workers", () => {
    fixture.tree.tasks = fixture.tree.tasks.map((entry) =>
      entry.taskId === "orch1" || entry.taskId === "legacy1"
        ? { ...entry, pinned: true }
        : entry,
    );
    const element = () => <ProjectSidebar {...props()} />;
    const { rerender } = render(element());
    act(() => {
      fixture.view = "grouped";
    });
    rerender(element());

    expect(fixture.captured.pinned).toEqual(["orch1"]);
  });

  it("cada fila de proyecto muestra solo su conversación de orquestador", () => {
    const element = () => <ProjectSidebar {...props()} />;
    const { rerender } = render(element());
    act(() => {
      fixture.view = "projects";
    });
    rerender(element());

    expect(screen.getByTestId("project-sections")).toBeTruthy();
    expect(fixture.captured.projectRows).toEqual({
      p1: ["orch1"],
      p2: ["orch2"],
    });
  });
});
