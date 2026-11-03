// ============================================================
// Auton project space — subagentes por worker
// ============================================================
// El panel necesita el total de subagentes de cada agente sin abrir su pane.
// La consulta canónica es `session/subagents`; se limita la concurrencia para
// no abrir una ráfaga de consultas y se refresca solo mientras el worker vive.

import { useEffect, useMemo, useRef, useState } from "react";
import { useBaseWorkspaceServices } from "@/hooks/useWorkspaceServices.js";
import { logger } from "@/logger.js";
import type { AutonWorkerView } from "./model.js";

const REFRESH_MS = 20_000;
const MAX_CONCURRENT = 3;
const TERMINAL_STATUSES = new Set<AutonWorkerView["status"]>(["terminado", "bloqueado"]);

export interface AutonSubagentCountsOptions {
  /** Solo agentes completos: los subagentes no crean otros subagentes en el panel. */
  agents: readonly AutonWorkerView[];
  workspacePath: string;
  workspaceIdentity?: string;
  remoteSessionId?: string;
  /** Sin orquestador cargado no hay a quién preguntar. */
  enabled?: boolean;
}

/**
 * Total de subagentes creados por cada worker, indexado por id de sesión.
 * Los fallos se ignoran: una sesión archivada no debe romper la lista.
 */
export function useAutonSubagentCounts(
  options: AutonSubagentCountsOptions,
): Readonly<Record<string, number>> {
  const services = useBaseWorkspaceServices();
  const zcodeAgentService = services.zcodeAgentService;
  const countsRef = useRef<Record<string, number>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  // La firma evita reconsultar en cada tic del reloj: solo cambia con id o estado.
  const signature = useMemo(
    () => options.agents.map((worker) => `${worker.id}:${worker.status}`).join("\n"),
    [options.agents],
  );

  useEffect(() => {
    const entries = signature
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.lastIndexOf(":");
        return {
          id: line.slice(0, separator),
          status: line.slice(separator + 1) as AutonWorkerView["status"],
        };
      });
    const ids = entries.map((entry) => entry.id);
    const liveIds = entries
      .filter((entry) => !TERMINAL_STATUSES.has(entry.status))
      .map((entry) => entry.id);
    const finished = new Set(
      entries.filter((entry) => TERMINAL_STATUSES.has(entry.status)).map((entry) => entry.id),
    );

    const enabled = options.enabled !== false;
    if (!enabled || ids.length === 0) {
      countsRef.current = {};
      setCounts({});
      return;
    }
    // Un worker que salió de la lista (u otro proyecto) no debe conservar su número.
    const present = new Set(ids);
    const stale = Object.keys(countsRef.current).filter((id) => !present.has(id));
    if (stale.length > 0) {
      const next = { ...countsRef.current };
      for (const id of stale) delete next[id];
      countsRef.current = next;
      setCounts(next);
    }
    if (!zcodeAgentService || typeof zcodeAgentService.listSessionSubagents !== "function") {
      return;
    }

    let cancelled = false;
    let running = false;

    const publish = (workerId: string, total: number) => {
      if (countsRef.current[workerId] === total) return;
      countsRef.current = { ...countsRef.current, [workerId]: total };
      setCounts(countsRef.current);
    };

    const fetchOne = async (workerId: string) => {
      // Un worker cerrado ya no cambia su cuenta; se consulta una sola vez.
      if (finished.has(workerId) && countsRef.current[workerId] !== undefined) return;
      try {
        const result = await zcodeAgentService.listSessionSubagents({
          workspacePath: options.workspacePath,
          ...(options.workspaceIdentity ? { workspaceIdentity: options.workspaceIdentity } : {}),
          ...(options.remoteSessionId ? { remoteSessionId: options.remoteSessionId } : {}),
          sessionId: workerId,
          endedLimit: 1,
        });
        if (cancelled) return;
        publish(workerId, result.childSessionIds.length);
      } catch (error) {
        // Una fila puede sobrevivir a su sesión; el contador simplemente no aparece.
        logger.debug("auton.subagents.count.failed", {
          sessionId: workerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const run = async (refresh: boolean) => {
      if (cancelled || running) return;
      running = true;
      const queue = refresh ? liveIds : ids;
      let cursor = 0;
      const drain = async () => {
        while (!cancelled && cursor < queue.length) {
          const workerId = queue[cursor];
          cursor += 1;
          if (workerId) await fetchOne(workerId);
        }
      };
      await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, drain));
      running = false;
    };

    void run(false);
    const interval = liveIds.length > 0 ? setInterval(() => void run(true), REFRESH_MS) : null;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [
    signature,
    options.enabled,
    options.remoteSessionId,
    options.workspaceIdentity,
    options.workspacePath,
    zcodeAgentService,
  ]);

  return counts;
}
