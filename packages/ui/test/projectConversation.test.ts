// @vitest-environment jsdom
import type { ProjectTask } from "@zcode/services";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureProjectConversation,
  markWorkerTask,
  rememberProjectOrchestrator,
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
  it("elige la sesión activa aunque exista una worker más nueva", () => {
    const tasks = [task("old-active", 1, 10), task("new-worker", 2, 99)];
    const conversation = ensureProjectConversation("ws::p1", tasks, "old-active");
    expect(conversation.orchestratorTaskId).toBe("old-active");
    expect(conversation.legacyTaskIds).toEqual(["new-worker"]);
    expect(conversation.workerTaskIds).toEqual([]);
  });

  it("sin sesión activa usa la última conversación, no un worker más nuevo", () => {
    const tasks = [task("old", 1, 5), task("newer", 2, 99)];
    expect(ensureProjectConversation("ws::p1", tasks).orchestratorTaskId).toBe("newer");
  });

  it("relegar el chat anterior al abrir otro y retirarlo de workers", () => {
    const tasks = [task("old", 1, 5), task("newer", 2, 99)];
    ensureProjectConversation("ws::p1", tasks, "old");
    markWorkerTask("ws::p1", "newer");
    const next = rememberProjectOrchestrator("ws::p1", "newer");
    expect(next?.orchestratorTaskId).toBe("newer");
    expect(next?.legacyTaskIds).toContain("old");
    expect(next?.workerTaskIds).not.toContain("newer");
  });

  it("las tareas que no son la conversación no se inventan como workers", () => {
    const tasks = [task("old", 1, 5), task("newer", 2, 99)];
    const conversation = ensureProjectConversation("ws::p1", tasks, "old");
    expect(conversation.workerTaskIds).toEqual([]);
    expect(conversation.legacyTaskIds).toEqual(["newer"]);
  });
});
