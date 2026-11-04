import { describe, expect, it } from "vitest";
import { fixture, port } from "#src/project-storage/test-fixture.js";

describe("project reservation capacity", () => {
  it("rejects a second session in the same project", async () => {
    const { db, context } = await fixture();
    await port.migrate(db, context);
    const repo = port.repository(db);
    const project = repo.saveProject({ roots: ["/one"] });
    repo.reserveCreatedTask({
      task: { taskId: "first", workspacePath: "/one" },
      projectId: project.id,
    });
    expect(() =>
      repo.reserveCreatedTask({
        task: { taskId: "second", workspacePath: "/one" },
        projectId: project.id,
      }),
    ).toThrow("project.session-exists");
    const other = repo.saveProject({ roots: ["/two"] });
    expect(() =>
      repo.reserveCreatedTask({
        task: { taskId: "third", workspacePath: "/two" },
        projectId: other.id,
      }),
    ).not.toThrow();
    repo.reserveCreatedTask({
      task: { taskId: "third", workspacePath: "/two" },
      projectId: other.id,
    });
    const mover = repo.saveProject({ roots: ["/one"] });
    repo.reserveCreatedTask({
      task: { taskId: "move-me", workspacePath: "/one" },
      projectId: mover.id,
    });
    expect(() =>
      repo.moveTask({
        task: { taskId: "move-me", workspacePath: "/one" },
        projectId: project.id,
      }),
    ).toThrow("project.session-exists");
  });

  it("reserves frozen scheduled execution after roots change while enforcing host ownership", async () => {
    const { db, context } = await fixture();
    await port.migrate(db, context);
    const repo = port.repository(db);
    const project = repo.saveProject({ roots: ["/old", "/extra"] });
    repo.saveProject({ id: project.id, roots: ["/new"] });
    repo.deleteProject(project.id);
    const task = { workspacePath: "/old", taskId: "scheduled" };
    expect(
      repo.reserveCreatedTask({ task, projectId: project.id, additionalDirectories: ["/extra"] }),
    ).toEqual({ workspacePath: "/old", projectId: project.id, additionalDirectories: ["/extra"] });
    expect(() =>
      repo.reserveCreatedTask({
        task: { workspacePath: "/old", taskId: "ordinary" },
        projectId: project.id,
      }),
    ).toThrow("project.deleted");
    db.exec("INSERT INTO hosts(host_id,kind) VALUES ('remote:server:other','server')");
    expect(repo.resolveSessionDirectories(task).additionalDirectories).toEqual(["/extra"]);
    // 定义可删除，生成的 session 仍要保留自己的不可变执行配置。
    db.exec("DELETE FROM automations; DELETE FROM off_peak_tasks");
    expect(port.repository(db).resolveSessionDirectories(task).additionalDirectories).toEqual([
      "/extra",
    ]);
    repo.reserveCreatedTask({ task, projectId: null, additionalDirectories: [] });
    expect(repo.resolveSessionDirectories(task).additionalDirectories).toEqual(["/extra"]);
    const foreign = port.repository(db, "remote:server:other").saveProject({ roots: ["/old"] });
    expect(() =>
      repo.reserveCreatedTask({
        task: { ...task, taskId: "cross" },
        projectId: foreign.id,
        additionalDirectories: [],
      }),
    ).toThrow("project.cross-host-move");
  });
});
