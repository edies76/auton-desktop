import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type FileSystemPort,
  type FileSystemReadTextResult,
  type FileSystemRevision,
} from "@zcode/contracts";
import { writeHandler } from "../src/tool/handlers/write.js";
import { createChildSessionId } from "../src/subagent/runner.js";
import { readChanges, rememberAgentItem } from "../src/auton/journal.js";
import { autonRevertHandler } from "../src/auton/revert-handler.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-e2e-"));
  workspaces.push(dir);
  return dir;
}

function revisionFor(path: string, content: string, mtimeMs: number): FileSystemRevision {
  return {
    id: `${path}:${mtimeMs}:${Buffer.byteLength(content, "utf8")}`,
    mtimeMs,
    sizeBytes: Buffer.byteLength(content, "utf8"),
  } as FileSystemRevision;
}

/** Puerto de filesystem real: el handler escribe en disco y el diario también. */
function realFileSystem(): FileSystemPort {
  const port = {
    async stat(request: { path: string }) {
      const info = await stat(request.path);
      const content = await readFile(request.path, "utf8");
      return {
        kind: "file" as const,
        path: request.path,
        mtimeMs: info.mtimeMs,
        revision: revisionFor(request.path, content, info.mtimeMs),
        sizeBytes: info.size,
      };
    },
    async readTextFile(request: { path: string; encoding?: string }): Promise<FileSystemReadTextResult> {
      const content = await readFile(request.path, "utf8");
      const info = await stat(request.path);
      return {
        bytesRead: Buffer.byteLength(content, "utf8"),
        content,
        encoding: (request.encoding ?? "utf8") as FileSystemReadTextResult["encoding"],
        lineEndings: content.includes("\r\n") ? "CRLF" : "LF",
        path: request.path,
        revision: revisionFor(request.path, content, info.mtimeMs),
        sizeBytes: info.size,
        truncated: false,
      };
    },
    async readBinaryFile(request: { path: string }) {
      const content = await readFile(request.path);
      const info = await stat(request.path);
      return {
        bytesRead: content.byteLength,
        content,
        path: request.path,
        revision: revisionFor(request.path, content.toString("utf8"), info.mtimeMs),
        sizeBytes: info.size,
      };
    },
    async writeTextFile(request: {
      path: string;
      content: string;
    }): Promise<{ bytesWritten: number; path: string; revision: FileSystemRevision }> {
      await writeFile(request.path, request.content, "utf8");
      const info = await stat(request.path);
      return {
        bytesWritten: Buffer.byteLength(request.content, "utf8"),
        path: request.path,
        revision: revisionFor(request.path, request.content, info.mtimeMs),
      };
    },
  };
  return port as unknown as FileSystemPort;
}

async function runWrite(input: unknown, workspaceRoot: string, sessionId: string, filePath: string) {
  const info = await stat(filePath);
  const before = await readFile(filePath, "utf8");
  const revision = revisionFor(filePath, before, info.mtimeMs);
  const readFileState = new Map([
    [
      [filePath, "1", ""].join("\0"),
      {
        path: filePath,
        content: before,
        offset: undefined,
        limit: undefined,
        isPartialView: false,
        readAt: new Date(),
        revisionId: revision.id,
        mtimeMs: revision.mtimeMs,
        sizeBytes: revision.sizeBytes,
      },
    ],
  ]) as unknown as ToolExecutionContext["readFileState"];

  return writeHandler(input, {
    toolCallId: "tool_e2e",
    traceId: "trace_e2e",
    spanId: "span_e2e",
    abortSignal: new AbortController().signal,
    fileSystemPort: realFileSystem(),
    readFileState,
    workingDirectory: workspaceRoot,
    workspaceRoot,
    sessionId: sessionId as never,
    turnId: "turn_e2e" as never,
  } as unknown as ToolExecutionContext);
}

function context(workspaceRoot: string): ToolExecutionContext {
  return { workingDirectory: workspaceRoot, workspaceRoot } as unknown as ToolExecutionContext;
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("journal recording on the real path", () => {
  it("records a Write from the real child session id and reverts byte for byte", async () => {
    const root = await workspace();
    const file = join(root, "index.html");
    await writeFile(file, "<h1>antes</h1>\n", "utf8");

    const childSessionId = createChildSessionId("auton-worker", "prog-e2e");
    expect(childSessionId).toBe("sess_auton_prog-e2e");

    const result = await runWrite(
      { file_path: file, content: "<h1>después</h1>\n" },
      root,
      childSessionId,
      file,
    );
    expect(await readFile(file, "utf8")).toBe("<h1>después</h1>\n");

    const journal = readChanges(root);
    expect(journal).toHaveLength(1);
    expect(journal[0]?.agentId).toBe("prog-e2e");
    expect(journal[0]?.path).toBe("index.html");
    expect(journal[0]?.before).toBe("<h1>antes</h1>\n");
    expect(journal[0]?.after).toBe("<h1>después</h1>\n");

    const reverted = (await autonRevertHandler({ agentId: "prog-e2e" }, context(root))) as {
      result: string;
    };
    expect(reverted.result).toBe("reverted");
    expect(await readFile(file, "utf8")).toBe("<h1>antes</h1>\n");
  });

  it("tags the change with the plan item and reverts by itemId", async () => {
    const root = await workspace();
    const file = join(root, "landing.css");
    await writeFile(file, "body{color:red}\n", "utf8");

    rememberAgentItem(root, "prog-item", "s2");
    const childSessionId = createChildSessionId("auton-worker", "prog-item");

    await runWrite({ file_path: file, content: "body{color:blue}\n" }, root, childSessionId, file);

    const journal = readChanges(root);
    expect(journal[0]?.itemId).toBe("s2");

    const reverted = (await autonRevertHandler({ itemId: "s2" }, context(root))) as {
      result: string;
    };
    expect(reverted.result).toBe("reverted");
    expect(await readFile(file, "utf8")).toBe("body{color:red}\n");
  });
});
