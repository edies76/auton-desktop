import type { AutonWorkerView } from "@/auton/project-space/model.js";
import { create } from "zustand";

export type AutonWorkerFocusMode = "summary" | "chat";

interface AutonWorkerFocusState {
  workerId: string | null;
  /** Snapshot inicial; la verdad viva está en liveWorkers. */
  worker: AutonWorkerView | null;
  liveWorkers: AutonWorkerView[];
  workspacePath: string;
  workspaceIdentity?: string;
  /** Un subagente se para interrumpiendo el turno del orquestador. */
  stopTaskId?: string;
  mode: AutonWorkerFocusMode;
  open(
    worker: AutonWorkerView,
    workspacePath: string,
    workspaceIdentity?: string,
    stopTaskId?: string,
  ): void;
  setLiveWorkers(workers: AutonWorkerView[]): void;
  setMode(mode: AutonWorkerFocusMode): void;
  close(): void;
}

/**
 * El worker seleccionado en el panel izquierdo se abre en el área del
 * orquestador: primero un resumen, después su chat real de solo lectura. El
 * sidebar publica la proyección viva para que estado y reloj no se congelen.
 */
export const useAutonWorkerFocusStore = create<AutonWorkerFocusState>((set) => ({
  workerId: null,
  worker: null,
  liveWorkers: [],
  workspacePath: "",
  mode: "summary",
  open: (worker, workspacePath, workspaceIdentity, stopTaskId) =>
    set({
      workerId: worker.id,
      worker,
      liveWorkers: [worker],
      workspacePath,
      workspaceIdentity,
      stopTaskId,
      mode: "summary",
    }),
  setLiveWorkers: (workers) => set({ liveWorkers: workers }),
  setMode: (mode) => set({ mode }),
  close: () =>
    set({ workerId: null, worker: null, liveWorkers: [], stopTaskId: undefined, mode: "summary" }),
}));

export function focusedWorker(state: AutonWorkerFocusState): AutonWorkerView | null {
  if (!state.workerId) return null;
  return (
    state.liveWorkers.find((worker) => worker.id === state.workerId) ??
    (state.worker?.id === state.workerId ? state.worker : null)
  );
}

/** Al cambiar de workspace/proyecto, el foco del worker anterior se cierra. */
export function closeWorkerFocusForWorkspace(workspacePath: string): void {
  const state = useAutonWorkerFocusStore.getState();
  if (state.workspacePath && state.workspacePath !== workspacePath) state.close();
}
