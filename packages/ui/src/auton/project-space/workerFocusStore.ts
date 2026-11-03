import type { CenterSelectionOrigin } from "@/auton/project-space/centerView.js";
import type { AutonWorkerView } from "@/auton/project-space/model.js";
import { create } from "zustand";

export type AutonWorkerFocusMode = "summary" | "chat";

interface AutonWorkerFocusState {
  /** Intención del humano: la fila que eligió en el panel. */
  selectedWorkerId: string | null;
  selectionOrigin: CenterSelectionOrigin;
  /** Datos de la proyección viva; los escribe solo el sidebar. */
  liveWorkers: AutonWorkerView[];
  workspacePath: string;
  workspaceIdentity?: string;
  mode: AutonWorkerFocusMode;
  select(workerId: string, workspacePath: string, workspaceIdentity?: string): void;
  setLiveWorkers(workers: AutonWorkerView[]): void;
  setMode(mode: AutonWorkerFocusMode): void;
  close(): void;
}

/**
 * El panel izquierdo guarda la selección; la lista viva es un dato aparte que
 * escribe la proyección. Elegir una fila no inventa ni reemplaza esa lista.
 */
export const useAutonWorkerFocusStore = create<AutonWorkerFocusState>((set) => ({
  selectedWorkerId: null,
  selectionOrigin: null,
  liveWorkers: [],
  workspacePath: "",
  mode: "summary",
  select: (workerId, workspacePath, workspaceIdentity) =>
    set({
      selectedWorkerId: workerId,
      selectionOrigin: "panel",
      workspacePath,
      workspaceIdentity,
      mode: "summary",
    }),
  setLiveWorkers: (workers) => set({ liveWorkers: workers }),
  setMode: (mode) => set({ mode }),
  close: () =>
    set({
      selectedWorkerId: null,
      selectionOrigin: null,
      mode: "summary",
    }),
}));

export function focusedWorker(state: AutonWorkerFocusState): AutonWorkerView | null {
  if (!state.selectedWorkerId) return null;
  return (
    state.liveWorkers.find((worker) => worker.id === state.selectedWorkerId) ?? null
  );
}

/** Al cambiar de workspace/proyecto, el foco y sus datos viejos se cierran. */
export function closeWorkerFocusForWorkspace(workspacePath: string): void {
  const state = useAutonWorkerFocusStore.getState();
  if (state.workspacePath && state.workspacePath !== workspacePath) {
    state.close();
    state.setLiveWorkers([]);
  }
}
