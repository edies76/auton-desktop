import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createNodeFileSystemAdapter } from "../src/fs/index.js";
import { writeHandler } from "../../core/src/tool/handlers/write.js";
import { autonRevertHandler } from "../../core/src/auton/revert-handler.js";
import { readChanges } from "../../core/src/auton/journal.js";
import { createChildSessionId } from "../../core/src/subagent/runner.js";
import type { ToolExecutionContext } from "../../core/src/tool/types.js";

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-bytes-"));
  workspaces.push(dir);
  return dir;
}

async function context(workspaceRoot: string, filePath: string, sessionId: string) {
  const adapter = createNodeFileSystemAdapter();
  const info = await adapter.stat({ path: filePath });
  const read = await adapter.readTextFile({ path: filePath });
  const readFileState = new Map([
    [
      [filePath, "1", ""].join("\0"),
      {
        path: filePath,
        content: read.content,
        offset: undefined,
        limit: undefined,
        isPartialView: false,
        readAt: new Date(),
        revisionId: info.revision.id,
        mtimeMs: info.mtimeMs,
        sizeBytes: info.sizeBytes,
      },
    ],
  ]) as unknown as ToolExecutionContext["readFileState"];

  return {
    adapter,
    context: {
      toolCallId: "tool_bytes",
      traceId: "trace_bytes",
      spanId: "span_bytes",
      abortSignal: new AbortController().signal,
      fileSystemPort: adapter,
      readFileState,
      workingDirectory: workspaceRoot,
      workspaceRoot,
      sessionId: sessionId as never,
      turnId: "turn_bytes" as never,
    } as unknown as ToolExecutionContext,
  };
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("journal and revert with the real filesystem adapter", () => {
  it("restores a CRLF file byte for byte when the write itself carries CRLF", async () => {
    const root = await workspace();
    const file = join(root, "windows.txt");
    const original = Buffer.from("linea uno\r\nlinea dos\r\n", "utf8");
    await writeFile(file, original);

    const sessionId = createChildSessionId("auton-worker", "prog-crlf");
    const { adapter, context: ctx } = await context(root, file, sessionId);

    // El contenido del programador también trae CRLF: el diario debe comparar
    // contra los bytes reales, no contra texto normalizado.
    await writeHandler(
      { file_path: file, content: "linea uno\r\nlinea dos cambiada\r\n" },
      ctx,
    );

    const journal = readChanges(root);
    expect(journal).toHaveLength(1);
    expect(journal[0]?.beforeBase64).toBe(original.toString("base64"));

    const reverted = (await autonRevertHandler({ agentId: "prog-crlf" }, ctx)) as {
      result: string;
    };

    expect(reverted.result).toBe("reverted");
    const after = await readFile(file);
    expect(Buffer.compare(after, original)).toBe(0);
    expect(adapter).toBeDefined();
  });

  it("restores a file with mixed LF and CRLF endings byte for byte", async () => {
    const root = await workspace();
    const file = join(root, "mixto.txt");
    const original = Buffer.from("uno\r\ndos\ntres\r\n", "utf8");
    await writeFile(file, original);

    const sessionId = createChildSessionId("auton-worker", "prog-mixed");
    const { context: ctx } = await context(root, file, sessionId);
    await writeHandler({ file_path: file, content: "uno\ndos\ntres cambiado\n" }, ctx);

    await autonRevertHandler({ agentId: "prog-mixed" }, ctx);

    expect(Buffer.compare(await readFile(file), original)).toBe(0);
  });

  it("restores a file whose bytes are not valid UTF-8", async () => {
    const root = await workspace();
    const file = join(root, "binario.txt");
    const original = Buffer.from([0xff, 0xfe, 0x41, 0x0a]);
    await writeFile(file, original);

    const sessionId = createChildSessionId("auton-worker", "prog-bin");
    const { context: ctx } = await context(root, file, sessionId);

    await writeHandler({ file_path: file, content: "texto plano\n" }, ctx);
    expect(readChanges(root)).toHaveLength(1);

    const reverted = (await autonRevertHandler({ paths: ["binario.txt"] }, ctx)) as {
      result: string;
    };

    expect(reverted.result).toBe("reverted");
    expect(Buffer.compare(await readFile(file), original)).toBe(0);
  });

  it("reverts an LF change twice without altering bytes", async () => {
    const root = await workspace();
    const file = join(root, "lf.txt");
    const original = Buffer.from("uno\ndos\n", "utf8");
    await writeFile(file, original);

    const sessionId = createChildSessionId("auton-worker", "prog-lf");
    const { context: ctx } = await context(root, file, sessionId);
    await writeHandler({ file_path: file, content: "uno\ndos cambiado\n" }, ctx);

    await autonRevertHandler({ agentId: "prog-lf" }, ctx);
    expect(Buffer.compare(await readFile(file), original)).toBe(0);

    const second = (await autonRevertHandler({ agentId: "prog-lf" }, ctx)) as { result: string };
    expect(second.result).toBe("already");
    expect(Buffer.compare(await readFile(file), original)).toBe(0);
    expect((await stat(file)).size).toBe(original.byteLength);
  });
});
