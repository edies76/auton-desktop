// @vitest-environment jsdom
import type { ProjectTask } from "@zcode/services";
import { beforeEach, describe, expect, it } from "vitest";
import {
  claimProjectConversationCreation,
  ensureProjectConversation,
  isLegacyProjectTask,
  rememberProjectOrchestrator,
  shouldOpenProjectOrchestrator,
} from "../src/project-sidebar/projectConversation.js";

function task(taskId: string, createdAt: number, updatedAt: number): ProjectTask {
  return {
    taskId,
    title: taskId,
    projectId: "p1",
    hostId: "local",
    workspacePath: "/workspace/lunar",
    status: "completed",
    createdAt,
    updatedAt,
    archived: false,
  } as unknown as ProjectTask;
}

beforeEach(() => {
  localStorage.clear();
});

describe("una conversación de orquestador por proyecto", () => {
  it("la sesión activa manda aunque sea más vieja que otra", () => {
    const tasks = [task("old-active", 1, 10), task("new-chat", 2, 99)];
    const conversation = ensureProjectConversation("ws::p1", tasks, "old-active");
    expect(conversation.orchestratorTaskId).toBe("old-active");
    expect(conversation.legacyTaskIds).toEqual(["new-chat"]);
    expect(isLegacyProjectTask("ws::p1", "new-chat")).toBe(true);
  });

  it("sin sesión activa usa la más antigua, no la más actualizada", () => {
    const tasks = [task("old", 1, 5), task("newer", 2, 99)];
    expect(ensureProjectConversation("ws::p1", tasks).orchestratorTaskId).toBe("old");
  });

  it("relegar el chat anterior al abrir otro", () => {
    const tasks = [task("old", 1, 5), task("newer", 2, 99)];
    ensureProjectConversation("ws::p1", tasks, "old");
    const next = rememberProjectOrchestrator("ws::p1", "newer");
    expect(next?.orchestratorTaskId).toBe("newer");
    expect(next?.legacyTaskIds).toContain("old");
    expect(next?.legacyTaskIds).not.toContain("newer");
  });

  it("la conversación persistida gana frente a una sesión activa legada", () => {
    const tasks = [task("old", 1, 5), task("newer", 2, 99)];
    ensureProjectConversation("ws::p1", tasks, "newer");
    // La sesión activa es el chat legado; la persistida sigue siendo la única.
    expect(ensureProjectConversation("ws::p1", tasks, "old").orchestratorTaskId).toBe("newer");
    expect(isLegacyProjectTask("ws::p1", "old")).toBe(true);
  });
});

  it("la creación de la conversación se reclama una vez por proyecto", () => {
    const created = new Set<string>();
    expect(claimProjectConversationCreation(created, "ws::p1")).toBe(true);
    expect(claimProjectConversationCreation(created, "ws::p2")).toBe(true);
    expect(claimProjectConversationCreation(created, "ws::p1")).toBe(false);
  });

  it("solo abre el orquestador persistido cuando la activa es legado o no hay activa", () => {
    const base = { orchestratorTaskId: "orch", legacyTaskIds: ["old"] };
    expect(shouldOpenProjectOrchestrator({ ...base, activeTaskId: null })).toBe(true);
    expect(shouldOpenProjectOrchestrator({ ...base, activeTaskId: "old" })).toBe(true);
    expect(shouldOpenProjectOrchestrator({ ...base, activeTaskId: "orch" })).toBe(false);
    expect(shouldOpenProjectOrchestrator({ ...base, activeTaskId: "nueva" })).toBe(false);
  });
