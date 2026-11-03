import { beforeEach, describe, expect, it } from "vitest";
import {
  isPublishedLegacyTask,
  isPublishedOrchestrator,
  useAutonProjectConversationStore,
} from "../src/project-sidebar/projectConversationStore.js";

beforeEach(() => {
  useAutonProjectConversationStore.getState().clear();
});

describe("identidad publicada del proyecto", () => {
  it("solo el chat del orquestador se marca como orquestador", () => {
    useAutonProjectConversationStore.getState().publish({
      workspaceKey: "/workspace/lunar",
      projectId: "p1",
      orchestratorTaskId: "orch",
      legacyTaskIds: ["viejo"],
    });
    const state = useAutonProjectConversationStore.getState();

    expect(isPublishedOrchestrator(state, "/workspace/lunar", "orch")).toBe(true);
    expect(isPublishedOrchestrator(state, "/workspace/lunar", "viejo")).toBe(false);
    expect(isPublishedOrchestrator(state, "/workspace/lunar", "sess_auton_agent_1")).toBe(false);
    expect(isPublishedOrchestrator(state, "/workspace/otro", "orch")).toBe(false);
    expect(isPublishedLegacyTask(state, "/workspace/lunar", "viejo")).toBe(true);
    expect(isPublishedLegacyTask(state, "/workspace/lunar", "orch")).toBe(false);
  });
});
