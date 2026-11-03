// ============================================================
// Auton Plan Tool Handler
// ============================================================
// The orchestrator owns the plan. It lives on disk so the desktop surfaces
// (Sprint Board, Decision Inbox) can read it without going through a session.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  AUTON_PLAN_FILE_VERSION,
  AUTON_PLAN_TOOL_NAME,
  AutonPlanInputJsonSchema,
  AutonPlanInputSchema,
  AutonPlanOutputJsonSchema,
  AutonPlanOutputSchema,
  AutonPlanSchema,
  describeEvaluation,
  evaluateDispatch,
  normalizeLegacyPlan,
  summarizeAutonPlan,
  validateLimitChange,
  validateNotEvaluableItems,
  type AutonLimits,
  type AutonPlan,
  type AutonPlanInput,
  type AutonPlanItem,
  type AutonPlanOutput,
} from "@zcode/contracts";
import type { ToolEntry, ToolHandler } from "../tool/types.js";
import { isAutonWorkerSession } from "./journal.js";

const MAX_AUTON_PLAN_MODEL_BYTES = 60_000;

/** Fallos de gobierno: son resultado de negocio, no excepciones. */
const AUTON_PLAN_ERROR = {
  Exceeds: 42202,
  RequiresApproval: 42203,
  UnrecordedChange: 42204,
  AttemptsRegression: 42205,
  MuteNotEvaluable: 42206,
} as const;

export function resolveAutonPlanPath(workingDirectory: string): string {
  return join(workingDirectory, ".auton", "plan.json");
}

function projectRoot(context: {
  workingDirectory: string;
  workspaceRoot?: string;
}): string {
  return context.workspaceRoot?.trim() || context.workingDirectory;
}

function emptyPlan(): AutonPlan {
  return { version: AUTON_PLAN_FILE_VERSION, limitHistory: [], limitReports: [], items: [] };
}

async function readPlanFile(path: string): Promise<AutonPlan> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyPlan();
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyPlan();
  }

  const result = AutonPlanSchema.safeParse(parsed);
  return result.success ? normalizeLegacyPlan(result.data) : emptyPlan();
}

function failure(errorCode: number, message: string) {
  return { result: false as const, errorCode, message };
}

/**
 * Un despacho consume un intento. Los cuenta el plan para que el tope no
 * dependa de que el modelo lleve la cuenta: al agotar maxAttempts, el item
 * deja de arrancar y la decisión pasa al humano.
 *
 * Sin límites versionados el orquestador manda: el despacho se permite y el
 * plan queda "sin versión". Solo se respeta la aprobación que él mismo puso en
 * el item, porque esa es su propia regla, no una guardia genérica.
 */
function consumirIntentos(
  items: readonly AutonPlanItem[],
  previousItems: readonly AutonPlanItem[],
  limits: AutonLimits | undefined,
): { value: AutonPlanItem[] } | { failure: { result: false; errorCode: number; message: string } } {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  const value: AutonPlanItem[] = [];

  for (const item of items) {
    const before = previousById.get(item.id);
    const previousAttempts = before?.attempts ?? 0;

    // El modelo puede omitir `attempts` (el esquema lo rellena con 0): en ese
    // caso manda la cuenta del plan. Solo un valor explícito puede pedir bajarla.
    const claimedAttempts = item.attempts > 0 ? item.attempts : previousAttempts;
    if (claimedAttempts < previousAttempts) {
      return {
        failure: failure(
          AUTON_PLAN_ERROR.AttemptsRegression,
          `el item ${item.id} no puede bajar sus intentos (${previousAttempts} → ${claimedAttempts})`,
        ),
      };
    }

    const startingWork = item.status === "running" && before?.status !== "running";
    if (!startingWork) {
      value.push({ ...item, attempts: claimedAttempts });
      continue;
    }

    if (!limits) {
      const gate = item.needsApproval ?? [];
      if (gate.length > 0) {
        return {
          failure: failure(
            AUTON_PLAN_ERROR.RequiresApproval,
            `el item ${item.id} pide aprobación humana (${gate.join(", ")}) según la regla que escribió el orquestador; déjalo en waiting con la pregunta`,
          ),
        };
      }
      value.push({ ...item, attempts: previousAttempts + 1 });
      continue;
    }

    const evaluation = evaluateDispatch({
      limits,
      item: { attempts: previousAttempts, needsApproval: item.needsApproval },
    });

    if (evaluation.kind === "not_evaluable") {
      value.push({ ...item, attempts: previousAttempts + 1 });
      continue;
    }
    if (evaluation.kind === "requires_approval") {
      return {
        failure: failure(
          AUTON_PLAN_ERROR.RequiresApproval,
          `el item ${item.id} ${describeEvaluation(evaluation)}`,
        ),
      };
    }
    if (evaluation.kind === "exceeds") {
      return {
        failure: failure(
          AUTON_PLAN_ERROR.Exceeds,
          `el item ${item.id}: ${describeEvaluation(evaluation)}`,
        ),
      };
    }

    value.push({ ...item, attempts: previousAttempts + 1 });
  }

  return { value };
}

export const autonPlanHandler: ToolHandler = async (input, context) => {
  const parsed = AutonPlanInputSchema.parse(input) as AutonPlanInput;
  const path = resolveAutonPlanPath(projectRoot(context));

  if (parsed.action === "read") {
    const plan = await readPlanFile(path);
    return {
      path,
      plan,
      summary: summarizeAutonPlan(plan.items),
    } satisfies AutonPlanOutput;
  }

  // write: the orchestrator sends the complete plan; it replaces the file.
  // El historial y los reportes de límites se conservan si el write los omite:
  // un cambio de límites sin escribir no existe, y borrarlo por omisión sería peor.
  const previous = await readPlanFile(path);
  const limits = parsed.limits ?? previous.limits;
  const limitHistory = parsed.limitHistory ?? previous.limitHistory;
  const limitReports = parsed.limitReports ?? previous.limitReports;

  // Un programador puede reportar que un límite está mal calibrado, nunca
  // cambiarlo: los límites son el contrato que el orquestador acuerda con el humano.
  if (isAutonWorkerSession(context.sessionId)) {
    const limitsChanged = JSON.stringify(limits ?? null) !== JSON.stringify(previous.limits ?? null);
    const historyChanged = limitHistory.length !== previous.limitHistory.length;
    const reportsChanged = limitReports.length !== previous.limitReports.length;
    if (limitsChanged || historyChanged || reportsChanged) {
      throw new Error(
        "Un programador no puede cambiar los límites del plan. Puede reportarlo en el REPORTE y el orquestador decide.",
      );
    }
  }

  const unrecorded = validateLimitChange({
    previous: previous.limits,
    next: limits,
    previousHistory: previous.limitHistory,
    nextHistory: limitHistory,
  });
  if (unrecorded) {
    return failure(AUTON_PLAN_ERROR.UnrecordedChange, unrecorded);
  }

  const items = consumirIntentos(parsed.items, previous.items, limits);
  if ("failure" in items) return items.failure;

  const mute = validateNotEvaluableItems(items.value, limits?.unknownHandling);
  if (mute) {
    return failure(AUTON_PLAN_ERROR.MuteNotEvaluable, mute);
  }

  const plan: AutonPlan = {
    version: AUTON_PLAN_FILE_VERSION,
    goal: parsed.goal,
    limits,
    limitHistory,
    limitReports,
    items: items.value,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(path), { recursive: true });

  await writeFile(path, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  return {
    path,
    plan,
    summary: summarizeAutonPlan(plan.items),
  } satisfies AutonPlanOutput;
};

export const autonPlanToolEntry: ToolEntry = {
  capability:
    "Read or write the project's Auton plan at <workspace>/.auton/plan.json, the plan the human sees",
  metadata: {
    // No se difiere: el plan es la herramienta central del orquestador y debe
    // estar en la lista del modelo desde el primer turno.
    name: AUTON_PLAN_TOOL_NAME,
    searchHint: "project sprint plan, goal and work items",
    description: `Read or write the Auton plan for this project. The plan is stored at <workspace>/.auton/plan.json and is what the human sees as the sprint board.

Use \`action: "read"\` to load the current plan before you plan or dispatch anything.
Use \`action: "write"\` with the COMPLETE list of work items to replace the plan; it is the source of truth, so send every item each time.

Limits: \`limits\` carries the versioned rules for what you may do without asking (version, maxAttempts, approval flags, unknownHandling). Every limit change must bump \`version\` and append one \`limitHistory\` entry per changed field (at, field, from/to, reason, approvedBy). Rewriting or shortening that history is rejected; the first version has no prior history. If a write omits \`limitHistory\` or \`limitReports\`, the stored ones are preserved.

Dispatch is governed by the rules you write: an item can move to \`running\` while it still has attempts left (\`attempts\` is counted by the plan, one per dispatch, and can never go down). With versioned \`limits\`, the plan also enforces \`maxAttempts\` and the approval flags you marked on the item. Without \`limits\` the plan is "unversioned": you still govern; the plan only counts attempts and respects the \`needsApproval\` you wrote yourself. When you cannot judge, set the item to \`not_evaluable\` and put the exact question in \`questions\` (or explain the safest choice in \`detail\` when unknownHandling is safe_default): that item escalates to the human instead of continuing.

A worker can report a miscalibrated limit in \`limitReports\` (at, field, observed, expected, by). Only the orchestrator writes it; the report never changes the limit.

Work item statuses: ready, running, waiting, blocked, done, dropped, not_evaluable. Use \`waiting\` when an item needs a human decision, and put that question in \`questions\`.
Set \`effort\` (minimal, standard, thorough), \`owner\` (programmer by default;
orchestrator only for one small single-file item) and \`files\` on every item you
dispatch, and pass the same effort in the Agent tool's \`effort\` field.

If the request has two or more independent deliverables, the plan needs one item
per deliverable and one programmer per item; do not do that work yourself.`,
    readOnly: false,
    destructive: false,
    concurrentSafe: false,
    timeoutMs: 30000,
    maxOutputBytes: MAX_AUTON_PLAN_MODEL_BYTES,
    sideEffectScope: "workspace",
    riskLevel: "low",
    needsApproval: false,
  },
  handler: autonPlanHandler,
  inputSchema: AutonPlanInputJsonSchema,
  outputSchema: AutonPlanOutputJsonSchema,
  runtimeInputSchema: AutonPlanInputSchema,
  runtimeOutputSchema: AutonPlanOutputSchema,
  permission: {
    permission: "auton.plan",
    reason: "AutonPlan only updates the project's .auton/plan.json",
    riskLevel: "low",
    sideEffectScope: "workspace",
    needsApproval: false,
    patternSources: ["toolName"],
    alwaysAllowPatternSources: ["toolName"],
    denyPriority: "beforeAsk",
  },
  resultBudget: {
    maxInlineBytes: MAX_AUTON_PLAN_MODEL_BYTES,
    maxModelBytes: MAX_AUTON_PLAN_MODEL_BYTES,
    strategy: "truncate",
    preview: {
      maxBytes: MAX_AUTON_PLAN_MODEL_BYTES,
      direction: "head",
    },
  },
  timeout: {
    defaultMs: 30000,
    maxMs: 30000,
    allowCallOverride: false,
  },
  cancellation: {
    supported: true,
    cleanup: "none",
    userVisibleMessage: "AutonPlan was cancelled before the plan was updated",
  },
  trace: {
    required: true,
    propagateToAdapters: false,
    recordInput: "summary",
    recordOutput: "summary",
  },
};
