// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutonWorkerFocusPane } from "../src/auton/project-space/WorkerFocusPane.js";
import { useAutonWorkerFocusStore } from "../src/auton/project-space/workerFocusStore.js";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);
const stopGeneration = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/v4/V4ChatPane.js", () => ({
  V4ChatPane: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="v4-chat-pane" data-session-id={sessionId} />
  ),
}));

vi.mock("@/hooks/useWorkspaceServices.js", () => ({
  useBaseWorkspaceServices: () => ({ zcodeTaskService: { stopGeneration } }),
}));

afterEach(() => {
  cleanup();
  stopGeneration.mockClear();
  useAutonWorkerFocusStore.getState().close();
});

describe("resumen del worker en el área del orquestador", () => {
  it("muestra estado y resumen, y abre el chat completo de solo lectura", () => {
    useAutonWorkerFocusStore.getState().open(
      {
        id: "worker-1",
        name: "Arreglar login",
        status: "trabajando",
        startedAt: NOW - 60_000,
        lastSignalAt: NOW - 2_000,
        lastLine: "Revisa la restauración de sesión",
        transcript: [
          { id: "e1", at: NOW - 50_000, kind: "message", text: "Empiezo por el login" },
        ],
      },
      "/workspace/lunar",
    );
    render(<AutonWorkerFocusPane />);

    expect(screen.getByTestId("auton-worker-summary").textContent).toContain("Trabajando");
    expect(screen.getByTestId("auton-worker-summary").textContent).toContain(
      "Revisa la restauración de sesión",
    );

    fireEvent.click(screen.getByText("Ver chat completo"));
    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe("worker-1");

    fireEvent.click(screen.getByText("Resumen"));
    expect(screen.getByTestId("auton-worker-summary")).toBeTruthy();

    fireEvent.click(screen.getByTestId("auton-worker-focus-back"));
    expect(useAutonWorkerFocusStore.getState().worker).toBeNull();
  });

  it("parar llama a la operación real de la sesión", () => {
    useAutonWorkerFocusStore.getState().open(
      {
        id: "worker-1",
        name: "Arreglar login",
        status: "trabajando",
        startedAt: NOW - 60_000,
        lastSignalAt: NOW - 2_000,
        lastLine: "Trabajando",
        transcript: [],
      },
      "/workspace/lunar",
    );
    render(<AutonWorkerFocusPane />);

    fireEvent.click(screen.getByTestId("auton-worker-focus-stop"));
    expect(stopGeneration).toHaveBeenCalledWith({
      taskId: "worker-1",
      workspacePath: "/workspace/lunar",
    });
  });
});
