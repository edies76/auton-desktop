// @vitest-environment jsdom
import type { ProjectTask } from "@zcode/services";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutonWorkerFocusStore } from "../src/auton/project-space/workerFocusStore.js";
import { AutonWorkersSidebar } from "../src/project-sidebar/AutonWorkersSidebar.js";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  stopGeneration: vi.fn(async () => undefined),
  layer: { acquire: () => ({ release: () => undefined }) },
}));

vi.mock("@/v4/V4ConversationContext.js", () => ({
  V4PaneConversationProvider: ({ children }: { children: unknown }) => children,
  useV4Conversation: () => ({ layer: state.layer }),
}));

vi.mock("@/v4/useConversationProjection.js", () => ({
  useConversationProjection: () => ({ snapshot: { rows: { window: state.rows } } }),
}));

vi.mock("@/hooks/useWorkspaceServices.js", () => ({
  useBaseWorkspaceServices: () => ({
    zcodeTaskService: { stopGeneration: state.stopGeneration },
  }),
}));

vi.mock("@/store/zcodeSessionStore.js", () => ({
  useZCodeSessionStore: (selector: (value: { workspaces: Record<string, { activeTaskId: string }> }) => unknown) =>
    selector({ workspaces: { "/workspace/lunar": { activeTaskId: "orch" } } }),
}));

function task(
  taskId: string,
  title: string,
  status: ProjectTask["status"],
  createdAt: number,
  updatedAt: number,
): ProjectTask {
  return {
    taskId,
    title,
    status,
    createdAt,
    updatedAt,
    workspacePath: "/workspace/lunar",
    projectId: "p1",
    hostId: "local",
    archived: false,
  } as unknown as ProjectTask;
}

function subagentRow() {
  return {
    kind: "subagent",
    rowId: 11,
    turnId: "turn_1",
    parentToolCallId: "tool-1",
    childSessionId: "sub-1",
    subagentType: "auton-worker",
    status: "running",
    summaryText: "Revisando el login",
    startedAt: NOW - 3_000,
    lastActivityAt: NOW - 1_000,
    createdAt: NOW - 3_000,
    createdAtSeq: 1,
  };
}

const TASKS = [
  task("orch", "Orquestador", "running", NOW - 1_000, NOW - 100),
  task("worker-1", "Arreglar login", "running", NOW - 5_000, NOW - 200),
];

function renderSidebar() {
  return render(
    <AutonWorkersSidebar
      tasks={TASKS}
      workspacePath="/workspace/lunar"
      orchestratorTaskId="orch"
      workerTaskIds={["worker-1"]}
    />,
  );
}

afterEach(() => {
  cleanup();
  state.rows = [];
  state.stopGeneration.mockClear();
  useAutonWorkerFocusStore.getState().close();
});

describe("sidebar de workers del proyecto", () => {
  it("separa agentes de subagentes y excluye al orquestador", () => {
    state.rows = [subagentRow()];
    renderSidebar();

    expect(document.querySelector('[data-worker-id="orch"]')).toBeNull();
    expect(screen.getByTestId("auton-worker-group-agent").textContent).toContain("Arreglar login");
    expect(screen.getByTestId("auton-worker-group-subagent").textContent).toContain("worker 1");
    expect(screen.getByTestId("auton-worker-group-muse").textContent).toContain("Próximamente");
    expect(screen.getAllByTestId("auton-worker-row")).toHaveLength(2);
  });

  it("abre el worker en la interfaz del orquestador, no dentro del panel", () => {
    state.rows = [subagentRow()];
    renderSidebar();

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-agent")).getByTestId("auton-worker-open"),
    );
    expect(useAutonWorkerFocusStore.getState().worker?.id).toBe("worker-1");
    expect(useAutonWorkerFocusStore.getState().mode).toBe("summary");
  });

  it("para un agente con la operación real de la sesión", () => {
    renderSidebar();

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-agent")).getByTestId("auton-worker-stop"),
    );
    expect(state.stopGeneration).toHaveBeenCalledWith({
      taskId: "worker-1",
      workspacePath: "/workspace/lunar",
    });
  });

  it("los subagentes también se pueden parar desde su fila", () => {
    state.rows = [subagentRow()];
    renderSidebar();

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-subagent")).getByTestId("auton-worker-stop"),
    );
    expect(state.stopGeneration).toHaveBeenCalledWith({
      taskId: "sub-1",
      workspacePath: "/workspace/lunar",
    });
  });
});
