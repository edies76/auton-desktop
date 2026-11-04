import { create } from "zustand";

interface AutonHomeState {
  /**
   * La app arranca en la pantalla de proyectos. Elegir o crear un proyecto
   * la cierra; volver a ella es una acción explícita.
   */
  homeVisible: boolean;
  /** Proyecto pedido desde el resumen central; el panel lo resuelve. */
  requestedProjectId: string | null;
  enterProject(): void;
  showHome(): void;
  requestProject(projectId: string): void;
  consumeProjectRequest(): string | null;
}

export const useAutonHomeStore = create<AutonHomeState>((set, get) => ({
  homeVisible: true,
  requestedProjectId: null,
  enterProject: () => set({ homeVisible: false }),
  showHome: () => set({ homeVisible: true }),
  requestProject: (projectId) => set({ requestedProjectId: projectId }),
  consumeProjectRequest: () => {
    const projectId = get().requestedProjectId;
    if (projectId !== null) set({ requestedProjectId: null });
    return projectId;
  },
}));
