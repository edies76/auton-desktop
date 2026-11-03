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
  it("la conversación que abre el humano manda aunque sea más vieja", () => {
    const tasks = [task("old-active", 1, 10), task("new-worker", 2, 99)];
    expect(ensureProjectConversation("ws::p1", tasks).orchestratorTaskId).toBe("new-worker");
    const conversation = rememberProjectOrchestrator("ws::p1", "old-active");
    expect(conversation?.orchestratorTaskId).toBe("old-active");
    expect(conversation?.legacyTaskIds).toContain("new-worker");
    expect(conversation?.workerTaskIds).toEqual([]);
    expect(ensureProjectConversation("ws::p1", tasks).orchestratorTaskId).toBe("old-active");
  });

  it("sin conversación previa usa la última, nunca un worker marcado", () => {
    const tasks = [task("old", 1, 5), task("newer", 2, 99)];
    expect(ensureProjectConversation("ws::p1", tasks).orchestratorTaskId).toBe("newer");
  });

  it("relegar el chat anterior al abrir otro y retirarlo de workers", () => {
    const tasks = [task("old", 1, 5), task("newer", 2, 99)];
    ensureProjectConversation("ws::p1", tasks);
    markWorkerTask("ws::p1", "newer");
    const next = rememberProjectOrchestrator("ws::p1", "old");
    expect(next?.orchestratorTaskId).toBe("old");
    expect(next?.legacyTaskIds).toContain("newer");
    expect(next?.workerTaskIds).toContain("newer");
    expect(ensureProjectConversation("ws::p1", tasks).orchestratorTaskId).toBe("old");
  });

  it("las tareas que no son la conversación no se inventan como workers", () => {
    const tasks = [task("old", 1, 5), task("newer", 2, 99)];
    const conversation = ensureProjectConversation("ws::p1", tasks);
    expect(conversation.orchestratorTaskId).toBe("newer");
    expect(conversation.workerTaskIds).toEqual([]);
    expect(conversation.legacyTaskIds).toEqual(["old"]);
  });
});
