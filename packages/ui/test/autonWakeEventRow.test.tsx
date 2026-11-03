// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WakeEventRow } from "../src/auton/WakeEventRow.js";

afterEach(cleanup);

describe("WakeEventRow", () => {
  it("dibuja la pregunta de un programador con su acción", () => {
    const onAction = vi.fn();
    render(
      <WakeEventRow
        kind="question"
        workerName="Programador"
        title="¿qué DoD uso?"
        detail="bloquea s2"
        actionLabel="Responder"
        onAction={onAction}
      />,
    );

    const row = screen.getByTestId("auton-wake-event");
    expect(row.dataset.kind).toBe("question");
    expect(screen.getByText("Programador")).toBeTruthy();
    expect(screen.getByText(/bloquea s2/)).toBeTruthy();

    fireEvent.click(screen.getByText("Responder"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("el cierre no muestra acción si no la hay y el latido se marca distinto", () => {
    render(<WakeEventRow kind="closed" title="terminó" detail="2 archivos" at="02:14" />);
    const closed = screen.getByTestId("auton-wake-event");
    expect(closed.dataset.kind).toBe("closed");
    expect(screen.queryByRole("button")).toBeNull();

    cleanup();
    render(<WakeEventRow kind="heartbeat" title="sigue trabajando" at="00:45" />);
    expect(screen.getByTestId("auton-wake-event").dataset.kind).toBe("heartbeat");
  });
});
