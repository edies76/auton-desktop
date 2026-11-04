import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { ProjectRepositoryContract, VirtualProject } from "#src/project-storage/contract.js";
import { createProjectService } from "#src/project/index.js";

it("refuses to prepare a second session for a project that already has one", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-one-session-"));
  const primary = join(root, "primary");
  await mkdir(primary);
  const project: VirtualProject = {
    id: "one-session",
    hostId: "local",
    name: "Project",
    nameOverridden: true,
    roots: [{ rootPath: primary, position: 0, isPrimary: true }],
    pinned: false,
    deleted: false,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  const service = createProjectService({
    repository: async () =>
      ({
        readTree: () => ({ projects: [project], tasks: [{ projectId: project.id }] }),
      }) as unknown as ProjectRepositoryContract,
    workspaceDirectory: root,
  });
  try {
    await expect(service.prepareSession({ projectId: project.id })).rejects.toThrow(
      "project.session-exists",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
