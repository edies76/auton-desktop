// @vitest-environment jsdom
import type { ZCodeTaskMeta } from "@zcode/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutonWorkerSurface, shouldRenderAutonWorkerSurface } from "../src/auton/project-space/WorkerSurface.js";
import { useAutonWorkerFocusStore } from "../src/auton/project-space/workerFocusStore.js";

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

function meta(overrides: Partial<ZCodeTaskMeta> = {}): ZCodeTaskMeta {
  return {
    taskId: "sess_auton_agent_1",
    traceId: "trace-1",
    title: "Worker heredado",
    workspacePath: "/workspace/lunar",
    createdAt: 1_000,
    updatedAt: 5_000,
    mode: "build",
    status: "running",
    ...overrides,
  };
}

function ShellHarness({ onSelect }: { onSelect?: () => void }) {
  const [activeTaskId, setActiveTaskId] = useState("sess_auton_agent_1");
  return (
    <AutonWorkerSurface
      activeTaskId={activeTaskId}
      activeTaskTitle="Worker heredado"
      activeTaskMeta={meta()}
      workspacePath="/workspace/lunar"
      orchestratorTaskId="orch"
      onSelectOrchestrator={() => {
        setActiveTaskId("orch");
        onSelect?.();
      }}
    />
  );
}

afterEach(() => {
  cleanup();
  stopGeneration.mockClear();
  useAutonWorkerFocusStore.getState().close();
});

describe("superficie de worker usada por el shell", () => {
  it("la condición del shell cubre sesión de worker y foco del panel, no el orquestador", () => {
    expect(shouldRenderAutonWorkerSurface("sess_auton_agent_1", null)).toBe(true);
    expect(shouldRenderAutonWorkerSurface("orch", "worker-sidebar")).toBe(true);
    expect(shouldRenderAutonWorkerSurface("orch", null)).toBe(false);
  });

  it("vuelve al orquestador con una sola acción y sin resumen rezagado", () => {
    const onSelect = vi.fn();
    render(<ShellHarness onSelect={onSelect} />);

    expect(screen.getByTestId("auton-worker-summary")).toBeTruthy();
    fireEvent.click(screen.getByTestId("auton-worker-focus-back"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(useAutonWorkerFocusStore.getState().workerId).toBeNull();
    expect(screen.queryByTestId("auton-worker-summary")).toBeNull();
  });

  it("parar desde la sesión de worker interrumpe el turno del orquestador", () => {
    render(<ShellHarness />);

    fireEvent.click(screen.getByTestId("auton-worker-focus-stop"));
    expect(stopGeneration).toHaveBeenCalledWith({
      taskId: "orch",
      workspacePath: "/workspace/lunar",
    });
  });

  it("sigue mostrando el foco elegido en el panel cuando la tarea activa es el orquestador", () => {
    useAutonWorkerFocusStore.getState().open(
      {
        id: "worker-sidebar",
        name: "Worker del panel",
        status: "trabajando",
        startedAt: 1_000,
        lastSignalAt: 2_000,
        transcript: [],
      },
      "/workspace/lunar",
    );

    render(
      <AutonWorkerSurface
        activeTaskId="orch"
        activeTaskTitle="Orquestador"
        workspacePath="/workspace/lunar"
        orchestratorTaskId="orch"
        onSelectOrchestrator={vi.fn()}
      />,
    );

    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Worker del panel");
  });
});
