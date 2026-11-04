import { z } from "zod";

/**
 * Motor que ejecuta a un worker Auton. `zcode` es el de casa; `muse` es
 * Muse Code como programa externo. El orquestador elige uno por despacho y el
 * contrato del worker (brief, modo, esfuerzo, reporte, evidencia) no cambia.
 */
export const AUTON_WORKER_ENGINES = ["zcode", "muse"] as const;

export type AutonWorkerEngine = (typeof AUTON_WORKER_ENGINES)[number];

export const DEFAULT_AUTON_WORKER_ENGINE: AutonWorkerEngine = "zcode";

export const AutonWorkerEngineSchema = z.enum(AUTON_WORKER_ENGINES);
