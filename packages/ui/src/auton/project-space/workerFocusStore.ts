import type { AutonWorkerView } from "@/auton/project-space/model.js";
import { create } from "zustand";

export type AutonWorkerFocusMode = "summary" | "chat";

interface AutonWorkerFocusState {
  worker: AutonWorkerView | null;
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
  setMode(mode: AutonWorkerFocusMode): void;
  close(): void;
}

/**
 * El worker seleccionado en el panel izquierdo se abre en el área del
 * orquestador: primero un resumen, después su chat real de solo lectura. La
 * tarea activa del orquestador no cambia.
 */
export const useAutonWorkerFocusStore = create<AutonWorkerFocusState>((set) => ({
  worker: null,
  workspacePath: "",
  mode: "summary",
  open: (worker, workspacePath, workspaceIdentity, stopTaskId) =>
    set({ worker, workspacePath, workspaceIdentity, stopTaskId, mode: "summary" }),
  setMode: (mode) => set({ mode }),
  close: () => set({ worker: null, stopTaskId: undefined, mode: "summary" }),
}));
