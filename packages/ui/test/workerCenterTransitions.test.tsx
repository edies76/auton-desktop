// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveCenterView,
  type CenterViewInput,
} from "../src/auton/project-space/centerView.js";
import type { AutonWorkerView } from "../src/auton/project-space/model.js";
import { AutonWorkerSurface } from "../src/auton/project-space/WorkerSurface.js";
import {
  closeWorkerFocusForWorkspace,
  useAutonWorkerFocusStore,
} from "../src/auton/project-space/workerFocusStore.js";

const stopGeneration = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/v4/V4ChatPane.js", () => ({
  V4ChatPane: ({ sessionId, readOnly }: { sessionId: string; readOnly?: boolean }) => (
    <div
      data-testid="v4-chat-pane"
      data-session-id={sessionId}
      data-readonly={readOnly ? "true" : "false"}
    />
  ),
}));

vi.mock("@/hooks/useWorkspaceServices.js", () => ({
  useBaseWorkspaceServices: () => ({ zcodeTaskService: { stopGeneration } }),
}));

const A: AutonWorkerView = {
  id: "sess_auton_agent_1",
  name: "Worker A",
  status: "trabajando",
  startedAt: 1_000,
  lastSignalAt: 2_000,
  lastLine: "Trabajando en A",
  transcript: [],
};

const B: AutonWorkerView = {
  id: "sess_subagent_agent_2",
  name: "Worker B",
  status: "trabajando",
  startedAt: 1_000,
  lastSignalAt: 2_000,
  lastLine: "Trabajando en B",
  transcript: [],
};

function Harness({
  initialActiveTaskId,
  orchestratorTaskId,
  onSelect,
}: {
  initialActiveTaskId: string;
  orchestratorTaskId: string | null;
  onSelect?: () => void;
}) {
  const [activeTaskId, setActiveTaskId] = useState(initialActiveTaskId);
  const selectedWorkerId = useAutonWorkerFocusStore((state) => state.selectedWorkerId);
  const selectionOrigin = useAutonWorkerFocusStore((state) => state.selectionOrigin);
  const input: CenterViewInput = {
    activeTaskId,
    selectedWorkerId,
    selectionOrigin,
    orchestratorTaskId,
  };
  const view = resolveCenterView(input);
  return (
    <AutonWorkerSurface
      view={view}
      activeTaskTitle="Worker A"
      workspacePath="/workspace/lunar"
      onSelectOrchestrator={() => {
        setActiveTaskId(orchestratorTaskId ?? activeTaskId);
        onSelect?.();
      }}
    />
  );
}

function selectPanelWorker(workerId: string) {
  act(() => {
    useAutonWorkerFocusStore.getState().select(workerId, "/workspace/lunar");
  });
}

beforeEach(() => {
  useAutonWorkerFocusStore.getState().setLiveWorkers([A, B]);
  useAutonWorkerFocusStore.getState().close();
});

afterEach(() => {
  cleanup();
  stopGeneration.mockClear();
  useAutonWorkerFocusStore.getState().close();
  useAutonWorkerFocusStore.getState().setLiveWorkers([]);
});

describe("transiciones del centro entre orquestador y workers", () => {
  it("una selección del panel gana sobre la sesión de worker activa", () => {
    render(<Harness initialActiveTaskId={A.id} orchestratorTaskId="orch" />);

    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Worker A");

    selectPanelWorker(B.id);
    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Worker B");
    expect(screen.getByTestId("auton-worker-summary").textContent).not.toContain("Worker A");

    fireEvent.click(screen.getByText("Ver chat completo"));
    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe(B.id);
    expect(screen.getByTestId("v4-chat-pane").dataset.readonly).toBe("true");

    selectPanelWorker(A.id);
    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Worker A");
    expect(screen.queryByTestId("auton-worker-chat")).toBeNull();
  });

  it("volver desde la sesión de worker llega al orquestador en una sola acción", () => {
    const onSelect = vi.fn();
    render(
      <Harness
        initialActiveTaskId={A.id}
        orchestratorTaskId="orch"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByTestId("auton-worker-focus-back"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(useAutonWorkerFocusStore.getState().selectedWorkerId).toBeNull();
    expect(screen.queryByTestId("auton-worker-summary")).toBeNull();
  });

  it("parar usa el turno del orquestador y no el id del worker", () => {
    render(<Harness initialActiveTaskId={A.id} orchestratorTaskId="orch" />);

    fireEvent.click(screen.getByTestId("auton-worker-focus-stop"));
    expect(stopGeneration).toHaveBeenCalledWith({
      taskId: "orch",
      workspacePath: "/workspace/lunar",
    });
  });

  it("sin orquestador publicado no ofrece parar y no cae al worker", () => {
    render(<Harness initialActiveTaskId={A.id} orchestratorTaskId={null} />);

    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Worker A");
    expect(screen.queryByTestId("auton-worker-focus-stop")).toBeNull();
    expect(screen.queryByTestId("auton-worker-focus-back")).toBeNull();

    selectPanelWorker(B.id);
    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Worker B");
    expect(screen.queryByTestId("auton-worker-focus-stop")).toBeNull();
    expect(stopGeneration).not.toHaveBeenCalled();
  });

  it("cambiar de workspace cierra selección y datos viejos", () => {
    render(<Harness initialActiveTaskId={A.id} orchestratorTaskId="orch" />);
    selectPanelWorker(B.id);

    act(() => {
      closeWorkerFocusForWorkspace("/workspace/otro");
    });

    expect(useAutonWorkerFocusStore.getState().selectedWorkerId).toBeNull();
    expect(useAutonWorkerFocusStore.getState().liveWorkers).toEqual([]);
  });
});
