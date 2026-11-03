// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TID_V4_COMPOSER_INPUT } from "@zcode/shared/test-ids";
import type { SubagentRow } from "@zcode/shared/zcode-protocol-v4";
import { deriveWakeEvents } from "../src/auton/subagentChannel.js";
import { WakeEventItem } from "../src/auton/WakeEventItem.js";
import { createQuestionRespondHandler } from "../src/auton/respond.js";

const START = "2026-11-02T20:00:00.000Z";
const NOW = Date.parse("2026-11-02T20:00:05.000Z");

const waitingRow = {
  kind: "subagent",
  rowId: 11,
  turnId: "turn_1",
  parentToolCallId: "tool-ask",
  childSessionId: "child_11",
  subagentType: "auton-worker",
  status: "running",
  summaryText: "¿uso la paleta nueva?",
  startedAt: START,
  lastActivityAt: START,
  waitingForAnswer: true,
} as unknown as SubagentRow;

let composer: HTMLInputElement;

beforeEach(() => {
  composer = document.createElement("input");
  composer.setAttribute("data-testid", TID_V4_COMPOSER_INPUT);
  document.body.appendChild(composer);
});

afterEach(() => {
  cleanup();
  composer.remove();
});

describe("responder a la pregunta desde la fila del hilo", () => {
  it("el evento derivado de la fila real abre el compositor con el callback real", () => {
    const [event] = deriveWakeEvents(waitingRow, NOW, "Landing de Auton");
    expect(event?.kind).toBe("question");

    render(
      createElement(WakeEventItem, {
        event: event!,
        onAction: createQuestionRespondHandler(document),
      }),
    );

    fireEvent.click(screen.getByText("Responder"));
    expect(document.activeElement).toBe(composer);
  });

  it("sin callback no hay botón de responder", () => {
    const [event] = deriveWakeEvents(waitingRow, NOW, "Landing de Auton");
    render(createElement(WakeEventItem, { event: event! }));
    expect(screen.queryByText("Responder")).toBeNull();
    expect(screen.getByText("necesita una decisión")).toBeDefined();
  });
});
