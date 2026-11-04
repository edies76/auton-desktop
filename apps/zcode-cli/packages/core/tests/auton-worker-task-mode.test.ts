import { describe, expect, it } from "vitest";
import {
  AgentInputJsonSchema,
  AgentInputSchema,
  AutonPlanItemSchema,
  AutonPlanSchema,
  formatAutonPlanForModel,
} from "@zcode/contracts";
import { buildAutonWorkerPromptForRequest } from "../src/auton/workerPolicy.js";
import {
  AUTON_WORKER_TASK_MODE_PROFILES,
  applyModeToToolNames,
  modeDisallowedTools,
  parseAutonWorkerTaskMode,
  resolveAutonWorkerTaskMode,
} from "../src/auton/workerTaskMode.js";
import { buildAutonSection } from "../src/auton/contextAuton.js";
import { createContextBuilder } from "../src/context/index.js";

const MODES = ["build", "read", "research", "debug", "refactor"] as const;
const EFFORTS = ["minimal", "standard", "thorough"] as const;

describe("eje de modo del worker", () => {
  it("entiende los cinco modos y cae en build cuando falta o no vale", () => {
    for (const mode of MODES) {
      expect(parseAutonWorkerTaskMode(mode)).toBe(mode);
      expect(resolveAutonWorkerTaskMode(mode)).toBe(mode);
    }
    expect(parseAutonWorkerTaskMode("READ")).toBe("read");
    expect(resolveAutonWorkerTaskMode(undefined)).toBe("build");
    expect(resolveAutonWorkerTaskMode("otro")).toBe("build");
  });

  it("el prompt se compone desde el modo y el esfuerzo, en las quince combinaciones", () => {
    for (const mode of MODES) {
      for (const effort of EFFORTS) {
        const prompt = buildAutonWorkerPromptForRequest({
          effort,
          mode,
          brief: "encargo",
          description: "prueba",
        });
        const profile = AUTON_WORKER_TASK_MODE_PROFILES[mode];

        expect(prompt).toContain(`MODO DE TRABAJO: ${mode}`);
        expect(prompt).toContain(`POLÍTICA DE ESFUERZO: ${effort}`);
        expect(prompt).toContain(`Criterio de hecho: ${profile.done}`);
        for (const prohibition of profile.prohibitions) {
          expect(prompt).toContain(prohibition);
        }
      }
    }
  });

  it("cada modo dice su criterio y su prohibición propia", () => {
    const read = buildAutonWorkerPromptForRequest({ mode: "read", brief: "x" });
    expect(read).toContain("No escribes ni modificas ningún archivo");
    expect(read).toContain("Un resumen con rutas de archivo");

    const research = buildAutonWorkerPromptForRequest({ mode: "research", brief: "x" });
    expect(research).toContain("recomendación con razones");
    expect(research).toContain("No devuelves una lista de enlaces");

    const debug = buildAutonWorkerPromptForRequest({ mode: "debug", brief: "x" });
    expect(debug).toContain("El comando que reproduce el fallo");
    expect(debug).toContain("No arreglas");

    const refactor = buildAutonWorkerPromptForRequest({ mode: "refactor", brief: "x" });
    expect(refactor).toContain("Los tests siguen en verde");
    expect(refactor).toContain("No mezclas features nuevas");
  });

  it("sin modo el prompt es el de build", () => {
    const prompt = buildAutonWorkerPromptForRequest({ effort: "minimal", brief: "x" });
    expect(prompt).toContain("MODO DE TRABAJO: build");
    expect(prompt).not.toContain("MODO DE TRABAJO: read");
  });
});

describe("la seguridad del modo vive en la política de herramientas", () => {
  const tools = ["Read", "Write", "Edit", "Bash", "WebFetch", "AutonPlan", "AutonRevert", "TodoWrite"];

  it("read y research pierden toda herramienta que pueda escribir", () => {
    for (const mode of ["read", "research"] as const) {
      const visible = applyModeToToolNames(tools, mode);
      expect(visible).toEqual(["Read", "WebFetch", "TodoWrite"]);
      for (const blocked of ["Write", "Edit", "Bash", "AutonPlan", "AutonRevert"]) {
        expect(visible).not.toContain(blocked);
      }
    }
  });

  it("debug puede ejecutar para reproducir, pero no editar", () => {
    const visible = applyModeToToolNames(tools, "debug");
    expect(visible).toContain("Bash");
    expect(visible).not.toContain("Write");
    expect(visible).not.toContain("Edit");
    expect(visible).not.toContain("AutonRevert");
  });

  it("build y refactor conservan el juego completo", () => {
    expect(applyModeToToolNames(tools, "build")).toEqual(tools);
    expect(applyModeToToolNames(tools, "refactor")).toEqual(tools);
    expect(modeDisallowedTools("build")).toHaveLength(0);
    expect(modeDisallowedTools("refactor")).toHaveLength(0);
  });
});

describe("el registro y el contrato declaran el modo", () => {
  it("la herramienta Agent acepta los cinco modos y un valor raro cae en build", () => {
    for (const mode of MODES) {
      const parsed = AgentInputSchema.parse({
        description: "x",
        prompt: "y",
        subagent_type: "auton-worker",
        mode,
      });
      expect(parsed.mode).toBe(mode);
    }
    const invalid = AgentInputSchema.parse({
      description: "x",
      prompt: "y",
      subagent_type: "auton-worker",
      mode: "inventado",
    });
    expect(invalid.mode).toBe("build");

    // El registro conserva los cinco valores para el modelo.
    const schema = JSON.stringify(AgentInputJsonSchema);
    for (const mode of MODES) {
      expect(schema).toContain(mode);
    }
  });

  it("el item del plan guarda el modo, cae en build si no vale y el plan lo imprime", () => {
    const item = AutonPlanItemSchema.parse({
      id: "s1",
      title: "Leer el proyecto",
      status: "ready",
      mode: "read",
    });
    expect(item.mode).toBe("read");

    const invalid = AutonPlanItemSchema.parse({
      id: "s2",
      title: "Raro",
      status: "ready",
      mode: "inventado",
    });
    expect(invalid.mode).toBe("build");

    const plan = AutonPlanSchema.parse({
      items: [{ id: "s1", title: "Leer", status: "ready", mode: "read" }],
    });
    expect(formatAutonPlanForModel(plan)).toContain("mode read");
  });

  it("la doctrina ensamblada dice cuándo usar cada modo", () => {
    // El prompt real del orquestador, no el archivo de la sección.
    const assembled = createContextBuilder({
      workingDirectory: "/workspace",
      envInfo: {
        cwd: "/workspace",
        platform: "darwin",
        shell: "zsh",
        osVersion: "Darwin 25.4.0",
        nodeVersion: "v24.14.0",
      },
      guidanceToolNames: ["Read", "Edit", "Bash", "Agent", "TodoWrite", "AskUserQuestion"],
    })
      .build()
      .systemMessages.map((message) => String(message.content ?? ""))
      .join("\n");

    expect(assembled).toContain("## Modos de trabajo de los workers");
    expect(assembled).toContain("`read`: cuando necesitas contexto");
    expect(assembled).toContain("`research`: cuando hay que decidir entre alternativas");
    expect(assembled).toContain("`debug`: cuando hay un fallo");
    expect(assembled).toContain("`refactor`: cuando hay que cambiar la forma");
    expect(assembled).toContain("`worker_mode` es otra cosa");
    expect(assembled).toContain("## Motor del worker");
    expect(assembled).toContain("Muse Code");
    expect(assembled).toContain("`engine`");
    expect(assembled).toContain("Usa `muse`");
    expect(assembled).toContain("sesión viva");
    expect(assembled).toContain("steer");
    // La sección sigue existiendo por separado; el ensamblado la incluye.
    expect(buildAutonSection().content).toContain("## Modos de trabajo de los workers");
  });
});
