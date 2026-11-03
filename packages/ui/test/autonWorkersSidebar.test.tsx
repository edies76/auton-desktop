// @vitest-environment jsdom
import type { ProjectTask } from "@zcode/services";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutonWorkerFocusStore } from "../src/auton/project-space/workerFocusStore.js";
import { AutonWorkersSidebar } from "../src/project-sidebar/AutonWorkersSidebar.js";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

const state = vi.hoisted(() => {
  const acquire = vi.fn((_taskId: string) => ({ release: () => undefined }));
  return {
    rows: [] as unknown[],
    activeTaskId: "orch" as string | null,
    stopGeneration: vi.fn(async () => undefined),
    acquire,
    layer: { acquire },
  };
});

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
    selector({ workspaces: { "/workspace/lunar": { activeTaskId: state.activeTaskId ?? "" } } }),
}));

function task(taskId: string, title: string): ProjectTask {
  return {
    taskId,
    title,
    status: "running",
    createdAt: NOW - 5_000,
    updatedAt: NOW - 200,
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
    subagentType: "Explore",
    title: "Explorar login",
    status: "running",
    summaryText: "Revisando el login",
    startedAt: NOW - 3_000,
    lastActivityAt: NOW - 1_000,
    createdAt: NOW - 3_000,
    createdAtSeq: 1,
  };
}

function fullWorkerRow() {
  return {
    kind: "subagent",
    rowId: 12,
    turnId: "turn_1",
    parentToolCallId: "tool-2",
    childSessionId: "auton-1",
    subagentType: "auton-worker",
    title: "Agente completo",
    status: "running",
    summaryText: "Revisando el README",
    startedAt: NOW - 2_000,
    lastActivityAt: NOW - 1_000,
    createdAt: NOW - 2_000,
    createdAtSeq: 2,
  };
}

const TASKS = [task("orch", "Orquestador"), task("legacy", "Chat legado")];

function renderSidebar() {
  return render(
    <AutonWorkersSidebar
      tasks={TASKS}
      workspacePath="/workspace/lunar"
      orchestratorTaskId="orch"
    />,
  );
}

afterEach(() => {
  cleanup();
  state.rows = [];
  state.activeTaskId = "orch";
  state.stopGeneration.mockClear();
  state.acquire.mockClear();
  useAutonWorkerFocusStore.getState().close();
});

describe("sidebar de workers del proyecto", () => {
  it("los agentes completos salen de la proyección viva y los subagentes se separan", () => {
    state.rows = [subagentRow(), fullWorkerRow()];
    renderSidebar();

    expect(document.querySelector('[data-worker-id="orch"]')).toBeNull();
    expect(screen.getByTestId("auton-worker-group-agent").textContent).toContain("Agente completo");
    expect(screen.getByTestId("auton-worker-group-agent").textContent).not.toContain(
      "Arreglar login",
    );
    expect(screen.getByTestId("auton-worker-group-subagent").textContent).toContain("Explore 1");
    expect(screen.getByTestId("auton-worker-group-muse").textContent).toContain("Próximamente");
    expect(screen.getAllByTestId("auton-worker-row")).toHaveLength(2);
  });

  it("abre el worker completo en la interfaz del orquestador", () => {
    state.rows = [fullWorkerRow()];
    renderSidebar();

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-agent")).getByTestId("auton-worker-open"),
    );
    expect(useAutonWorkerFocusStore.getState().selectedWorkerId).toBe("auton-1");
    expect(useAutonWorkerFocusStore.getState().mode).toBe("summary");
  });

  it("con una sesión de worker activa sigue leyendo el orquestador publicado", () => {
    state.activeTaskId = "sess_auton_agent_1";
    state.rows = [fullWorkerRow()];
    renderSidebar();

    expect(state.acquire).toHaveBeenCalledWith("orch");
    expect(screen.getByTestId("auton-worker-group-agent").textContent).toContain(
      "Agente completo",
    );
  });

  it("para un agente completo interrumpiendo el turno del orquestador", () => {
    state.rows = [fullWorkerRow()];
    renderSidebar();

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-agent")).getByTestId("auton-worker-stop"),
    );
    expect(state.stopGeneration).toHaveBeenCalledWith({
      taskId: "orch",
      workspacePath: "/workspace/lunar",
    });
  });

  it("un subagente se para interrumpiendo el turno del orquestador", () => {
    state.rows = [subagentRow()];
    renderSidebar();

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-subagent")).getByTestId("auton-worker-stop"),
    );
    expect(state.stopGeneration).toHaveBeenCalledWith({
      taskId: "orch",
      workspacePath: "/workspace/lunar",
    });
  });
});
