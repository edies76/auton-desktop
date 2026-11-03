import { create } from "zustand";

export interface AutonProjectConversationState {
  /** Workspace al que pertenece la conversación publicada. */
  workspaceKey: string;
  projectId: string | null;
  orchestratorTaskId: string | null;
  legacyTaskIds: string[];
  publish(input: {
    workspaceKey: string;
    projectId: string;
    orchestratorTaskId: string;
    legacyTaskIds: readonly string[];
  }): void;
  clear(): void;
}

/**
 * El sidebar es quien conoce el proyecto y su conversación; el shell necesita
 * esa identidad para no etiquetar como orquestador un chat legado o un worker.
 */
export const useAutonProjectConversationStore = create<AutonProjectConversationState>((set) => ({
  workspaceKey: "",
  projectId: null,
  orchestratorTaskId: null,
  legacyTaskIds: [],
  publish: (input) =>
    set({
      workspaceKey: input.workspaceKey,
      projectId: input.projectId,
      orchestratorTaskId: input.orchestratorTaskId,
      legacyTaskIds: [...input.legacyTaskIds],
    }),
  clear: () =>
    set({
      workspaceKey: "",
      projectId: null,
      orchestratorTaskId: null,
      legacyTaskIds: [],
    }),
}));

export function isPublishedOrchestrator(
  state: AutonProjectConversationState,
  workspaceKey: string,
  taskId: string | null,
): boolean {
  return Boolean(
    taskId && state.workspaceKey === workspaceKey && state.orchestratorTaskId === taskId,
  );
}

export function isPublishedLegacyTask(
  state: AutonProjectConversationState,
  workspaceKey: string,
  taskId: string | null,
): boolean {
  return Boolean(
    taskId && state.workspaceKey === workspaceKey && state.legacyTaskIds.includes(taskId),
  );
}
