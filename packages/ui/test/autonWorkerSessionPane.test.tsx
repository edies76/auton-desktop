// @vitest-environment jsdom
import type { ZCodeTaskMeta } from "@zcode/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutonWorkerSessionPane } from "../src/auton/project-space/WorkerSessionPane.js";
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
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  stopGeneration.mockClear();
  useAutonWorkerFocusStore.getState().close();
});

describe("sesión de worker abierta como tarea activa", () => {
  it("la muestra como worker de solo lectura, sin etiqueta de orquestador ni compositor", () => {
    render(
      <AutonWorkerSessionPane
        taskId="sess_auton_agent_1"
        title="Worker heredado"
        meta={meta({ status: "completed" })}
        workspacePath="/workspace/lunar"
      />,
    );

    const summary = screen.getByTestId("auton-worker-summary");
    expect(summary.textContent).toContain("Worker heredado");
    expect(summary.textContent).toContain("Terminado");
    expect(summary.textContent).not.toContain("Parar");
    expect(useAutonWorkerFocusStore.getState().workerId).toBe("sess_auton_agent_1");
  });

  it("vuelve al orquestador publicado en vez de cerrar sobre la sesión del worker", () => {
    const onBack = vi.fn();
    render(
      <AutonWorkerSessionPane
        taskId="sess_auton_agent_1"
        title="Worker heredado"
        meta={meta({ status: "running" })}
        workspacePath="/workspace/lunar"
        onBack={onBack}
      />,
    );

    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Trabajando");
    fireEvent.click(screen.getByTestId("auton-worker-focus-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("abre el chat completo de la sesión en solo lectura", () => {
    render(
      <AutonWorkerSessionPane
        taskId="sess_auton_agent_1"
        title="Worker heredado"
        meta={meta({ status: "running" })}
        workspacePath="/workspace/lunar"
      />,
    );

    fireEvent.click(screen.getByText("Ver chat completo"));
    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe("sess_auton_agent_1");
    expect(screen.getByTestId("v4-chat-pane").dataset.readonly).toBe("true");
  });
});
