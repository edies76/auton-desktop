// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutonWorkerFocusStore } from "../src/auton/project-space/workerFocusStore.js";
import { AutonWorkersSidebar } from "../src/project-sidebar/AutonWorkersSidebar.js";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

const state = vi.hoisted(() => {
  const acquire = vi.fn((_taskId: string) => ({ release: () => undefined }));
  const subagentCounts: Record<string, string[]> = {};
  const listSessionSubagents = vi.fn(async (params: { sessionId: string }) => ({
    revision: 0,
    childSessionIds: subagentCounts[params.sessionId] ?? [],
    running: [],
    ended: { total: 0, items: [] },
  }));
  return {
    rows: [] as unknown[],
    activeTaskId: "orch" as string | null,
    stopGeneration: vi.fn(async () => undefined),
    acquire,
    layer: { acquire },
    subagentCounts,
    listSessionSubagents,
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
    zcodeAgentService: { listSessionSubagents: state.listSessionSubagents },
  }),
}));

vi.mock("@/store/zcodeSessionStore.js", () => ({
  useZCodeSessionStore: (selector: (value: { workspaces: Record<string, { activeTaskId: string }> }) => unknown) =>
    selector({ workspaces: { "/workspace/lunar": { activeTaskId: state.activeTaskId ?? "" } } }),
}));

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

function fullWorkerRow(
  overrides: {
    rowId?: number;
    childSessionId?: string;
    title?: string;
    seq?: number;
  } = {},
) {
  return {
    kind: "subagent",
    rowId: overrides.rowId ?? 12,
    turnId: "turn_1",
    parentToolCallId: "tool-2",
    childSessionId: overrides.childSessionId ?? "auton-1",
    subagentType: "auton-worker",
    title: overrides.title ?? "Agente completo",
    status: "running",
    summaryText: "Revisando el README",
    startedAt: NOW - 2_000,
    lastActivityAt: NOW - 1_000,
    createdAt: NOW - 2_000,
    createdAtSeq: overrides.seq ?? 2,
  };
}

function renderSidebar(orchestratorTaskId: string | null = "orch") {
  return render(
    <AutonWorkersSidebar
      workspacePath="/workspace/lunar"
      orchestratorTaskId={orchestratorTaskId}
    />,
  );
}

afterEach(() => {
  cleanup();
  state.rows = [];
  state.activeTaskId = "orch";
  state.stopGeneration.mockClear();
  state.acquire.mockClear();
  state.listSessionSubagents.mockClear();
  for (const key of Object.keys(state.subagentCounts)) {
    delete state.subagentCounts[key];
  }
  useAutonWorkerFocusStore.getState().close();
});

describe("sidebar de workers del proyecto", () => {
  it("en la vista del orquestador solo lista agentes completos", () => {
    state.rows = [subagentRow(), fullWorkerRow()];
    renderSidebar();

    expect(document.querySelector('[data-worker-id="orch"]')).toBeNull();
    expect(screen.getByTestId("auton-worker-group-agent").textContent).toContain("Agente completo");
    expect(screen.getByTestId("auton-worker-group-agent").textContent).not.toContain(
      "Arreglar login",
    );
    expect(screen.queryByTestId("auton-worker-group-subagent")).toBeNull();
    expect(screen.getByTestId("auton-worker-group-muse").textContent).toContain(
      "Sin workers Muse.",
    );
    expect(screen.getAllByTestId("auton-worker-row")).toHaveLength(1);
  });

  it("muestra cuántos subagentes creó cada worker sin abrirlo", async () => {
    state.rows = [
      fullWorkerRow(),
      fullWorkerRow({ rowId: 13, childSessionId: "auton-2", title: "Segundo agente", seq: 3 }),
    ];
    state.subagentCounts["auton-1"] = ["sub-1", "sub-2"];
    state.subagentCounts["auton-2"] = ["sub-3"];
    renderSidebar();

    await waitFor(() => {
      expect(screen.getAllByTestId("auton-worker-subagent-count")).toHaveLength(2);
    });
    const counts = screen
      .getAllByTestId("auton-worker-subagent-count")
      .map((node) => node.textContent);
    expect(counts.sort()).toEqual(["1", "2"]);
    expect(state.listSessionSubagents).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "auton-1", endedLimit: 1 }),
    );
  });

  it("no pinta un contador vacío cuando el worker no creó subagentes", () => {
    state.rows = [fullWorkerRow()];
    renderSidebar();

    expect(screen.queryByTestId("auton-worker-subagent-count")).toBeNull();
  });

  it("al abrir un worker aparecen sus subagentes y el contador", () => {
    state.rows = [subagentRow(), fullWorkerRow()];
    renderSidebar();

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-agent")).getByTestId("auton-worker-open"),
    );

    const subagents = screen.getByTestId("auton-worker-group-subagent");
    expect(subagents.textContent).toContain("Explorar login");
    expect(
      within(screen.getByTestId("auton-worker-group-agent")).getByTestId(
        "auton-worker-subagent-count",
      ).textContent,
    ).toContain("1");
  });

  it("abre el worker completo en la interfaz del orquestador", () => {
    state.rows = [fullWorkerRow()];
    renderSidebar();

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-agent")).getByTestId("auton-worker-open"),
    );
    expect(useAutonWorkerFocusStore.getState().selectedWorkerId).toBe("auton-1");
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

  it("sin orquestador publicado no ofrece parar aunque lea la sesión activa", () => {
    state.activeTaskId = "sess_auton_agent_1";
    state.rows = [fullWorkerRow()];
    renderSidebar(null);

    expect(state.acquire).toHaveBeenCalledWith("sess_auton_agent_1");
    expect(screen.getByTestId("auton-worker-group-agent").textContent).toContain(
      "Agente completo",
    );
    expect(screen.queryByTestId("auton-worker-stop")).toBeNull();
    expect(state.stopGeneration).not.toHaveBeenCalled();
  });

  it("el botón Plan despliega el tablero desde el sidebar y Hilo lo repliega", async () => {
    state.rows = [fullWorkerRow()];
    renderSidebar();

    fireEvent.click(screen.getByTestId("auton-plan-open"));
    expect(screen.getByTestId("auton-workers-sidebar-plan")).toBeTruthy();
    expect(screen.getByTestId("auton-sprint-board")).toBeTruthy();
    // El panel de workers queda detras: el tablero se desliza sobre el centro.
    expect(screen.getByTestId("auton-worker-panel")).toBeTruthy();

    fireEvent.click(screen.getByTestId("auton-sprint-board-back"));
    await waitFor(() => {
      expect(screen.queryByTestId("auton-workers-sidebar-plan")).toBeNull();
    });
    expect(screen.getByTestId("auton-worker-panel")).toBeTruthy();
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
    state.rows = [subagentRow(), fullWorkerRow()];
    renderSidebar();
    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-agent")).getByTestId("auton-worker-open"),
    );

    fireEvent.click(
      within(screen.getByTestId("auton-worker-group-subagent")).getByTestId("auton-worker-stop"),
    );
    expect(state.stopGeneration).toHaveBeenCalledWith({
      taskId: "orch",
      workspacePath: "/workspace/lunar",
    });
  });
});
