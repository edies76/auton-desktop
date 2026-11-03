// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutonWorkerView } from "../src/auton/project-space/model.js";
import { AutonWorkerFocusPane } from "../src/auton/project-space/WorkerFocusPane.js";
import { useAutonWorkerFocusStore } from "../src/auton/project-space/workerFocusStore.js";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);
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

const WORKER: AutonWorkerView = {
  id: "worker-1",
  name: "Arreglar login",
  status: "trabajando",
  startedAt: NOW - 60_000,
  lastSignalAt: NOW - 2_000,
  lastLine: "Revisa la restauración de sesión",
  transcript: [{ id: "e1", at: NOW - 50_000, kind: "message", text: "Empiezo por el login" }],
};

afterEach(() => {
  cleanup();
  stopGeneration.mockClear();
  useAutonWorkerFocusStore.getState().close();
});

describe("resumen del worker en el área del orquestador", () => {
  it("muestra estado y resumen, y abre el chat completo de solo lectura", () => {
    useAutonWorkerFocusStore.getState().open(WORKER, "/workspace/lunar");
    render(<AutonWorkerFocusPane />);

    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Trabajando");
    expect(screen.getByTestId("auton-worker-summary").textContent).toContain(
      "Revisa la restauración de sesión",
    );

    fireEvent.click(screen.getByText("Ver chat completo"));
    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe("worker-1");
    expect(screen.getByTestId("v4-chat-pane").dataset.readonly).toBe("true");

    fireEvent.click(screen.getByText("Resumen"));
    expect(screen.getByTestId("auton-worker-summary")).toBeTruthy();

    fireEvent.click(screen.getByTestId("auton-worker-focus-back"));
    expect(useAutonWorkerFocusStore.getState().workerId).toBeNull();
  });

  it("se actualiza con la proyección viva: estado y reloj no quedan congelados", () => {
    useAutonWorkerFocusStore.getState().open(WORKER, "/workspace/lunar");
    render(<AutonWorkerFocusPane />);
    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Trabajando");

    act(() => {
      useAutonWorkerFocusStore.getState().setLiveWorkers([
        { ...WORKER, status: "terminado", lastSignalAt: NOW },
      ]);
    });

    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Terminado");
    expect(screen.getByTestId("auton-worker-summary").textContent).not.toContain("Trabajando");
  });

  it("parar interrumpe el turno del orquestador que controla al worker", () => {
    useAutonWorkerFocusStore.getState().open(WORKER, "/workspace/lunar", undefined, "orch");
    render(<AutonWorkerFocusPane />);

    fireEvent.click(screen.getByTestId("auton-worker-focus-stop"));
    expect(stopGeneration).toHaveBeenCalledWith({
      taskId: "orch",
      workspacePath: "/workspace/lunar",
    });

    act(() => {
      useAutonWorkerFocusStore
        .getState()
        .setLiveWorkers([{ ...WORKER, status: "bloqueado", lastLine: "Detenido por el orquestador" }]);
    });
    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Bloqueado");
    expect(screen.getByTestId("auton-worker-summary").textContent).not.toContain("Parar");
  });

  it("el reloj del resumen avanza con la sesión viva", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      useAutonWorkerFocusStore
        .getState()
        .open({ ...WORKER, lastSignalAt: NOW }, "/workspace/lunar");
      render(<AutonWorkerFocusPane />);
      expect(screen.getByTestId("auton-worker-summary").textContent).toContain("01:00");

      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(screen.getByTestId("auton-worker-summary").textContent).toContain("01:05");
    } finally {
      vi.useRealTimers();
    }
  });
});
