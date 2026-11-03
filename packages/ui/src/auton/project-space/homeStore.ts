import { create } from "zustand";

interface AutonHomeState {
  /**
   * La app arranca en la pantalla de proyectos. Elegir o crear un proyecto
   * la cierra; volver a ella es una acción explícita.
   */
  homeVisible: boolean;
  enterProject(): void;
  showHome(): void;
}

export const useAutonHomeStore = create<AutonHomeState>((set) => ({
  homeVisible: true,
  enterProject: () => set({ homeVisible: false }),
  showHome: () => set({ homeVisible: true }),
}));
