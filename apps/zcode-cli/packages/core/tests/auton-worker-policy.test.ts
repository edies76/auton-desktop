import { describe, expect, it } from "vitest";
import {
  AUTON_WORKER_AGENT_TYPE,
  buildAutonWorkerSystemPrompt,
  buildWorkerPolicySection,
  parseEffortPolicy,
  type WorkerEffortPolicy,
} from "../src/auton/workerPolicy.js";
import { normalizeAgentProfiles } from "../src/subagent/profile.js";

describe("auton worker effort policy", () => {
  it.each([
    ["POLÍTICA DE ESFUERZO: minimal\nHaz X", "minimal"],
    ["política de esfuerzo: STANDARD", "standard"],
    ["  Política De Esfuerzo: thorough  ", "thorough"],
    ["sin politica", "standard"],
    ["POLÍTICA DE ESFUERZO: ultra", "standard"],
  ] as const)("parsea '%s' como %s", (brief, expected: WorkerEffortPolicy) => {
    expect(parseEffortPolicy(brief)).toBe(expected);
  });

  it.each(["minimal", "standard", "thorough"] as const)(
    "la seccion %s prohibe o permite con criterio",
    (policy) => {
      const section = buildWorkerPolicySection(policy);
      expect(section).toContain("POLÍTICA DE ESFUERZO");
      if (policy === "minimal") {
        expect(section).toMatch(/prohibido|no toques|no añadas/i);
      }
      if (policy === "thorough") {
        expect(section).toMatch(/casos borde|pruebas/i);
      }
    },
  );
});

describe("auton worker system prompt", () => {
  it("mantiene inteligencia: autonomia con tarea definida, sin lobotomia", () => {
    const prompt = buildAutonWorkerSystemPrompt("standard");
    expect(prompt).toMatch(/orquestador/i);
    expect(prompt).toMatch(/REPORTE/);
    expect(prompt).toContain("AutonReport");
    expect(prompt).toMatch(/DONE_WITH_CONCERNS|NEEDS_CONTEXT|BLOCKED/);
    expect(prompt).toMatch(/reintent|retry|no pares|hasta terminar/i);
  });

  it("el tipo de agente es estable y distinto de general-purpose", () => {
    expect(AUTON_WORKER_AGENT_TYPE).toBe("auton-worker");
    expect(AUTON_WORKER_AGENT_TYPE).not.toBe("general-purpose");
  });
});

describe("thinking viaja distinto del esfuerzo y llega a la identidad del worker", () => {
  it("thinking_level aparece en la identidad, effort sigue mandando en el alcance", () => {
    const prompt = buildAutonWorkerSystemPrompt("thorough", {
      description: "revisar el checkout",
      reasoningLevel: "max",
    });
    expect(prompt).toContain("Tu nivel de thinking para este encargo: max");
    expect(prompt).toContain("POLÍTICA DE ESFUERZO: thorough");
    expect(prompt).toContain("revisar el checkout");
    expect(prompt).not.toContain("nivel de esfuerzo");
  });

  it("sin thinking_level, la identidad no inventa nivel", () => {
    const prompt = buildAutonWorkerSystemPrompt("minimal");
    expect(prompt).not.toContain("nivel de thinking");
    expect(prompt).toContain("POLÍTICA DE ESFUERZO: minimal");
  });
});

describe("auton-worker registrado como built-in", () => {
  it("aparece en los perfiles built-in, independiente de general-purpose", () => {
    const names = normalizeAgentProfiles([]).map((profile) => profile.name);
    expect(names).toContain(AUTON_WORKER_AGENT_TYPE);
    expect(names).toContain("general-purpose");
  });

  it("su prompt trae identidad worker, REPORTE y politica standard", () => {
    const worker = normalizeAgentProfiles([]).find(
      (profile) => profile.name === AUTON_WORKER_AGENT_TYPE,
    )!;
    expect(worker.systemPrompt).toContain("ORQUESTADOR");
    expect(worker.systemPrompt).toContain("REPORTE");
    expect(worker.systemPrompt).toContain("POLÍTICA DE ESFUERZO: standard");
  });
});
