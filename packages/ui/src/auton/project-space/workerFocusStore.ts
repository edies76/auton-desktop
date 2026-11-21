import type { CenterSelectionOrigin } from "@/auton/project-space/centerView.js";
import type { AutonWorkerView } from "@/auton/project-space/model.js";
import { create } from "zustand";

interface AutonWorkerFocusState {
  /** Intención del humano: la fila que eligió en el panel. */
  selectedWorkerId: string | null;
  selectionOrigin: CenterSelectionOrigin;
  /** Agente cuyos subagentes se listan; se conserva al abrir un subagente. */
  listWorkerId: string | null;
  /** Datos de la proyección viva; los escribe solo el sidebar. */
  liveWorkers: AutonWorkerView[];
  workspacePath: string;
  workspaceIdentity?: string;
  select(
    workerId: string,
    workspacePath: string,
    workspaceIdentity?: string,
    listWorkerId?: string | null,
  ): void;
  setLiveWorkers(workers: AutonWorkerView[]): void;
  close(): void;
}

function sameWorker(a: AutonWorkerView, b: AutonWorkerView): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.status === b.status &&
    a.startedAt === b.startedAt &&
    a.lastSignalAt === b.lastSignalAt &&
    a.kind === b.kind &&
    a.engine === b.engine &&
    a.lastLine === b.lastLine &&
    a.subagentCount === b.subagentCount
  );
}

/** Contenido equivalente ⇒ misma lista: los consumidores no se despiertan de más. */
export function sameAutonWorkers(
  a: readonly AutonWorkerView[],
  b: readonly AutonWorkerView[],
): boolean {
  return a === b || (a.length === b.length && a.every((worker, index) => sameWorker(worker, b[index]!)));
}

/**
 * El panel izquierdo guarda la selección; la lista viva es un dato aparte que
 * escribe la proyección. Elegir una fila no inventa ni reemplaza esa lista.
 */
export const useAutonWorkerFocusStore = create<AutonWorkerFocusState>((set) => ({
  selectedWorkerId: null,
  selectionOrigin: null,
  listWorkerId: null,
  liveWorkers: [],
  workspacePath: "",
  select: (workerId, workspacePath, workspaceIdentity, listWorkerId) =>
    set({
      selectedWorkerId: workerId,
      selectionOrigin: "panel",
      listWorkerId:
        listWorkerId === undefined ? workerId : (listWorkerId ?? workerId),
      workspacePath,
      workspaceIdentity,
    }),
  // Publicar una lista con el mismo contenido no es noticia: sin esto cada
  // re-derivación (o un tick) despierta a todos los suscriptores por gusto.
  setLiveWorkers: (workers) =>
    set((state) =>
      sameAutonWorkers(state.liveWorkers, workers) ? state : { liveWorkers: workers },
    ),
  close: () =>
    set({
      selectedWorkerId: null,
      selectionOrigin: null,
      listWorkerId: null,
    }),
}));

export function focusedWorker(state: AutonWorkerFocusState): AutonWorkerView | null {
  if (!state.selectedWorkerId) return null;
  return state.liveWorkers.find((worker) => worker.id === state.selectedWorkerId) ?? null;
}

/** Al cambiar de workspace/proyecto, el foco y sus datos viejos se cierran. */
export function closeWorkerFocusForWorkspace(workspacePath: string): void {
  const state = useAutonWorkerFocusStore.getState();
  if (state.workspacePath && state.workspacePath !== workspacePath) {
    state.close();
    state.setLiveWorkers([]);
  }
}
