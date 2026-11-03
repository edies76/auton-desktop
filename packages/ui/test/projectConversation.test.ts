// @vitest-environment jsdom
import type { ProjectTask } from "@zcode/services";
import { beforeEach, describe, expect, it } from "vitest";
import {
  claimProjectConversationCreation,
  ensureProjectConversation,
  hiddenProjectTaskIds,
  isLegacyProjectTask,
  isPromotableProjectTask,
  isWorkerSessionTaskId,
  rememberProjectOrchestrator,
  resolveProjectTaskSelection,
  shouldOpenProjectOrchestrator,
} from "../src/project-sidebar/projectConversation.js";

function task(
  taskId: string,
  createdAt: number,
  updatedAt: number,
  projectId: string | null = "p1",
): ProjectTask {
  return {
    taskId,
    title: taskId,
    projectId: projectId,
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
    expect(shouldOpenProjectOrchestrator({ ...base, activeTaskId: "sess_auton_agent_1" })).toBe(true);
    expect(shouldOpenProjectOrchestrator({ ...base, activeTaskId: "orch" })).toBe(false);
    expect(shouldOpenProjectOrchestrator({ ...base, activeTaskId: "nueva" })).toBe(false);
  });

describe("visibilidad de las tareas del proyecto", () => {
  it("oculta legados y sesiones hijas, y conserva un orquestador por proyecto", () => {
    const tasks = [
      task("orch1", 1, 5, "p1"),
      task("legacy1", 2, 9, "p1"),
      task("sess_auton_worker_1", 3, 9, "p1"),
      task("sess_subagent_agent_1", 4, 9, "p1"),
      task("orch2", 1, 5, "p2"),
      task("legacy2", 2, 9, "p2"),
      task("suelto", 3, 9, null),
    ];
    ensureProjectConversation(
      "ws::p1",
      tasks.filter((entry) => entry.projectId === "p1"),
      "orch1",
    );

    const hidden = hiddenProjectTaskIds("ws", tasks, "orch1");

    expect(hidden.has("legacy1")).toBe(true);
    expect(hidden.has("sess_auton_worker_1")).toBe(true);
    expect(hidden.has("sess_subagent_agent_1")).toBe(true);
    expect(hidden.has("orch1")).toBe(false);
    expect(hidden.has("orch2")).toBe(false);
    expect(hidden.has("legacy2")).toBe(true);
    expect(hidden.has("suelto")).toBe(true);
  });

  it("no promueve un legado ni una sesión de worker como orquestador", () => {
    expect(isPromotableProjectTask({ taskId: "nueva", legacyTaskIds: ["vieja"] })).toBe(true);
    expect(isPromotableProjectTask({ taskId: "vieja", legacyTaskIds: ["vieja"] })).toBe(false);
    expect(
      isPromotableProjectTask({ taskId: "sess_auton_agent_1", legacyTaskIds: [] }),
    ).toBe(false);
    expect(
      isPromotableProjectTask({ taskId: "sess_subagent_agent_1", legacyTaskIds: [] }),
    ).toBe(false);
    expect(isWorkerSessionTaskId("sess_auton_agent_1")).toBe(true);
    expect(isWorkerSessionTaskId("sess_subagent_agent_1")).toBe(true);
    expect(isWorkerSessionTaskId("session_project_1")).toBe(false);
  });
});

describe("decisión al seleccionar una tarea", () => {
  const base = { orchestratorTaskId: "orch", legacyTaskIds: ["viejo"] };

  it("un worker va a su panel de solo lectura", () => {
    expect(resolveProjectTaskSelection({ ...base, taskId: "sess_auton_agent_1" })).toEqual({
      action: "worker",
      taskId: "sess_auton_agent_1",
    });
  });

  it("un chat legado reabre el orquestador y no se promueve", () => {
    expect(resolveProjectTaskSelection({ ...base, taskId: "viejo" })).toEqual({
      action: "redirect-orchestrator",
      taskId: "viejo",
    });
  });

  it("el orquestador se abre y una tarea nueva lo reemplaza", () => {
    expect(resolveProjectTaskSelection({ ...base, taskId: "orch" })).toEqual({
      action: "open",
      taskId: "orch",
    });
    expect(resolveProjectTaskSelection({ ...base, taskId: "nueva" })).toEqual({
      action: "promote-and-open",
      taskId: "nueva",
    });
  });
});

describe("los workers no son el orquestador", () => {
  it("una sesión de worker no se convierte en la conversación del proyecto", () => {
    const conversation = ensureProjectConversation(
      "ws::p3",
      [task("sess_auton_agent_1", 1, 9, "p3")],
      "sess_auton_agent_1",
    );

    expect(conversation.orchestratorTaskId).toBe("");
    expect(conversation.legacyTaskIds).toEqual([]);
  });
});
