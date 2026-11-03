// @vitest-environment jsdom
import type { ProjectTask } from "@zcode/services";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  useZCodeSessionStore: (selector: (value: { getWorkspaceState: () => { activeTaskId: string } }) => unknown) =>
    selector({ getWorkspaceState: () => ({ activeTaskId: "orch" }) }),
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

afterEach(() => {
  cleanup();
  state.rows = [];
  state.stopGeneration.mockClear();
});

describe("sidebar de workers del proyecto", () => {
  it("muestra el proyecto, separa agentes de subagentes y excluye al orquestador", () => {
    state.rows = [subagentRow()];
    render(
      <AutonWorkersSidebar
        tasks={TASKS}
        workspacePath="/workspace/lunar"
      />,
    );

    expect(document.querySelector('[data-worker-id="orch"]')).toBeNull();
    expect(screen.getByTestId("auton-worker-group-agent").textContent).toContain("Arreglar login");
    expect(screen.getByTestId("auton-worker-group-subagent").textContent).toContain("worker 1");
    expect(screen.getByTestId("auton-worker-group-muse").textContent).toContain("Próximamente");
    expect(screen.getAllByTestId("auton-worker-row")).toHaveLength(2);
  });

  it("abre el detalle del worker sin compositor y vuelve al panel", () => {
    state.rows = [subagentRow()];
    render(
      <AutonWorkersSidebar
        tasks={TASKS}
        workspacePath="/workspace/lunar"

      />,
    );

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-agent")).getByTestId("auton-worker-open"),
    );
    expect(screen.getByTestId("auton-worker-detail")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByTestId("auton-worker-back"));
    expect(screen.getByTestId("auton-worker-panel")).toBeTruthy();
  });

  it("para un agente con la operación real de la sesión", () => {
    render(
      <AutonWorkersSidebar
        tasks={TASKS}
        workspacePath="/workspace/lunar"

      />,
    );

    const agentGroup = screen.getByTestId("auton-worker-group-agent");
    fireEvent.click(within(agentGroup).getByTestId("auton-worker-stop"));
    expect(state.stopGeneration).toHaveBeenCalledWith({
      taskId: "worker-1",
      workspacePath: "/workspace/lunar",
    });
    expect(
      within(screen.getByTestId("auton-worker-group-subagent")).queryByTestId(
        "auton-worker-stop",
      ),
    ).toBeNull();
  });
});
