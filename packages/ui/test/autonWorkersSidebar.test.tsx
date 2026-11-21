// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AutonWorkerView } from "../src/auton/project-space/model.js";
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
  describe("ticks y ráfagas (rendimiento)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function subscribePublications(): { publications: AutonWorkerView[][]; stop: () => void } {
      const publications: AutonWorkerView[][] = [];
      const stop = useAutonWorkerFocusStore.subscribe((current, previous) => {
        if (current.liveWorkers !== previous.liveWorkers) {
          publications.push(current.liveWorkers);
        }
      });
      return { publications, stop };
    }

    async function flushEffects(): Promise<void> {
      await act(async () => {
        await Promise.resolve();
      });
    }

    it("un tick ocioso no vuelve a derivar ni a publicar la lista de workers", async () => {
      state.rows = [fullWorkerRow()];
      renderSidebar();
      await flushEffects();
      // La publicación inicial es coalescida (un macrotask): se deja correr.
      await act(async () => {
        vi.advanceTimersByTime(0);
      });
      await flushEffects();

      const { publications, stop } = subscribePublications();
      const firstList = useAutonWorkerFocusStore.getState().liveWorkers;
      expect(firstList.length).toBeGreaterThan(0);
      const firstWorker = firstList[0];
      const clockBefore = document.querySelector('[data-testid="auton-worker-clock"]')
        ?.textContent;

      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });
      await flushEffects();

      // 0 escrituras al store por tick: la misma referencia, ningún objeto nuevo.
      expect(publications).toHaveLength(0);
      const afterList = useAutonWorkerFocusStore.getState().liveWorkers;
      expect(afterList).toBe(firstList);
      expect(afterList[0]).toBe(firstWorker);
      // Los relojes visibles siguen avanzando.
      const clockAfter = document.querySelector('[data-testid="auton-worker-clock"]')
        ?.textContent;
      expect(clockAfter).not.toBe(clockBefore);
      stop();
    });

    it("una ráfaga de 50 actualizaciones publica como máximo 3 veces y gana la última", async () => {
      state.rows = [fullWorkerRow()];
      const view = render(
        <AutonWorkersSidebar workspacePath="/workspace/lunar" orchestratorTaskId="orch" />,
      );
      await flushEffects();

      const { publications, stop } = subscribePublications();
      for (let index = 0; index < 50; index += 1) {
        state.rows = [
          fullWorkerRow(),
          fullWorkerRow({
            rowId: 200 + index,
            childSessionId: `auton-burst-${index}`,
            title: `Ráfaga ${index}`,
            seq: 100 + index,
          }),
        ];
        await act(async () => {
          // Elemento nuevo por actualización: con el mismo árbol React hace
          // bailout y la ráfaga no llegaría al componente.
          view.rerender(
            <AutonWorkersSidebar workspacePath="/workspace/lunar" orchestratorTaskId="orch" />,
          );
        });
      }
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
      await flushEffects();

      expect(publications.length).toBeLessThanOrEqual(3);
      const live = useAutonWorkerFocusStore.getState().liveWorkers;
      expect(live.map((worker) => worker.id)).toContain("auton-burst-49");
      stop();
    });
  });

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
