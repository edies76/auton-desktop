// ============================================================
// Auton limits — evaluación pura del contrato de autonomía
// ============================================================
// Los límites no son texto para el modelo: son predicados que se evalúan antes
// de despachar. Este módulo no escribe nada; devuelve un veredicto que el
// llamador convierte en acción (seguir, pedir aprobación, bloquear o escalar).
//
// "NO EVALUABLE" es un veredicto de primera clase: cuando falta el dato para
// juzgar, el sistema escala en vez de seguir a ciegas.

import type {
  AutonApprovalRule,
  AutonLimitChange,
  AutonLimits,
  AutonPlanItem,
} from "./plan.js";

export const AUTON_LIMIT_EVALUATION_KINDS = [
  "within",
  "requires_approval",
  "exceeds",
  "not_evaluable",
] as const;

export type AutonLimitEvaluation =
  | { kind: "within"; limitsVersion: number }
  | { kind: "requires_approval"; rule: AutonApprovalRule; limitsVersion: number }
  | { kind: "exceeds"; rule: string; message: string; limitsVersion: number }
  | { kind: "not_evaluable"; reason: string };

const within = (limits: AutonLimits): AutonLimitEvaluation => ({
  kind: "within",
  limitsVersion: limits.version,
});

/**
 * ¿Puede este item volver a despacharse?
 * `attempts` es el número de despachos ya consumidos, sin contar el que se evalúa.
 */
export function evaluateAttempt(input: {
  limits: AutonLimits | undefined;
  attempts: number;
}): AutonLimitEvaluation {
  const { limits, attempts } = input;
  if (!limits) {
    return { kind: "not_evaluable", reason: "el plan no tiene límites versionados" };
  }
  if (!Number.isInteger(attempts) || attempts < 0) {
    return { kind: "not_evaluable", reason: "el número de intentos no se puede leer" };
  }
  if (attempts >= limits.maxAttempts) {
    return {
      kind: "exceeds",
      rule: "maxAttempts",
      message: `límite de intentos alcanzado (${limits.maxAttempts}); el item queda bloqueado y escala al humano`,
      limitsVersion: limits.version,
    };
  }
  return within(limits);
}

/** ¿Esta acción exige aprobación humana? */
export function evaluateApproval(input: {
  limits: AutonLimits | undefined;
  rules: readonly AutonApprovalRule[] | undefined;
}): AutonLimitEvaluation {
  const { limits, rules } = input;
  if (!rules || rules.length === 0) {
    return limits
      ? within(limits)
      : { kind: "not_evaluable", reason: "el plan no tiene límites versionados" };
  }
  if (!limits) {
    return { kind: "not_evaluable", reason: "el plan no tiene límites versionados" };
  }
  for (const rule of rules) {
    if (limits.approval[rule]) {
      return { kind: "requires_approval", rule, limitsVersion: limits.version };
    }
  }
  return within(limits);
}

/**
 * Evalúa un despacho completo: primero la aprobación, después los intentos.
 * La aprobación va primero porque un item que necesita al humano no debe
 * consumir un intento.
 */
export function evaluateDispatch(input: {
  limits: AutonLimits | undefined;
  item: Pick<AutonPlanItem, "attempts" | "needsApproval">;
}): AutonLimitEvaluation {
  const approval = evaluateApproval({ limits: input.limits, rules: input.item.needsApproval });
  if (approval.kind !== "within") return approval;
  return evaluateAttempt({ limits: input.limits, attempts: input.item.attempts });
}

/** Texto para el modelo y para el humano: el veredicto no se disfraza. */
export function describeEvaluation(evaluation: AutonLimitEvaluation): string {
  switch (evaluation.kind) {
    case "within":
      return `dentro de los límites v${evaluation.limitsVersion}`;
    case "requires_approval":
      return `requiere aprobación humana (${evaluation.rule}); deja el item en waiting con la pregunta`;
    case "exceeds":
      return evaluation.message;
    case "not_evaluable":
      return `no evaluable: ${evaluation.reason}; escala al humano en vez de seguir`;
  }
}

/** Campos de límites que cambiaron, incluido el nivel anidado de aprobaciones. */
export function changedLimitFields(
  previous: AutonLimits | undefined,
  next: AutonLimits | undefined,
): string[] {
  if (!previous && !next) return [];
  if (!previous || !next) return ["limits"];
  const changed: string[] = [];
  if (previous.maxAttempts !== next.maxAttempts) changed.push("maxAttempts");
  if (previous.unknownHandling !== next.unknownHandling) changed.push("unknownHandling");
  for (const rule of Object.keys(next.approval) as AutonApprovalRule[]) {
    if (previous.approval[rule] !== next.approval[rule]) changed.push(`approval.${rule}`);
  }
  return changed;
}

/**
 * Un cambio de límites sin registro no existe. Devuelve el motivo del rechazo,
 * o null si el cambio está escrito y versionado como manda el contrato.
 */
export function validateLimitChange(input: {
  previous: AutonLimits | undefined;
  next: AutonLimits | undefined;
  previousHistory: readonly AutonLimitChange[];
  nextHistory: readonly AutonLimitChange[];
}): string | null {
  const changed = changedLimitFields(input.previous, input.next);

  // Reescribir el historial ya escrito es peor que no tener historial.
  if (input.nextHistory.length < input.previousHistory.length) {
    return "el historial de límites no se puede acortar";
  }
  for (let index = 0; index < input.previousHistory.length; index += 1) {
    if (JSON.stringify(input.previousHistory[index]) !== JSON.stringify(input.nextHistory[index])) {
      return "el historial de límites ya escrito no se puede reescribir: agrega entradas al final";
    }
  }

  if (changed.length === 0) {
    if (input.nextHistory.length !== input.previousHistory.length) {
      return "un historial nuevo exige un cambio de límites que lo explique";
    }
    return null;
  }

  // La primera versión no tiene un "antes": es el contrato que se establece.
  if (!input.previous && input.next) return null;
  if (!input.previous || !input.next) {
    return "quitar los límites deja el plan sin gobierno; escribe la versión nueva en su lugar";
  }
  if (input.next.version <= input.previous.version) {
    return `cambiar límites exige subir la versión (actual v${input.previous.version})`;
  }

  const appended = input.nextHistory.slice(input.previousHistory.length);
  const recorded = new Set(appended.map((entry) => entry.field));
  const missing = changed.filter((field) => !recorded.has(field));
  if (missing.length > 0) {
    return `cada límite cambiado exige una entrada nueva en limitHistory; falta: ${missing.join(", ")}`;
  }
  return null;
}

/**
 * Un item en "no evaluable" tiene que decir qué necesita, según la regla
 * `unknownHandling`: esperar o preguntar exigen pregunta; el default seguro
 * exige la decisión escrita. Sin eso, es un bloqueo mudo.
 */
export function validateNotEvaluableItems(
  items: readonly AutonPlanItem[],
  unknownHandling: AutonLimits["unknownHandling"] | undefined,
): string | null {
  for (const item of items) {
    if (item.status !== "not_evaluable") continue;
    if (unknownHandling === "safe_default") {
      if (!item.detail?.trim()) {
        return `el item ${item.id} queda en not_evaluable con safe_default: deja en detail la opción menos riesgosa que tomaste`;
      }
      continue;
    }
    if ((item.questions?.length ?? 0) === 0) {
      return `el item ${item.id} queda en not_evaluable: agrega en questions qué decisión necesitas del humano`;
    }
  }
  return null;
}
