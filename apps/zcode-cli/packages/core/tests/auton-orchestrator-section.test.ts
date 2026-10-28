import { describe, expect, it } from "vitest";
import { createContextBuilder } from "../src/context/index.js";
import { buildOrchestratorSection } from "../src/context/sections/orchestrator.js";
import { createTestRuntimeModel } from "./test-runtime-model.js";

const contextTestModel = createTestRuntimeModel({
  providerId: "openai",
  modelId: "gpt-5",
  generateText: async () => {
    throw new Error("context rendering must not execute the model");
  },
});

function buildSystem(): string[] {
  const result = createContextBuilder({
    workingDirectory: "/workspace",
    envInfo: {
      cwd: "/workspace",
      platform: "darwin",
      shell: "zsh",
      osVersion: "Darwin 25.4.0",
      nodeVersion: "v24.14.0",
    },
    guidanceToolNames: ["Read", "Edit", "Bash", "Agent", "TodoWrite", "AskUserQuestion"],
  }).build();
  return result.systemMessages.map((message) => String(message.content ?? ""));
}

describe("auton orchestrator section", () => {
  it("existe y trae procedimiento operativo, no solo doctrina", () => {
    const section = buildOrchestratorSection();
    expect(section.content).toContain("set_goal");
    expect(section.content).toContain("decompose_goal");
    expect(section.content).toContain("dispatch_ready");
    expect(section.content).toMatch(/DONE_WITH_CONCERNS|NEEDS_CONTEXT|BLOCKED/);
    expect(section.content).toMatch(/narr|1-2 líneas|silencio/i);
    expect(section.content).toMatch(/agrupa|velocidad|tokens/i);
  });

  it("se inyecta despues de la doctrina auton en el system prompt", () => {
    const bodies = buildSystem();
    const doctrineIndex = bodies.findIndex((body) =>
      body.includes("En Auton, esa disciplina es el producto"),
    );
    const orchestratorIndex = bodies.findIndex((body) =>
      body.includes("Cómo dirigir el trabajo"),
    );
    expect(doctrineIndex).toBeGreaterThanOrEqual(0);
    expect(orchestratorIndex).toBeGreaterThanOrEqual(0);
    expect(orchestratorIndex).toBeGreaterThanOrEqual(doctrineIndex);
  });
});
