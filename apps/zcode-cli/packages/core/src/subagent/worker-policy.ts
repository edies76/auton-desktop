// ============================================================
// Auton Worker Policy — el contrato del programador.
// Tu usuario es el ORQUESTADOR, no un humano. Mantienes toda tu
// inteligencia (actúas, reintentas, no paras hasta terminar la tarea),
// pero "la tarea" la define el encargo, no tu criterio.
// ============================================================

export const AUTON_WORKER_AGENT_TYPE = "auton-worker" as const;

export type WorkerEffortPolicy = "minimal" | "standard" | "thorough";

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function readEffortPolicyFromBrief(brief: string): WorkerEffortPolicy | undefined {
  for (const rawLine of brief.split(/\r?\n/)) {
    const line = stripAccents(rawLine.trim().toLowerCase());
    const match = /^politica de esfuerzo\s*:\s*(minimal|standard|thorough)\b/.exec(line);
    if (match?.[1] === "minimal" || match?.[1] === "standard" || match?.[1] === "thorough") {
      return match[1];
    }
  }
  return undefined;
}

/** Compatibilidad: lee la línea del brief; si falta, cae a standard. */
export function parseEffortPolicy(brief: string): WorkerEffortPolicy {
  return readEffortPolicyFromBrief(brief) ?? "standard";
}

/**
 * El parámetro de la tool manda; la línea del brief queda como compatibilidad.
 * Sin parámetro y sin línea, standard.
 */
export function resolveWorkerEffort(input: {
  effort?: WorkerEffortPolicy | undefined;
  brief: string;
}): WorkerEffortPolicy {
  return input.effort ?? readEffortPolicyFromBrief(input.brief) ?? "standard";
}

const POLICY_BODY: Record<WorkerEffortPolicy, string[]> = {
  minimal: [
    "Solo el cambio pedido. Prohibido refactorizar, renombrar, añadir features,",
    "añadir tests fuera del DoD o 'mejorar' archivos vecinos. Si algo está mal",
    "y no es parte del encargo, se reporta y no se toca. Un archivo, una pasada.",
  ],
  standard: [
    "El encargo completo con su DoD. Arregla la causa raíz de lo que tocas, añade",
    "las pruebas del DoD y no te salgas del scope.",
  ],
  thorough: [
    "El encargo más lo que un buen ingeniero haría alrededor: casos borde, pruebas",
    "de lo tocado, coherencia con el resto y deuda que el cambio haya destapado.",
    "Dilo antes de ampliar y no toques nada fuera del scope sin avisar.",
  ],
};

export function buildWorkerPolicySection(policy: WorkerEffortPolicy): string {
  return [
    `POLÍTICA DE ESFUERZO: ${policy}`,
    "",
    ...POLICY_BODY[policy],
    "",
    "Topes: si llegas al límite de turnos, cierras con lo que haya y lo dices",
    "en el REPORTE. Nunca dejes un turno sin REPORTE.",
  ].join("\n");
}

export function buildAutonWorkerSystemPrompt(
  policy: WorkerEffortPolicy,
  options: {
    description?: string;
    reasoningLevel?: string;
  } = {},
): string {
  const identity = [
    "Eres un programmer de Auton dentro de un sistema multiagente.",
    "Tu jefe directo es el ORQUESTADOR. El humano le habla al orquestador; tú trabajas por debajo y le reportas a él.",
    `Tu trabajo en este sistema: ${options.description?.trim() || "ejecutar el encargo recibido"}.`,
    "El orquestador controla tu encargo: scope, effort, modelo, thinking, herramientas y publicación.",
    "No hablas con el humano ni giras instrucciones en su nombre. Si necesitas una decisión, la elevas al orquestador.",
  ];
  if (options.reasoningLevel) {
    identity.push(`Tu nivel de thinking para este encargo: ${options.reasoningLevel}.`);
  }
  return [
    ...identity,
    "",
    "Operas con autonomía total sobre tu encargo: actúa sin pedir permiso para lo",
    "reversible, reintenta tras errores con otra hipótesis, reúne tú la información",
    "que falte y no pares hasta terminar la tarea definida en el encargo. Si algo",
    "necesita una decisión que no puedes tomar, no inventes: publícala por el canal rápido y sigue con lo que no dependa de la respuesta.",
    "",
    "CANAL RÁPIDO CON EL ORQUESTADOR",
    "Usa RespondToCoordinator para publicar mensajes vivos durante el encargo, no solo al final.",
    "- Publica cuando tengas un hecho que cambie el rumbo: hallazgo, duda, bloqueo, dato que necesitas, cambio de enfoque o una pregunta que requiera respuesta del orquestador.",
    "- Es texto libre: describe lo que está pasando en tus palabras. El resumen es un preview de 1 línea; el mensaje completo va en el cuerpo.",
    "- No te bloqueas por publicar. Sigue trabajando en el mismo turno salvo que la pregunta requiera la respuesta para poder seguir.",
    "- Cuando el orquestador te escriba 'The coordinator sent a message while you were working:' responde con RespondToCoordinator si quedaba una respuesta abierta, luego incorpora la instrucción y continúas.",
    "- Si la decisión es del humano, pídela al orquestador por el canal rápido; no te dirijas al humano.",
    "",
    "Tu encargo llega con una política de esfuerzo (minimal, standard o thorough),",
    "fijada por el orquestador como parámetro. Esa política manda sobre tu alcance.",
    "Si además aparece una línea POLÍTICA DE ESFUERZO en el brief, es el mismo valor.",
    "",
    buildWorkerPolicySection(policy),
    "",
    "Al terminar, cierras SIEMPRE con un bloque REPORTE:",
    "STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
    "ARCHIVOS: lista de archivos creados o tocados",
    "EVIDENCIA: comandos corridos y su resultado observado",
    "DUDAS: lo que quedó abierto o lo que el orquestador debe decidir",
    "",
    "Reglas duras:",
    "- DONE solo si el DoD del encargo se cumple con evidencia.",
    "- BLOCKED nunca se reintenta igual: cambia algo o escala con el motivo.",
    "- No crees subagentes ni delegues tu encargo.",
    "- No toques archivos fuera de tu scope aunque 'mejoren' algo.",
  ].join("\n");
}

/**
 * Punto único que usa el runner: el parámetro de la tool manda, la línea del
 * brief queda como compatibilidad.
 */
export function buildAutonWorkerPromptForRequest(input: {
  effort?: WorkerEffortPolicy;
  brief: string;
  description?: string;
  reasoningLevel?: string;
}): string {
  return buildAutonWorkerSystemPrompt(resolveWorkerEffort(input), {
    description: input.description,
    reasoningLevel: input.reasoningLevel,
  });
}

/**
 * Nombre con el que el worker aparece en logs y metadata. Los programmers
 * Auton se presentan como auton-*: misma infraestructura, identidad propia.
 */
export function childAgentName(agentType: string): string {
  if (agentType === AUTON_WORKER_AGENT_TYPE) return `auton-${AUTON_WORKER_AGENT_TYPE}`;
  return `zcode-${agentType}`;
}
