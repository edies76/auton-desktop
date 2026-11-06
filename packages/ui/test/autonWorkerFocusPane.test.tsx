// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutonWorkerView } from "../src/auton/project-space/model.js";
import { AutonWorkerFocusPane } from "../src/auton/project-space/WorkerFocusPane.js";

const WORKER: AutonWorkerView = {
  id: "sess_auton_agent_1",
  name: "Revisión README",
  status: "trabajando",
  startedAt: 1_000,
  lastSignalAt: 2_000,
  lastLine: "Revisa la restauración de sesión",
  transcript: [],
  kind: "agent",
};

const SUBAGENT: AutonWorkerView = {
  ...WORKER,
  id: "sess_subagent_agent_2",
  name: "Explorar login",
  kind: "subagent",
};

const MUSE: AutonWorkerView = {
  ...WORKER,
  id: "sess_muse_agent_3",
  name: "Worker Muse",
  kind: "muse",
  engine: "muse",
  lastLine: "Preparando el motor Muse",
};

vi.mock("@/v4/V4ChatPane.js", () => ({
  V4ChatPane: ({ sessionId, readOnly }: { sessionId: string; readOnly?: boolean }) => (
    <div
      data-testid="v4-chat-pane"
      data-session-id={sessionId}
      data-readonly={readOnly ? "true" : "false"}
    />
  ),
}));

afterEach(cleanup);

describe("chat completo del worker", () => {
  it("un agente completo conserva el chat normal, sin resumen ni cabecera", () => {
    render(
      <AutonWorkerFocusPane
        worker={WORKER}
        workspacePath="/workspace/lunar"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe(WORKER.id);
    expect(screen.getByTestId("v4-chat-pane").dataset.readonly).toBe("false");
    expect(screen.queryByTestId("auton-worker-summary")).toBeNull();
    expect(screen.queryByTestId("auton-worker-focus-stop")).toBeNull();
  });

  it("un subagente se observa en solo lectura", () => {
    render(
      <AutonWorkerFocusPane
        worker={SUBAGENT}
        workspacePath="/workspace/lunar"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId("v4-chat-pane").dataset.sessionId).toBe(SUBAGENT.id);
    expect(screen.getByTestId("v4-chat-pane").dataset.readonly).toBe("true");
  });

  it("un worker Muse tiene una vista mínima sin chat ZCode", () => {
    render(
      <AutonWorkerFocusPane
        worker={MUSE}
        workspacePath="/workspace/lunar"
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("v4-chat-pane")).toBeNull();
    expect(screen.getByText("Muse Code")).toBeTruthy();
    expect(screen.getByText("Worker Muse")).toBeTruthy();
    expect(screen.getByText("Preparando el motor Muse")).toBeTruthy();
    expect(screen.getByTestId("auton-worker-focus-back")).toBeTruthy();
  });

  it("la vuelta es un botón flotante sobre el chat", () => {
    const onBack = vi.fn();
    render(
      <AutonWorkerFocusPane
        worker={WORKER}
        workspacePath="/workspace/lunar"
        onBack={onBack}
      />,
    );

    const back = screen.getByTestId("auton-worker-focus-back");
    expect(back.textContent).toContain("Volver");
    expect(back.className).toContain("absolute");
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("sin orquestador no muestra botón de vuelta", () => {
    render(
      <AutonWorkerFocusPane
        worker={WORKER}
        workspacePath="/workspace/lunar"
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    expect(screen.queryByTestId("auton-worker-focus-back")).toBeNull();
  });
});
