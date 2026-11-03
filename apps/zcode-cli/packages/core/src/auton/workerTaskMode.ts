// ============================================================
// Modos de trabajo del worker — qué hace, separado de cuánto trabaja
// ============================================================
// El esfuerzo (minimal/standard/thorough) dice cuánto. El modo dice qué clase
// de trabajo: construir, leer, investigar, depurar o refactorizar. La decisión
// vive aquí, en puro, para que el prompt y la política de herramientas salgan
// de la misma tabla y se puedan probar sin runtime.

import {
  DEFAULT_AUTON_WORKER_TASK_MODE,
  type AutonWorkerTaskMode,
} from "@zcode/contracts";

export const AUTON_WORKER_TASK_MODES = [
  "build",
  "read",
  "research",
  "debug",
  "refactor",
] as const;

/** Herramientas que pueden modificar el espacio de trabajo. */
export const WORKSPACE_WRITE_TOOLS = [
  "Write",
  "Edit",
  "ApplyPatch",
  "NotebookEdit",
  "Bash",
  "AutonRevert",
  "AutonPlan",
  "CreateWorkflow",
  "SaveWorkflow",
  "AmendWorkflow",
  "FillWorkflowHole",
  "EvalWorkflowSnippet",
] as const;

/** En read/research también se retira la shell: puede escribir. */
const READ_ONLY_DISALLOWED = WORKSPACE_WRITE_TOOLS;
/** Debug puede ejecutar para reproducir, pero no arreglar ni tocar el plan. */
const DEBUG_DISALLOWED = [
  "Write",
  "Edit",
  "ApplyPatch",
  "NotebookEdit",
  "AutonRevert",
  "AutonPlan",
  "CreateWorkflow",
  "SaveWorkflow",
  "AmendWorkflow",
  "FillWorkflowHole",
] as const;

export interface AutonWorkerTaskModeProfile {
  mode: AutonWorkerTaskMode;
  /** Una línea: qué clase de trabajo es. */
  purpose: string;
  /** Criterio de hecho: qué tiene que entregar para cerrar. */
  done: string;
  /** Lo que no hace, en imperativo. */
  prohibitions: readonly string[];
  /** Herramientas que el runtime le retira; vacío = juego completo. */
  disallowedTools: readonly string[];
  /** Atajo para la doctrina y la UI. */
  writesWorkspace: boolean;
}

export const AUTON_WORKER_TASK_MODE_PROFILES: Record<
  AutonWorkerTaskMode,
  AutonWorkerTaskModeProfile
> = {
  build: {
    mode: "build",
    purpose: "Escribes el código del encargo.",
    done: "El criterio del sprint, con su prueba y la evidencia del comando.",
    prohibitions: ["No te sales del scope.", "No refactorizas lo que el encargo no pide."],
    disallowedTools: [],
    writesWorkspace: true,
  },
  read: {
    mode: "read",
    purpose: "Lees y resumes: qué hay, dónde está y cómo está montado.",
    done: "Un resumen con rutas de archivo y nada más.",
    prohibitions: [
      "No escribes ni modificas ningún archivo.",
      "No ejecutas comandos que puedan escribir.",
      "No propones cambios de código: entregas contexto para que el orquestador decida.",
    ],
    disallowedTools: READ_ONLY_DISALLOWED,
    writesWorkspace: false,
  },
  research: {
    mode: "research",
    purpose: "Investigas fuera: web, documentación de terceros y alternativas.",
    done: "Una recomendación con razones y fuentes, nunca una lista de enlaces.",
    prohibitions: [
      "No tocas código.",
      "No devuelves una lista de enlaces: terminas en una recomendación con razones.",
      "Marcas lo que viene de fuera para que no se confunda con lo del proyecto.",
    ],
    disallowedTools: READ_ONLY_DISALLOWED,
    writesWorkspace: false,
  },
  debug: {
    mode: "debug",
    purpose: "Reproduces el fallo y encuentras la causa raíz.",
    done: "El comando que reproduce el fallo y la causa señalada.",
    prohibitions: [
      "No arreglas: el arreglo va en un encargo build.",
      "No cambias el comportamiento para esconder el fallo.",
    ],
    disallowedTools: DEBUG_DISALLOWED,
    writesWorkspace: false,
  },
  refactor: {
    mode: "refactor",
    purpose: "Cambias la forma sin cambiar el comportamiento.",
    done: "Los tests siguen en verde y lo observable no cambia.",
    prohibitions: [
      "No mezclas features nuevas en el mismo encargo.",
      "No cambias contratos ni comportamiento observable.",
    ],
    disallowedTools: [],
    writesWorkspace: true,
  },
};

export function parseAutonWorkerTaskMode(value: unknown): AutonWorkerTaskMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return (AUTON_WORKER_TASK_MODES as readonly string[]).includes(normalized)
    ? (normalized as AutonWorkerTaskMode)
    : undefined;
}

/** Ausente o inválido cae en build: el worker nunca se queda sin modo. */
export function resolveAutonWorkerTaskMode(value: unknown): AutonWorkerTaskMode {
  return parseAutonWorkerTaskMode(value) ?? DEFAULT_AUTON_WORKER_TASK_MODE;
}

export function workerTaskModeProfile(mode: unknown): AutonWorkerTaskModeProfile {
  return AUTON_WORKER_TASK_MODE_PROFILES[resolveAutonWorkerTaskMode(mode)];
}

/** Herramientas que el modo retira del juego del worker. */
export function modeDisallowedTools(mode: unknown): readonly string[] {
  return workerTaskModeProfile(mode).disallowedTools;
}

/** Filtra una lista concreta de herramientas (camino subagente). */
export function applyModeToToolNames(
  toolNames: readonly string[],
  mode: unknown,
): readonly string[] {
  const blocked = new Set(modeDisallowedTools(mode));
  return blocked.size === 0 ? toolNames : toolNames.filter((name) => !blocked.has(name));
}

/** Bloque de prompt del modo, con su criterio de hecho y sus prohibiciones. */
export function buildAutonWorkerTaskModeSection(mode: unknown): string {
  const profile = workerTaskModeProfile(mode);
  return [
    `MODO DE TRABAJO: ${profile.mode}`,
    profile.purpose,
    `Criterio de hecho: ${profile.done}`,
    "Prohibiciones:",
    ...profile.prohibitions.map((line) => `- ${line}`),
    "",
    "El modo no cambia cuánto trabajas (eso lo fija el esfuerzo); cambia qué clase de trabajo haces.",
  ].join("\n");
}
