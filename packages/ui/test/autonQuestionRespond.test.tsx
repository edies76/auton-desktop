// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TID_V4_COMPOSER_INPUT } from "@zcode/shared/test-ids";
import { QuestionWakeBlock, isWaitingQuestionToolCall } from "../src/auton/question-wake.js";
import { createQuestionRespondHandler } from "../src/auton/respond.js";

const node = {
  toolCall: {
    toolId: "tool-ask",
    kind: "chat",
    title: "SendMessage",
    toolName: "SendMessage",
    status: "completed",
    input: {
      message: "¿uso la paleta nueva?",
      summary: "decisión",
      waitingForAnswer: true,
    },
  },
  childToolCalls: [],
} as never;

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
  it("el callback real lleva el foco al compositor del hilo", () => {
    expect(isWaitingQuestionToolCall((node as { toolCall: never }).toolCall)).toBe(true);

    render(
      createElement(QuestionWakeBlock, {
        toolCallNode: node,
        onRespondToQuestion: createQuestionRespondHandler(document),
      } as never),
    );

    fireEvent.click(screen.getByText("Responder"));
    expect(document.activeElement).toBe(composer);
  });

  it("sin callback no hay botón de responder", () => {
    render(createElement(QuestionWakeBlock, { toolCallNode: node } as never));
    expect(screen.queryByText("Responder")).toBeNull();
  });
});
