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

vi.mock("@/v4/V4ChatPane.js", () => ({
  V4ChatPane: ({ sessionId, readOnly }: { sessionId: string; readOnly?: boolean }) => (
    <div
      data-testid="v4-chat-pane"
      data-session-id={sessionId}
      data-readonly={readOnly ? "true" : "false"}
    />
  ),
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
  const liveWorkers = useAutonWorkerFocusStore((state) => state.liveWorkers);
  const selectedWorkerExists = Boolean(
    selectedWorkerId && liveWorkers.some((worker) => worker.id === selectedWorkerId),
  );
  const input: CenterViewInput = {
    activeTaskId,
    selectedWorkerId,
    selectionOrigin,
    orchestratorTaskId,
    selectedWorkerExists,
  };
  const view = resolveCenterView(input);
  if (view.kind === "orchestrator") {
    return <div data-testid="orchestrator-chat" />;
  }
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
  useAutonWorkerFocusStore.getState().close();
  useAutonWorkerFocusStore.getState().setLiveWorkers([]);
});

describe("transiciones del centro entre orquestador y workers", () => {
  it("abrir un worker muestra su chat completo y la selección del panel gana", () => {
    render(<Harness initialActiveTaskId={A.id} orchestratorTaskId="orch" />);

    expect(screen.getByTestId("auton-worker-chat")).toBeTruthy();
    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe(A.id);

    selectPanelWorker(B.id);
    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe(B.id);
    expect(screen.getByTestId("v4-chat-pane").dataset.readonly).toBe("true");
    expect(screen.queryByTestId("auton-worker-summary")).toBeNull();
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
    expect(screen.queryByTestId("auton-worker-chat")).toBeNull();
    expect(screen.getByTestId("orchestrator-chat")).toBeTruthy();
  });

  it("volver desde una selección sobre worker activo llega al orquestador en una acción", () => {
    const onSelect = vi.fn();
    render(
      <Harness
        initialActiveTaskId={A.id}
        orchestratorTaskId="orch"
        onSelect={onSelect}
      />,
    );

    selectPanelWorker(B.id);
    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe(B.id);

    fireEvent.click(screen.getByTestId("auton-worker-focus-back"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("auton-worker-chat")).toBeNull();
    expect(screen.getByTestId("orchestrator-chat")).toBeTruthy();
  });

  it("una selección que ya no existe cae en el orquestador", () => {
    render(<Harness initialActiveTaskId="orch" orchestratorTaskId="orch" />);

    selectPanelWorker("worker-borrado");

    expect(screen.queryByTestId("auton-worker-chat")).toBeNull();
    expect(screen.getByTestId("orchestrator-chat")).toBeTruthy();
  });

  it("sin orquestador publicado el chat se abre sin botón de vuelta", () => {
    render(<Harness initialActiveTaskId={A.id} orchestratorTaskId={null} />);

    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe(A.id);
    expect(screen.queryByTestId("auton-worker-focus-back")).toBeNull();

    selectPanelWorker(B.id);
    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe(B.id);
    expect(screen.queryByTestId("auton-worker-focus-back")).toBeNull();
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
