// ============================================================
// Productor del espacio del proyecto — composición con identidad
// ============================================================
// `AutonSpaceLive` compone la superficie con la proyección de las filas, los
// agentes del workspace y las conversaciones de los workers de sesión. Esa
// composición es cara y no depende del reloj: con las mismas entradas debe
// devolver el MISMO objeto, para que un tick o un chunk sin cambios no
// re-renderice la pantalla entera. Puro y testeable: sin React.

import type { ZCodeTaskMeta } from "@zcode/shared";
import type { ConversationRow } from "@zcode/shared/zcode-protocol-v4";
import { agentTramo, projectAgentWorkers } from "./agentProjection.js";
import type { AutonProjectSpaceData } from "./model.js";
import { projectAutonSpace } from "./projection.js";
import { mergeSessionWorkers, type AutonSessionWorkerSnapshot } from "./sessionWorker.js";

export interface AutonSpaceProducerInput {
  rows: readonly ConversationRow[];
  agents: readonly ZCodeTaskMeta[];
  sessionWorkers: readonly AutonSessionWorkerSnapshot[];
}

/** La composición completa, sin caché: filas + agentes + workers de sesión. */
export function composeAutonSpace(
  orchestratorId: string,
  input: AutonSpaceProducerInput,
): AutonProjectSpaceData {
  const base = projectAutonSpace({ rows: input.rows });
  // Transición: los agentes completos son los workers; los subagentes se
  // conservan como compatibilidad mientras existan. El orquestador no es worker.
  const agentWorkers = projectAgentWorkers(input.agents).filter(
    (worker) => worker.id !== orchestratorId,
  );
  const agentIds = new Set(agentWorkers.map((worker) => worker.id));
  const workers = [
    ...agentWorkers,
    ...base.workers.filter((worker) => !agentIds.has(worker.id)),
  ];
  const tramo = agentTramo(agentWorkers);
  return mergeSessionWorkers(
    {
      ...base,
      workers,
      tramos: tramo ? [tramo, ...base.tramos] : base.tramos,
    },
    input.sessionWorkers,
  );
}

/**
 * Productor con identidad: mismas referencias de entrada ⇒ mismo objeto.
 * El reloj no es entrada (las duraciones se pintan en las hojas).
 */
export function createAutonSpaceProducer(orchestratorId: string): (
  input: AutonSpaceProducerInput,
) => AutonProjectSpaceData {
  let cache: { input: AutonSpaceProducerInput; data: AutonProjectSpaceData } | null = null;
  return function produceAutonSpace(input: AutonSpaceProducerInput): AutonProjectSpaceData {
    if (
      cache &&
      cache.input.rows === input.rows &&
      cache.input.agents === input.agents &&
      cache.input.sessionWorkers === input.sessionWorkers
    ) {
      return cache.data;
    }
    const data = composeAutonSpace(orchestratorId, input);
    cache = { input, data };
    return data;
  };
}
