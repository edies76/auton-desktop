// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WakeEventRow } from "../src/auton/WakeEventRow.js";

afterEach(cleanup);

describe("WakeEventRow", () => {
  it("dibuja el aviso del worker como una fila de trabajo, sin acción del humano", () => {
    render(
      <WakeEventRow
        kind="question"
        workerName="Worker"
        title="pregunta al orquestador"
        detail="¿qué DoD uso?"
      />,
    );

    const row = screen.getByTestId("auton-wake-event");
    expect(row.dataset.kind).toBe("question");
    expect(screen.getByText("Worker")).toBeTruthy();
    expect(screen.getByText(/¿qué DoD uso\?/)).toBeTruthy();
    // El worker no pregunta al humano: no hay botón de responder aquí.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("el cierre conserva su acción y el latido no la tiene", () => {
    const onOpen = vi.fn();
    render(
      <WakeEventRow
        kind="closed"
        title="terminó"
        detail="2 archivos"
        at="02:14"
        actionLabel="Abrir"
        onAction={onOpen}
      />,
    );
    const closed = screen.getByTestId("auton-wake-event");
    expect(closed.dataset.kind).toBe("closed");
    fireEvent.click(screen.getByText("Abrir"));
    expect(onOpen).toHaveBeenCalledTimes(1);

    cleanup();
    render(<WakeEventRow kind="heartbeat" title="sigue trabajando" at="00:45" />);
    expect(screen.getByTestId("auton-wake-event").dataset.kind).toBe("heartbeat");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
