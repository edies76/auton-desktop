import { z } from "zod";

/**
 * Eje de MODO de trabajo del worker Auton. Es distinto del esfuerzo: el
 * esfuerzo dice cuánto trabaja el worker; el modo dice qué clase de trabajo
 * hace. Viaja en el encargo y se aplica en el runtime, no solo en el prompt.
 */
export const AUTON_WORKER_TASK_MODES = [
  "build",
  "read",
  "research",
  "debug",
  "refactor",
] as const;

export type AutonWorkerTaskMode = (typeof AUTON_WORKER_TASK_MODES)[number];

export const DEFAULT_AUTON_WORKER_TASK_MODE: AutonWorkerTaskMode = "build";

export const AutonWorkerTaskModeSchema = z.enum(AUTON_WORKER_TASK_MODES);
