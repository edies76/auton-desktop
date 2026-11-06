import test from "node:test";
import assert from "node:assert/strict";
import { AutonEditingEngine, EditingEngineError } from "../src/index.mjs";

const ROOT = "/work/project";

class MemoryFileSystem {
  constructor(initial = {}) {
    this.nextRevision = 1;
    this.files = new Map();
    for (const [name, content] of Object.entries(initial)) this.put(`${ROOT}/${name}`, content);
  }

  put(path, content, rawBytes = Buffer.from(content)) {
    this.files.set(path, { content, rawBytes: Buffer.from(rawBytes), revision: this.nextRevision++, encoding: "utf8", lineEndings: rawBytes.includes(13) ? "CRLF" : "LF" });
  }

  async stat({ path }) {
    const file = this.files.get(path);
    if (!file) throw fsError("not_found", path);
    return { path, kind: "file", sizeBytes: file.rawBytes.byteLength, mtimeMs: file.revision, revision: revision(file) };
  }

  async readTextFile({ path }) {
    const file = this.files.get(path);
    if (!file) throw fsError("not_found", path);
    return { path, content: file.content, encoding: file.encoding, lineEndings: file.lineEndings, revision: revision(file) };
  }

  async readBinaryFile({ path }) {
    const file = this.files.get(path);
    if (!file) throw fsError("not_found", path);
    return { path, content: Uint8Array.from(file.rawBytes), bytesRead: file.rawBytes.byteLength, sizeBytes: file.rawBytes.byteLength, revision: revision(file) };
  }

  async readTextFileRange({ path, offsetLine = 0, limitLines, maxBytes }) {
    const file = this.files.get(path);
    if (!file) throw fsError("not_found", path);
    const all = file.content.replace(/\r\n?/g, "\n").split("\n");
    if (all.at(-1) === "") all.pop();
    let selected = all.slice(offsetLine, limitLines === undefined ? undefined : offsetLine + limitLines);
    let content = selected.join("\n");
    let truncated = limitLines !== undefined && offsetLine + limitLines < all.length;
    if (maxBytes !== undefined && Buffer.byteLength(content) > maxBytes) {
      content = Buffer.from(content).subarray(0, maxBytes).toString("utf8");
      selected = content.split("\n");
      truncated = true;
    }
    return {
      path,
      content,
      startLine: offsetLine + 1,
      lineCount: selected.length,
      totalLines: all.length,
      sizeBytes: Buffer.byteLength(file.content),
      bytesRead: Buffer.byteLength(content),
      truncated,
      revision: revision(file),
    };
  }

  async writeTextFile({ path, content, expectedRevision, lineEndings }) {
    const current = this.files.get(path);
    if (expectedRevision && (!current || expectedRevision.id !== revision(current).id)) throw fsError("stale_write", path);
    const serialized = lineEndings === "CRLF" ? content.replace(/\r?\n/g, "\r\n") : content;
    this.put(path, content, Buffer.from(serialized));
    return { path, bytesWritten: Buffer.byteLength(content), revision: revision(this.files.get(path)) };
  }

  async removeFile({ path }) {
    if (!this.files.delete(path)) throw fsError("not_found", path);
    return { path, removed: true };
  }
}

class MissingReportingFileSystem extends MemoryFileSystem {
  async stat({ path }) {
    if (!this.files.has(path)) return { path, kind: "missing", sizeBytes: 0 };
    return super.stat({ path });
  }
}

function revision(file) {
  return { id: String(file.revision), mtimeMs: file.revision, sizeBytes: file.rawBytes.byteLength };
}
function fsError(code, path) {
  return Object.assign(new Error(`${code}: ${path}`), { code, path });
}
function makeEngine(fileSystem, options = {}) {
  return new AutonEditingEngine({ fileSystem, workspaceRoot: ROOT, workingDirectory: ROOT, ...options });
}

test("Read then Edit uses revision-checked writes and reports a diff", async () => {
  const fileSystem = new MemoryFileSystem({ "src/a.ts": "const value = 1;\n" });
  const changes = [];
  const engine = makeEngine(fileSystem, { onFileChange: (change) => changes.push(change) });
  const read = await engine.read({ file_path: "src/a.ts" });
  assert.equal(read.type, "text");
  assert.match(engine.formatRead(read), /1\tconst value = 1;/);

  const result = await engine.edit({ file_path: "src/a.ts", old_string: "1", new_string: "2" });
  assert.equal(result.matchStrategy, "exact");
  assert.equal((await fileSystem.readTextFile({ path: `${ROOT}/src/a.ts` })).content, "const value = 2;\n");
  assert.equal(changes.length, 1);
  assert.equal(changes[0].type, "update");
  assert.equal(Buffer.from(changes[0].beforeBase64, "base64").toString("utf8"), "const value = 1;\n");
  assert.equal(Buffer.from(changes[0].afterBase64, "base64").toString("utf8"), "const value = 2;\n");
});

test("Write journal snapshots preserve exact CRLF bytes", async () => {
  const fileSystem = new MemoryFileSystem();
  fileSystem.put(`${ROOT}/a.txt`, "before\n", Buffer.from("before\r\n", "utf8"));
  const changes = [];
  const engine = makeEngine(fileSystem, { onFileChange: (change) => changes.push(change) });
  await engine.read({ file_path: "a.txt" });
  await engine.write({ file_path: "a.txt", content: "after\n" });
  assert.equal(changes[0].lineEndings, "CRLF");
  assert.equal(Buffer.from(changes[0].beforeBase64, "base64").toString("utf8"), "before\r\n");
  assert.equal(Buffer.from(changes[0].afterBase64, "base64").toString("utf8"), "after\r\n");
});

test("Write requires a full read and rejects stale content", async () => {
  const fileSystem = new MemoryFileSystem({ "a.txt": "before\n" });
  const engine = makeEngine(fileSystem);
  await assert.rejects(engine.write({ file_path: "a.txt", content: "after\n" }), (error) => error.code === "file_not_read");

  await engine.read({ file_path: "a.txt" });
  fileSystem.put(`${ROOT}/a.txt`, "changed outside the session\n");
  await assert.rejects(engine.write({ file_path: "a.txt", content: "after\n" }), (error) => error.code === "stale_file");
});

test("Write and patch creation support stat ports that return kind=missing", async () => {
  const fileSystem = new MissingReportingFileSystem();
  const engine = makeEngine(fileSystem);
  const write = await engine.write({ file_path: "new.txt", content: "created\n" });
  assert.equal(write.type, "create");
  const patch = ["*** Begin Patch", "*** Add File: added.txt", "+also created", "*** End Patch"].join("\n");
  const result = await engine.applyPatch({ patch_text: patch });
  assert.equal(result.files[0].type, "add");
  assert.equal((await fileSystem.readTextFile({ path: `${ROOT}/added.txt` })).content, "also created\n");
});

test("journal failure is surfaced after the file write commits", async () => {
  const fileSystem = new MemoryFileSystem();
  const engine = makeEngine(fileSystem, { onFileChange: () => { throw new Error("journal disk is full"); } });
  const result = await engine.write({ file_path: "a.txt", content: "written\n" });
  assert.equal(result.type, "create");
  assert.equal(result.journalWarning, "journal disk is full");
  assert.equal((await fileSystem.readTextFile({ path: `${ROOT}/a.txt` })).content, "written\n");
});

test("Edit refuses ambiguous replacements and replace_all handles every match", async () => {
  const fileSystem = new MemoryFileSystem({ "a.txt": "x x x\n" });
  const engine = makeEngine(fileSystem);
  await engine.read({ file_path: "a.txt" });
  await assert.rejects(engine.edit({ file_path: "a.txt", old_string: "x", new_string: "y" }), (error) => error.code === "edit_ambiguous_replace");
  const result = await engine.edit({ file_path: "a.txt", old_string: "x", new_string: "y", replace_all: true });
  assert.equal(result.matchCandidateCount, 3);
  assert.equal((await fileSystem.readTextFile({ path: `${ROOT}/a.txt` })).content, "y y y\n");
});

test("Edit accepts the same semantic replace_all values as ZCode", async () => {
  for (const value of ["true", "1", " yes ", "Y", "on", 1]) {
    const fileSystem = new MemoryFileSystem({ "a.txt": "x x\n" });
    const engine = makeEngine(fileSystem);
    await engine.read({ file_path: "a.txt" });
    const result = await engine.edit({ file_path: "a.txt", old_string: "x", new_string: "y", replace_all: value });
    assert.equal(result.replaceAll, true, `expected ${JSON.stringify(value)} to coerce to true`);
    assert.equal((await fileSystem.readTextFile({ path: `${ROOT}/a.txt` })).content, "y y\n");
  }
  const fileSystem = new MemoryFileSystem({ "a.txt": "x x\n" });
  const engine = makeEngine(fileSystem);
  await engine.read({ file_path: "a.txt" });
  await assert.rejects(engine.edit({ file_path: "a.txt", old_string: "x", new_string: "y", replace_all: "sometimes" }), (error) => error.code === "invalid_edit_input");
});

test("Edit keeps ZCode's line-normalized matching and curly quote behavior", async () => {
  const fileSystem = new MemoryFileSystem({ "a.txt": "const title = “old”;  \n" });
  const engine = makeEngine(fileSystem);
  await engine.read({ file_path: "a.txt" });
  const result = await engine.edit({
    file_path: "a.txt",
    old_string: 'const title = "old";',
    new_string: 'const title = "new";',
  });
  assert.equal(result.matchStrategy, "quote_normalized");
  assert.equal((await fileSystem.readTextFile({ path: `${ROOT}/a.txt` })).content, "const title = “new”;  \n");
});

test("token-capped reads cannot authorize a full-file write", async () => {
  const fileSystem = new MemoryFileSystem({ "a.txt": "one two three four five six\n" });
  const engine = makeEngine(fileSystem, { maxReadTokens: 2 });
  const result = await engine.read({ file_path: "a.txt" });
  assert.equal(result.truncated, true);
  await assert.rejects(engine.write({ file_path: "a.txt", content: "replacement\n" }), (error) => error.code === "file_not_read");
});

test("ApplyPatch verifies every target before changing any file", async () => {
  const fileSystem = new MemoryFileSystem({ "a.txt": "one\n" });
  const engine = makeEngine(fileSystem);
  const patch = [
    "*** Begin Patch",
    "*** Update File: a.txt",
    "@@",
    "-one",
    "+two",
    "*** Delete File: missing.txt",
    "*** End Patch",
  ].join("\n");

  await assert.rejects(engine.applyPatch({ patch_text: patch }), (error) => error.code === "apply_patch_file_not_exist");
  assert.equal((await fileSystem.readTextFile({ path: `${ROOT}/a.txt` })).content, "one\n");
});

test("ApplyPatch applies a verified add and update", async () => {
  const fileSystem = new MemoryFileSystem({ "a.txt": "one\n" });
  const engine = makeEngine(fileSystem);
  const patch = [
    "*** Begin Patch",
    "*** Update File: a.txt",
    "@@",
    "-one",
    "+two",
    "*** Add File: b.txt",
    "+created",
    "*** End Patch",
  ].join("\n");
  const result = await engine.applyPatch({ patch_text: patch });
  assert.equal(result.files.length, 2);
  assert.equal((await fileSystem.readTextFile({ path: `${ROOT}/a.txt` })).content, "two\n");
  assert.equal((await fileSystem.readTextFile({ path: `${ROOT}/b.txt` })).content, "created\n");
});

test("workspace traversal is rejected by default", async () => {
  const engine = makeEngine(new MemoryFileSystem());
  await assert.rejects(engine.read({ file_path: "../outside.txt" }), (error) => error instanceof EditingEngineError && error.code === "path_outside_workspace");
});
