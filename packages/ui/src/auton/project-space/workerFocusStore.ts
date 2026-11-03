import type { AutonWorkerView } from "@/auton/project-space/model.js";
import { create } from "zustand";

export type AutonWorkerFocusMode = "summary" | "chat";

interface AutonWorkerFocusState {
  worker: AutonWorkerView | null;
  workspacePath: string;
  workspaceIdentity?: string;
  mode: AutonWorkerFocusMode;
  open(worker: AutonWorkerView, workspacePath: string, workspaceIdentity?: string): void;
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
  open: (worker, workspacePath, workspaceIdentity) =>
    set({ worker, workspacePath, workspaceIdentity, mode: "summary" }),
  setMode: (mode) => set({ mode }),
  close: () => set({ worker: null, mode: "summary" }),
}));
