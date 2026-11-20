// ============================================================
// Despertar del orquestador por avisos — camino real del runtime
// ============================================================
// Un aviso relevante (mensaje de worker, cierre, latido, agente externo)
// además de quedar encolado para lectura, enciende un turno con una guía
// genérica: "tienes avisos sin leer". El contenido viaja solo por
// AutonNotifications; aquí no se copia nada del worker.

import { autonNotificationRegistryFor } from "@zcode/shared/auton-notifications";
import type { TraceContext } from "../deps.js";
import { createRuntimeCommandId } from "../command-queue.js";
import type { AgentRuntimeInternal } from "../internal.js";
import { formatAutonWakeNotice, shouldWakeOrchestrator } from "../../auton/wake.js";

export function wakeOrchestratorForNotifications(
  runtime: AgentRuntimeInternal,
  traceContext: TraceContext,
): void {
  if (runtime.shuttingDown) return;
  const registry = autonNotificationRegistryFor(String(runtime.sessionId));
  const summaries = registry.summaries();
  if (summaries.every((summary) => summary.unread === 0)) return;
  // Coalescencia: varios avisos seguidos producen un solo despertar. Los que
  // caen dentro de la ventana no se pierden: siguen sin leer en su canal.
  if (!shouldWakeOrchestrator(String(runtime.sessionId))) return;
  runtime.enqueueRuntimeCommand({
    branchGeneration: runtime.branchGeneration,
    createdAt: new Date(),
    id: createRuntimeCommandId(),
    mode: "task-notification",
    priority: "next",
    source: "background_task",
    taskId: `auton-wake:${String(runtime.sessionId)}`,
    text: formatAutonWakeNotice(summaries),
    traceContext,
  });
}
