import type { TraceContext, TurnSteerInput, TurnSteerResult } from "@zcode/contracts";
import type { RuntimeTaskMessageSink } from "../runtime-task/registry.js";
import { ANSWER_REQUIRED_HEADER } from "../auton/answerLock.js";

interface SteerableRuntime {
  steerTurn(input: string | TurnSteerInput): Promise<TurnSteerResult>;
}

export function createSubagentMessageSink(
  runtime: SteerableRuntime,
  request: { traceContext: TraceContext },
): RuntimeTaskMessageSink {
  return {
    async send(message) {
      const result = await steerSubagentMessage(runtime, request, message);
      if (result.kind === "rejected") {
        throw new Error(`Subagent message rejected: ${result.reason}`);
      }
      return "steered";
    },
  };
}

async function steerSubagentMessage(
  runtime: SteerableRuntime,
  request: { traceContext: TraceContext },
  message: {
    id: string;
    message: string;
    summary?: string;
    requiresAnswer?: boolean;
    traceContext?: TraceContext;
  },
): Promise<TurnSteerResult> {
  const input = formatSubagentCoordinatorMessage(message);
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await runtime.steerTurn({
      delivery: "guide",
      inputPresentation: "coordinator_steer",
      input,
      inputId: message.id,
      traceContext: message.traceContext ?? request.traceContext,
    });
    if (result.kind !== "rejected" || result.reason !== "no_active_turn") {
      return result;
    }
    await sleep(10);
  }
  return runtime.steerTurn({
    delivery: "guide",
    inputPresentation: "coordinator_steer",
    input,
    inputId: message.id,
    traceContext: message.traceContext ?? request.traceContext,
  });
}

export function formatSubagentCoordinatorMessage(message: {
  message: string;
  summary?: string;
  requiresAnswer?: boolean;
}): string {
  const summary = message.summary?.trim();
  const body = summary ? [summary, "", message.message].join("\n") : message.message;
  if (!message.requiresAnswer) return body;
  return [ANSWER_REQUIRED_HEADER, "", body].join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
