import { EditingEngineError, isNotFound } from "./errors.mjs";
import { findEditMatch, normalizeLineEndings, normalizeReplacementForMatch, preserveQuoteStyle } from "./edit-matchers.ts";
import { pathKey, resolveWorkspacePath } from "./path.mjs";
import { applyChunks, createStructuredPatch, parseStructuredPatch } from "./patch.mjs";

export const READ_MAX_FILE_SIZE_BYTES = 256 * 1024;
export const READ_MAX_OUTPUT_TOKENS = 25_000;
export const READ_DEFAULT_MAX_LINES = 2_000;
export const MAX_EDIT_FILE_SIZE_BYTES = 1024 * 1024 * 1024;

const NO_FILE_READ = "File has not been read yet. Read it first before writing to it.";
const STALE_FILE = "File has been modified since read. Read it again before attempting to write to it.";

/**
 * @param {object} options
 * @param {object} options.fileSystem FileSystemPort implementation.
 * @param {string} options.workspaceRoot Absolute workspace root.
 * @param {string} [options.workingDirectory] Absolute current working directory.
 * @param {boolean} [options.allowOutsideWorkspace] Opt into sibling/external paths.
 * @param {number} [options.maxReadBytes]
 * @param {number} [options.maxReadTokens]
 * @param {(change: object) => Promise<void>|void} [options.onFileChange] Non-critical Auton journal hook.
 * @param {object} options.fileSystem Optional readBinaryFile() enables exact byte snapshots for Auton's revert journal.
 * @param {object} [options.trace] Optional trace copied into filesystem requests.
 */
export class AutonEditingEngine {
  constructor(options) {
    if (!options?.fileSystem) throw new EditingEngineError("invalid_context", "A FileSystemPort is required");
    for (const method of ["stat", "readTextFile", "readTextFileRange", "writeTextFile", "removeFile"]) {
      if (typeof options.fileSystem[method] !== "function") {
        throw new EditingEngineError("invalid_context", `FileSystemPort is missing ${method}()`);
      }
    }
    if (!options.workspaceRoot || !options.workingDirectory && !options.workspaceRoot) {
      throw new EditingEngineError("invalid_context", "An absolute workspaceRoot is required");
    }
    this.fileSystem = options.fileSystem;
    this.workspaceRoot = options.workspaceRoot;
    this.workingDirectory = options.workingDirectory ?? options.workspaceRoot;
    this.allowOutsideWorkspace = options.allowOutsideWorkspace ?? false;
    this.maxReadBytes = options.maxReadBytes ?? READ_MAX_FILE_SIZE_BYTES;
    this.maxReadTokens = options.maxReadTokens ?? READ_MAX_OUTPUT_TOKENS;
    this.onFileChange = options.onFileChange;
    this.trace = options.trace;
    this.readStates = new Map();
  }

  async read(input, { signal } = {}) {
    const { file_path: inputPath, offset, limit } = validateReadInput(input);
    const filePath = this.resolvePath(inputPath, "read");
    const stat = await this.fileSystem.stat({ path: filePath, trace: this.trace }, { signal });
    if (stat.kind !== "file") throw new EditingEngineError("not_file", `Cannot read a ${stat.kind ?? "non-file"}: ${filePath}`, { path: filePath });

    const normalizedOffset = offset === undefined || offset <= 1 ? 0 : offset - 1;
    const range = await this.fileSystem.readTextFileRange({
      path: filePath,
      offsetLine: normalizedOffset,
      limitLines: limit,
      maxBytes: limit === undefined ? this.maxReadBytes : undefined,
      trace: this.trace,
    }, { signal });
    const maybePartial = capTextOutput(range, filePath, this.maxReadTokens);
    const state = {
      path: filePath,
      content: range.content,
      offset: offset ?? 1,
      limit,
      partial: (offset !== undefined && offset > 1) || limit !== undefined || range.truncated === true || maybePartial.truncated === true,
      revision: range.revision ?? stat.revision,
      mtimeMs: range.revision?.mtimeMs ?? stat.mtimeMs,
      sizeBytes: range.sizeBytes ?? stat.sizeBytes,
      readAt: Date.now(),
    };
    this.readStates.set(pathKey(filePath), state);

    return {
      type: "text",
      filePath,
      content: maybePartial.content,
      numLines: maybePartial.numLines,
      startLine: range.startLine,
      totalLines: range.totalLines,
      sizeBytes: range.sizeBytes,
      bytesRead: range.bytesRead,
      truncated: maybePartial.truncated,
      ...(maybePartial.partialViewNotice ? { partialViewNotice: maybePartial.partialViewNotice } : {}),
    };
  }

  formatRead(output) {
    if (output.type === "file_unchanged") {
      return "Wasted call — file unchanged since your last Read. Refer to that earlier tool_result instead.";
    }
    const warning = output.partialViewNotice
      ? `<system-reminder>${output.partialViewNotice}</system-reminder>\n\n`
      : "";
    if (!output.content) return `${warning}<system-reminder>Warning: the file exists but the contents are empty.</system-reminder>`;
    const start = output.startLine ?? 1;
    const numbered = output.content.split(/\r?\n/).map((line, index) => `${start + index}\t${line}`).join("\n");
    return `${warning}${numbered}`;
  }

  async write(input, { signal } = {}) {
    const { file_path: inputPath, content } = validateWriteInput(input);
    const filePath = this.resolvePath(inputPath, "write");
    let original;
    let stat;
    try {
      stat = await this.fileSystem.stat({ path: filePath, trace: this.trace }, { signal });
      if (stat.kind === "file") {
        original = await this.fileSystem.readTextFile({ path: filePath, trace: this.trace }, { signal });
      } else if (stat.kind !== "missing") {
        throw new EditingEngineError("not_file", `Write target is not a file: ${filePath}`, { path: filePath });
      }
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }

    if (original) this.assertFreshFullRead(filePath, original);
    const before = original?.content ?? null;
    const beforeBase64 = original ? await this.captureRawBytes(filePath, original.revision ?? stat?.revision, signal) : null;
    const write = await this.fileSystem.writeTextFile({
      path: filePath,
      content,
      encoding: original?.encoding,
      lineEndings: original?.lineEndings,
      createParents: true,
      atomic: true,
      expectedRevision: original?.revision ?? stat?.revision,
      trace: this.trace,
    }, { signal });
    const afterBase64 = await this.captureRawBytes(filePath, write.revision, signal);
    this.rememberFullRead(filePath, content, write.revision);
    const journalWarning = await this.notifyChange({
      type: before === null ? "add" : "update",
      path: filePath,
      before,
      after: content,
      ...(beforeBase64 !== undefined ? { beforeBase64 } : {}),
      ...(afterBase64 !== undefined ? { afterBase64 } : {}),
      encoding: original?.encoding,
      lineEndings: original?.lineEndings,
      revision: write.revision,
    });
    const diff = createStructuredPatch(filePath, before ?? "", content);
    return {
      type: before === null ? "create" : "update",
      filePath: inputPath,
      content,
      structuredPatch: diff.hunks,
      originalFile: before,
      userModified: false,
      ...(journalWarning ? { journalWarning } : {}),
    };
  }

  async edit(input, { signal } = {}) {
    const { file_path: inputPath, old_string: oldString, new_string: newString, replace_all: replaceAll } = validateEditInput(input);
    const filePath = this.resolvePath(inputPath, "write");
    if (oldString === newString) throw new EditingEngineError("edit_no_change", "No changes to make: old_string and new_string are exactly the same.", { path: filePath });
    if (filePath.toLowerCase().endsWith(".ipynb")) throw new EditingEngineError("notebook_file", "Use a notebook-aware editor for Jupyter notebooks.", { path: filePath });

    let stat;
    try {
      stat = await this.fileSystem.stat({ path: filePath, trace: this.trace }, { signal });
      if (stat.kind === "missing") stat = undefined;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    if (!stat) {
      if (oldString !== "") throw new EditingEngineError("edit_file_not_found", `File does not exist: ${filePath}`, { path: filePath });
      const write = await this.fileSystem.writeTextFile({ path: filePath, content: newString, createParents: true, atomic: true, trace: this.trace }, { signal });
      const afterBase64 = await this.captureRawBytes(filePath, write.revision, signal);
      this.rememberFullRead(filePath, newString, write.revision);
      const journalWarning = await this.notifyChange({ type: "add", path: filePath, before: null, after: newString, beforeBase64: null, ...(afterBase64 !== undefined ? { afterBase64 } : {}), revision: write.revision });
      return { filePath: inputPath, oldString: "", newString, originalFile: "", structuredPatch: createStructuredPatch(filePath, "", newString).hunks, userModified: false, replaceAll, ...(journalWarning ? { journalWarning } : {}) };
    }
    if (stat.kind !== "file") throw new EditingEngineError("not_file", `Edit target is not a file: ${filePath}`, { path: filePath });
    if (stat.sizeBytes > MAX_EDIT_FILE_SIZE_BYTES) throw new EditingEngineError("file_too_large", "File is too large to edit (1GB).", { path: filePath });
    const current = await this.fileSystem.readTextFile({ path: filePath, trace: this.trace }, { signal });
    this.assertFreshFullRead(filePath, current);
    const currentRevision = current.revision ?? stat.revision;
    const beforeBase64 = await this.captureRawBytes(filePath, currentRevision, signal);
    const content = normalizeLineEndings(current.content);
    const search = normalizeLineEndings(oldString);
    const replacement = normalizeLineEndings(newString);
    let count = countOccurrences(content, search);
    let newContent;
    let actualOldString = search;
    let actualNewString = replacement;
    let matchStrategy = "exact";
    if (search === "") {
      if (content.trim() !== "") throw new EditingEngineError("edit_file_exists_no_old_string", "Cannot create new file - file already exists.", { path: filePath });
      count = 1;
      newContent = replacement;
    } else {
      const match = findEditMatch({ content, search, replaceAll });
      if (match.status === "not_found") throw new EditingEngineError("edit_old_string_not_found", `String to replace not found in file:\n${oldString}`, { path: filePath });
      if (match.status === "ambiguous") throw new EditingEngineError("edit_ambiguous_replace", "old_string is not unique in the file. Add more surrounding context or set replace_all to true.", { path: filePath });
      actualOldString = match.actualString;
      count = countOccurrences(content, actualOldString);
      if (!replaceAll && count > 1) throw new EditingEngineError("edit_ambiguous_replace", "old_string is not unique in the file. Add more surrounding context or set replace_all to true.", { path: filePath });
      actualNewString = preserveQuoteStyle(search, actualOldString, normalizeReplacementForMatch(match.strategy, replacement));
      newContent = replaceAll ? content.split(actualOldString).join(actualNewString) : content.replace(actualOldString, actualNewString);
      matchStrategy = match.strategy;
    }
    const write = await this.fileSystem.writeTextFile({
      path: filePath,
      content: newContent,
      encoding: current.encoding,
      lineEndings: current.lineEndings,
      createParents: false,
      atomic: true,
      expectedRevision: currentRevision,
      trace: this.trace,
    }, { signal });
    const afterBase64 = await this.captureRawBytes(filePath, write.revision, signal);
    this.rememberFullRead(filePath, newContent, write.revision);
    const journalWarning = await this.notifyChange({
      type: "update",
      path: filePath,
      before: current.content,
      after: newContent,
      ...(beforeBase64 !== undefined ? { beforeBase64 } : {}),
      ...(afterBase64 !== undefined ? { afterBase64 } : {}),
      encoding: current.encoding,
      lineEndings: current.lineEndings,
      revision: write.revision,
    });
    return {
      filePath: inputPath,
      oldString: actualOldString,
      newString: actualNewString,
      originalFile: current.content,
      structuredPatch: createStructuredPatch(filePath, current.content, newContent).hunks,
      userModified: false,
      replaceAll,
      matchStrategy,
      matchCandidateCount: count,
      ...(journalWarning ? { journalWarning } : {}),
    };
  }

  async applyPatch(input, { signal } = {}) {
    const patchText = typeof input === "string" ? input : input?.patch_text;
    if (typeof patchText !== "string") throw new EditingEngineError("apply_patch_invalid_patch", "patch_text must be a string");
    const sections = parseStructuredPatch(patchText);
    if (sections.length === 0) throw new EditingEngineError("apply_patch_empty_patch", "Patch contains no file changes");

    const verified = [];
    const touched = new Set();
    for (const section of sections) {
      const filePath = this.resolvePath(section.path, "write");
      const key = pathKey(filePath);
      if (touched.has(key)) throw new EditingEngineError("apply_patch_duplicate_path", `Patch addresses the same path more than once: ${filePath}`, { path: filePath });
      touched.add(key);
      if (section.type === "add") {
        await this.assertMissing(filePath, signal);
        verified.push({ ...section, filePath, oldContent: "", newContent: section.contents });
        continue;
      }
      const current = await this.readExisting(filePath, signal);
      let movePath;
      let newContent = "";
      if (section.type === "update") {
        newContent = applyChunks(current.content, section.chunks, filePath);
        if (section.movePath) {
          movePath = this.resolvePath(section.movePath, "write");
          const moveKey = pathKey(movePath);
          if (touched.has(moveKey)) throw new EditingEngineError("apply_patch_duplicate_path", `Patch addresses the same path more than once: ${movePath}`, { path: movePath });
          touched.add(moveKey);
          await this.assertMissing(movePath, signal);
        }
      }
      const beforeBase64 = await this.captureRawBytes(filePath, current.revision, signal);
      verified.push({ ...section, filePath, movePath, current, beforeBase64, oldContent: current.content, newContent });
    }

    const files = [];
    for (const change of verified) {
      if (change.type === "delete") {
        // FileSystemPort has no revision-checked remove operation; the host must serialize deletes with edits.
        await this.fileSystem.removeFile({ path: change.filePath, trace: this.trace }, { signal });
        const journalWarning = await this.notifyChange({ type: "delete", path: change.filePath, before: change.oldContent, after: null, ...(change.beforeBase64 !== undefined ? { beforeBase64: change.beforeBase64 } : {}), afterBase64: null, encoding: change.current.encoding, lineEndings: change.current.lineEndings, revision: change.current.revision });
        const diff = createStructuredPatch(change.filePath, change.oldContent, "");
        files.push({ filePath: change.filePath, type: "delete", structuredPatch: diff.hunks, additions: 0, deletions: diff.deletions, ...(journalWarning ? { journalWarning } : {}) });
        continue;
      }
      const target = change.movePath ?? change.filePath;
      const write = await this.fileSystem.writeTextFile({
        path: target,
        content: change.newContent,
        encoding: change.current?.encoding,
        lineEndings: change.current?.lineEndings,
        createParents: true,
        atomic: true,
        expectedRevision: change.type === "update" ? change.current.revision : undefined,
        trace: this.trace,
      }, { signal });
      if (change.movePath) await this.fileSystem.removeFile({ path: change.filePath, trace: this.trace }, { signal });
      const afterBase64 = await this.captureRawBytes(target, write.revision, signal);
      this.rememberFullRead(target, change.newContent, write.revision);
      const journalWarning = await this.notifyChange({
        type: change.type === "add" ? "add" : change.movePath ? "move" : "update",
        path: target,
        before: change.type === "add" ? null : change.oldContent,
        after: change.newContent,
        ...(change.type === "add" ? { beforeBase64: null } : change.beforeBase64 !== undefined ? { beforeBase64: change.beforeBase64 } : {}),
        ...(afterBase64 !== undefined ? { afterBase64 } : {}),
        encoding: change.current?.encoding,
        lineEndings: change.current?.lineEndings,
        revision: write.revision,
        previousPath: change.movePath ? change.filePath : undefined,
      });
      const diff = createStructuredPatch(target, change.oldContent, change.newContent);
      files.push({ filePath: change.filePath, type: change.type === "add" ? "add" : change.movePath ? "move" : "update", ...(change.movePath ? { movePath: target } : {}), structuredPatch: diff.hunks, additions: diff.additions, deletions: diff.deletions, ...(journalWarning ? { journalWarning } : {}) });
    }

    return {
      files,
      structuredPatch: files.flatMap((file) => file.structuredPatch),
      summary: files.map((file) => `${file.type === "add" ? "Added" : file.type === "delete" ? "Deleted" : file.type === "move" ? "Moved" : "Updated"} ${file.filePath}${file.movePath ? ` → ${file.movePath}` : ""}`).join("\n"),
    };
  }

  resolvePath(inputPath, operation) {
    return resolveWorkspacePath(inputPath, {
      workingDirectory: this.workingDirectory,
      workspaceRoot: this.workspaceRoot,
      allowOutsideWorkspace: this.allowOutsideWorkspace,
      operation,
    });
  }

  async readExisting(filePath, signal) {
    try {
      const stat = await this.fileSystem.stat({ path: filePath, trace: this.trace }, { signal });
      if (stat.kind === "missing") throw new EditingEngineError("apply_patch_file_not_exist", `File does not exist: ${filePath}`, { path: filePath });
      if (stat.kind !== "file") throw new EditingEngineError("not_file", `Expected a file: ${filePath}`, { path: filePath });
      return await this.fileSystem.readTextFile({ path: filePath, trace: this.trace }, { signal });
    } catch (error) {
      if (isNotFound(error)) throw new EditingEngineError("apply_patch_file_not_exist", `File does not exist: ${filePath}`, { path: filePath, cause: error });
      throw error;
    }
  }

  async assertMissing(filePath, signal) {
    try {
      const stat = await this.fileSystem.stat({ path: filePath, trace: this.trace }, { signal });
      if (stat.kind === "missing") return;
      throw new EditingEngineError("apply_patch_file_exists", `File already exists: ${filePath}`, { path: filePath });
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  assertFreshFullRead(filePath, current) {
    const state = this.readStates.get(pathKey(filePath));
    if (!state || state.partial) throw new EditingEngineError("file_not_read", NO_FILE_READ, { path: filePath });
    if (!sameRevision(state, current)) throw new EditingEngineError("stale_file", STALE_FILE, { path: filePath });
  }

  rememberFullRead(filePath, content, revision) {
    this.readStates.set(pathKey(filePath), {
      path: filePath,
      content,
      offset: 1,
      limit: undefined,
      partial: false,
      revision,
      mtimeMs: revision?.mtimeMs,
      sizeBytes: revision?.sizeBytes ?? Buffer.byteLength(content, "utf8"),
      readAt: Date.now(),
    });
  }

  async notifyChange(change) {
    try {
      await this.onFileChange?.(change);
      return undefined;
    } catch (error) {
      // The file operation is already committed. Surface the journal failure in
      // the tool result so the host can warn instead of reporting a false revert guarantee.
      return error instanceof Error ? error.message : String(error);
    }
  }

  async captureRawBytes(filePath, expectedRevision, signal) {
    if (typeof this.fileSystem.readBinaryFile !== "function") return undefined;
    try {
      const result = await this.fileSystem.readBinaryFile({ path: filePath, trace: this.trace }, { signal });
      // A snapshot from another revision could make a later revert destructive.
      if (!expectedRevision?.id || !result.revision?.id || expectedRevision.id !== result.revision.id) return undefined;
      return Buffer.from(result.content).toString("base64");
    } catch {
      return undefined;
    }
  }
}

function validateReadInput(input) {
  if (!input || typeof input.file_path !== "string") throw new EditingEngineError("invalid_read_input", "file_path must be a string");
  if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) throw new EditingEngineError("invalid_read_input", "offset must be a nonnegative integer");
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) throw new EditingEngineError("invalid_read_input", "limit must be a positive integer");
  return input;
}
function validateWriteInput(input) {
  if (!input || typeof input.file_path !== "string" || typeof input.content !== "string") throw new EditingEngineError("invalid_write_input", "file_path and content must be strings");
  return input;
}
function validateEditInput(input) {
  if (!input || typeof input.file_path !== "string" || typeof input.old_string !== "string" || typeof input.new_string !== "string") throw new EditingEngineError("invalid_edit_input", "file_path, old_string and new_string must be strings");
  return { ...input, replace_all: parseSemanticBoolean(input.replace_all) };
}
function parseSemanticBoolean(value) {
  if (value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === 0) return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  throw new EditingEngineError("invalid_edit_input", "replace_all must be a boolean or a recognized boolean string/number");
}
function sameRevision(state, current) {
  const stateId = state.revision?.id;
  const currentId = current.revision?.id;
  if (stateId && currentId) return stateId === currentId;
  const stateMtime = state.revision?.mtimeMs ?? state.mtimeMs;
  const currentMtime = current.revision?.mtimeMs;
  if (stateMtime !== undefined && currentMtime !== undefined) {
    return Math.floor(stateMtime) === Math.floor(currentMtime)
      && state.sizeBytes === (current.revision?.sizeBytes ?? current.sizeBytes);
  }
  return state.content === current.content;
}
function countOccurrences(content, search) {
  if (search.length === 0) return 0;
  let count = 0;
  let index = 0;
  while ((index = content.indexOf(search, index)) !== -1) { count += 1; index += search.length; }
  return count;
}
function capTextOutput(read, filePath, tokenLimit) {
  const content = read.content ?? "";
  const tokens = estimateTokens(content);
  if (tokens <= tokenLimit) return { content, numLines: read.lineCount, truncated: read.truncated };
  const lines = content.split(/\r?\n/);
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateTokens(lines.slice(0, mid).join("\n")) <= Math.floor(tokenLimit * 0.85)) low = mid;
    else high = mid - 1;
  }
  let selectedContent;
  let selectedLines;
  if (low === 0) {
    let left = 0;
    let right = content.length;
    const target = Math.floor(tokenLimit * 0.85);
    while (left < right) {
      const mid = Math.ceil((left + right) / 2);
      if (estimateTokens(content.slice(0, mid)) <= target) left = mid;
      else right = mid - 1;
    }
    selectedContent = content.slice(0, Math.max(1, left));
    selectedLines = 1;
  } else {
    const selected = lines.slice(0, low);
    selectedContent = selected.join("\n");
    selectedLines = selected.length;
  }
  const endLine = (read.startLine ?? 1) + selectedLines - 1;
  return {
    content: selectedContent,
    numLines: selectedLines,
    truncated: true,
    partialViewNotice: `The file exceeds the ${tokenLimit} token output budget. Showing lines ${read.startLine ?? 1}-${endLine} of ${read.totalLines}. Continue with Read offset ${endLine + 1} and a limit.`,
  };
}
function estimateTokens(text) {
  const cjk = (text.match(/[一-鿿]/g) ?? []).length;
  return Math.ceil((cjk * 2 + text.length - cjk) / 3.5);
}
