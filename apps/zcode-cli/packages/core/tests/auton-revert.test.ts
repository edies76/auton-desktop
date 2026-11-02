import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { autonRevertHandler } from "../src/auton/revert-handler.js";
import { readRevertAudit, recordFileChange } from "../src/auton/journal.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-revert-"));
  workspaces.push(dir);
  return dir;
}

function context(workspaceRoot: string): ToolExecutionContext {
  return { workingDirectory: workspaceRoot, workspaceRoot } as unknown as ToolExecutionContext;
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** Simula lo que hace un programador: escribe el archivo y lo registra en el diario. */
async function programmerWrites(
  workspaceRoot: string,
  sessionId: string,
  path: string,
  before: string | null,
  after: string,
): Promise<void> {
  await mkdir(dirname(join(workspaceRoot, path)), { recursive: true });
  await writeFile(join(workspaceRoot, path), after, "utf8");
  recordFileChange({ workspaceRoot, sessionId, path: join(workspaceRoot, path), before, after });
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("AutonRevert", () => {
  it("reverts every change of one programmer byte for byte and touches nothing else", async () => {
    const root = await workspace();
    await writeFile(join(root, "index.html"), "<h1>antes</h1>\n", "utf8");
    await writeFile(join(root, "styles.css"), "body{color:red}\n", "utf8");
    await writeFile(join(root, "otro.txt"), "no tocar\n", "utf8");

    await programmerWrites(root, "auton_prog1", "index.html", "<h1>antes</h1>\n", "<h1>después</h1>\n");
    await programmerWrites(root, "auton_prog1", "styles.css", "body{color:red}\n", "body{color:blue}\n");

    const output = (await autonRevertHandler({ agentId: "prog1" }, context(root))) as {
      result: string;
      files: { path: string; outcome: string }[];
    };

    expect(output.result).toBe("reverted");
    expect(output.files).toHaveLength(2);
    expect(await readFile(join(root, "index.html"), "utf8")).toBe("<h1>antes</h1>\n");
    expect(await readFile(join(root, "styles.css"), "utf8")).toBe("body{color:red}\n");
    expect(await readFile(join(root, "otro.txt"), "utf8")).toBe("no tocar\n");
  });

  it("reverts a named subset and keeps the rest of the programmer's work", async () => {
    const root = await workspace();
    await writeFile(join(root, "a.txt"), "a0", "utf8");
    await writeFile(join(root, "b.txt"), "b0", "utf8");

    await programmerWrites(root, "auton_prog2", "a.txt", "a0", "a1");
    await programmerWrites(root, "auton_prog2", "b.txt", "b0", "b1");

    const output = (await autonRevertHandler(
      { paths: ["a.txt"] },
      context(root),
    )) as { result: string };

    expect(output.result).toBe("reverted");
    expect(await readFile(join(root, "a.txt"), "utf8")).toBe("a0");
    expect(await readFile(join(root, "b.txt"), "utf8")).toBe("b1");
  });

  it("in a git repo it only touches the programmer's paths and keeps unrelated changes", async () => {
    const root = await workspace();
    await writeFile(join(root, "index.html"), "v0", "utf8");
    await writeFile(join(root, "otro.txt"), "base", "utf8");
    git(root, ["init", "-q"]);
    git(root, ["config", "user.email", "test@example.com"]);
    git(root, ["config", "user.name", "test"]);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-qm", "base"]);

    // Cambio ajeno sin commitear, que la reversión no puede descartar.
    await writeFile(join(root, "otro.txt"), "cambio ajeno", "utf8");
    // Cambio del programador.
    await programmerWrites(root, "auton_prog3", "index.html", "v0", "v1");

    await autonRevertHandler({ agentId: "prog3" }, context(root));

    expect(await readFile(join(root, "index.html"), "utf8")).toBe("v0");
    expect(await readFile(join(root, "otro.txt"), "utf8")).toBe("cambio ajeno");
    const status = git(root, ["status", "--porcelain"]);
    expect(status).toContain("otro.txt");
    expect(status).not.toContain("index.html");
  });

  it("is idempotent: the second revert changes nothing and records the attempt", async () => {
    const root = await workspace();
    await writeFile(join(root, "x.txt"), "x0", "utf8");
    await programmerWrites(root, "auton_prog4", "x.txt", "x0", "x1");

    const first = (await autonRevertHandler({ agentId: "prog4" }, context(root))) as {
      result: string;
    };
    const second = (await autonRevertHandler({ agentId: "prog4" }, context(root))) as {
      result: string;
      files: { outcome: string }[];
    };

    expect(first.result).toBe("reverted");
    expect(second.result).toBe("already");
    expect(second.files[0]?.outcome).toBe("already");
    expect(await readFile(join(root, "x.txt"), "utf8")).toBe("x0");

    const audit = readRevertAudit(root);
    expect(audit).toHaveLength(2);
    expect(audit[1]?.files[0]?.outcome).toBe("already");
  });

  it("refuses to overwrite a file that changed after the programmer's edit", async () => {
    const root = await workspace();
    await writeFile(join(root, "y.txt"), "y0", "utf8");
    await programmerWrites(root, "auton_prog5", "y.txt", "y0", "y1");
    await writeFile(join(root, "y.txt"), "y2 de otra persona", "utf8");

    const output = (await autonRevertHandler({ agentId: "prog5" }, context(root))) as {
      result: string;
      files: { outcome: string; reason?: string }[];
    };

    expect(output.result).toBe("blocked");
    expect(output.files[0]?.outcome).toBe("conflict");
    expect(await readFile(join(root, "y.txt"), "utf8")).toBe("y2 de otra persona");
  });

  it("deletes files the programmer created from nothing", async () => {
    const root = await workspace();
    await programmerWrites(root, "auton_prog6", "nuevo.txt", null, "contenido");

    await autonRevertHandler({ agentId: "prog6" }, context(root));

    await expect(readFile(join(root, "nuevo.txt"), "utf8")).rejects.toThrow();
  });
});
