import { EditingEngineError } from "./errors.mjs";

const BEGIN = "*** Begin Patch";
const END = "*** End Patch";
const ADD = "*** Add File:";
const DELETE = "*** Delete File:";
const UPDATE = "*** Update File:";
const MOVE = "*** Move to:";
const EOF = "*** End of File";

export function parseStructuredPatch(input) {
  const patchText = stripHeredoc(input).replace(/\r\n?/g, "\n");
  const lines = patchText.trim().split("\n");
  const begin = lines.findIndex((line) => line.trim() === BEGIN);
  const end = lines.findIndex((line) => line.trim() === END);
  if (begin < 0 || end < 0 || begin >= end) throw patchError("Invalid patch format: missing Begin/End markers", "apply_patch_invalid_patch");

  const sections = [];
  let index = begin + 1;
  while (index < end) {
    const line = lines[index] ?? "";
    if (line.startsWith(ADD)) {
      const filePath = headerPath(line, ADD);
      const contents = [];
      index += 1;
      while (index < end && !isSection(lines[index] ?? "")) {
        const addLine = lines[index] ?? "";
        if (!addLine.startsWith("+")) throw patchError(`Invalid add file line: ${addLine}`, "apply_patch_invalid_patch", filePath);
        contents.push(addLine.slice(1));
        index += 1;
      }
      sections.push({ type: "add", path: filePath, contents: `${contents.join("\n")}\n` });
      continue;
    }
    if (line.startsWith(DELETE)) {
      sections.push({ type: "delete", path: headerPath(line, DELETE) });
      index += 1;
      continue;
    }
    if (line.startsWith(UPDATE)) {
      const filePath = headerPath(line, UPDATE);
      index += 1;
      let movePath;
      if ((lines[index] ?? "").startsWith(MOVE)) {
        movePath = headerPath(lines[index] ?? "", MOVE);
        index += 1;
      }
      const chunks = [];
      while (index < end && !isSection(lines[index] ?? "")) {
        const header = lines[index] ?? "";
        if (header.trim() === "") { index += 1; continue; }
        if (!header.startsWith("@@")) throw patchError(`Invalid update hunk header: ${header}`, "apply_patch_invalid_patch", filePath);
        const changeContext = header.slice(2).trim() || undefined;
        index += 1;
        const oldLines = [];
        const newLines = [];
        let endOfFile = false;
        while (index < end && !startsNextHunkOrSection(lines[index] ?? "")) {
          const hunkLine = lines[index] ?? "";
          if (hunkLine === EOF) { endOfFile = true; index += 1; break; }
          if (hunkLine.startsWith(" ")) {
            oldLines.push(hunkLine.slice(1));
            newLines.push(hunkLine.slice(1));
          } else if (hunkLine.startsWith("-")) {
            oldLines.push(hunkLine.slice(1));
          } else if (hunkLine.startsWith("+")) {
            newLines.push(hunkLine.slice(1));
          } else {
            throw patchError(`Invalid update hunk line: ${hunkLine}`, "apply_patch_invalid_patch", filePath);
          }
          index += 1;
        }
        chunks.push({ oldLines, newLines, changeContext, endOfFile });
      }
      if (chunks.length === 0) throw patchError(`Update patch has no hunks: ${filePath}`, "apply_patch_invalid_patch", filePath);
      sections.push({ type: "update", path: filePath, movePath, chunks });
      continue;
    }
    if (line.trim() === "") { index += 1; continue; }
    throw patchError(`Invalid patch section header: ${line}`, "apply_patch_invalid_patch");
  }
  return sections;
}

export function applyChunks(content, chunks, filePath) {
  const original = splitLines(content.replace(/\r\n?/g, "\n"));
  const replacements = [];
  let cursor = 0;
  for (const chunk of chunks) {
    if (chunk.changeContext) {
      const contextIndex = seek(original, [chunk.changeContext], cursor);
      if (contextIndex < 0) throw patchError(`Failed to find context '${chunk.changeContext}'`, "apply_patch_hunk_not_found", filePath);
      cursor = contextIndex + 1;
    }
    if (chunk.oldLines.length === 0) {
      const insertion = original.length > 0 && original.at(-1) === "" ? original.length - 1 : original.length;
      replacements.push({ start: insertion, remove: 0, add: chunk.newLines });
      continue;
    }
    const found = seek(original, chunk.oldLines, cursor, chunk.endOfFile);
    if (found < 0) throw patchError(`Failed to find expected lines:\n${chunk.oldLines.join("\n")}`, "apply_patch_hunk_not_found", filePath);
    replacements.push({ start: found, remove: chunk.oldLines.length, add: chunk.newLines });
    cursor = found + chunk.oldLines.length;
  }
  replacements.sort((a, b) => b.start - a.start);
  const next = [...original];
  for (const replacement of replacements) next.splice(replacement.start, replacement.remove, ...replacement.add);
  while (next.length > 0 && next.at(-1) === "") next.pop();
  return `${next.join("\n")}\n`;
}

export function createStructuredPatch(filePath, oldContent, newContent) {
  const oldLines = oldContent === "" ? [] : oldContent.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const newLines = newContent === "" ? [] : newContent.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix += 1;
  if (prefix === oldLines.length && prefix === newLines.length) return { hunks: [], additions: 0, deletions: 0 };
  const oldMiddle = oldLines.slice(prefix, oldLines.length - suffix);
  const newMiddle = newLines.slice(prefix, newLines.length - suffix);
  const lines = [
    ...oldMiddle.map((line) => `-${line}`),
    ...newMiddle.map((line) => `+${line}`),
  ];
  return {
    hunks: [{ oldStart: prefix + 1, oldLines: oldMiddle.length, newStart: prefix + 1, newLines: newMiddle.length, lines }],
    additions: newMiddle.length,
    deletions: oldMiddle.length,
  };
}

function splitLines(content) {
  const lines = content.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function seek(lines, pattern, start = 0, eof = false) {
  if (pattern.length === 0) return -1;
  const comparators = [same, trimEndSame, trimSame, unicodeSame];
  for (const compare of comparators) {
    if (eof) {
      const atEnd = lines.length - pattern.length;
      if (atEnd >= start && matches(lines, pattern, atEnd, compare)) return atEnd;
    }
    for (let index = start; index <= lines.length - pattern.length; index += 1) {
      if (matches(lines, pattern, index, compare)) return index;
    }
  }
  return -1;
}

function matches(lines, pattern, start, compare) {
  return pattern.every((line, offset) => compare(lines[start + offset] ?? "", line ?? ""));
}

function same(left, right) { return left === right; }
function trimEndSame(left, right) { return left.trimEnd() === right.trimEnd(); }
function trimSame(left, right) { return left.trim() === right.trim(); }
function unicodeSame(left, right) { return normalizeUnicode(left.trim()) === normalizeUnicode(right.trim()); }
function normalizeUnicode(value) {
  return value.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

function isSection(line) {
  return line.startsWith(ADD) || line.startsWith(DELETE) || line.startsWith(UPDATE) || line.trim() === END;
}
function startsNextHunkOrSection(line) { return line.startsWith("@@") || isSection(line); }
function headerPath(line, prefix) {
  const value = line.slice(prefix.length).trim();
  if (!value) throw patchError(`Missing path for ${prefix}`, "apply_patch_invalid_patch");
  return value;
}
function stripHeredoc(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(?:cat\s+)?<<['"]?([A-Za-z0-9_]+)['"]?\s*\n([\s\S]*?)\n\1\s*$/);
  return match ? match[2] : value;
}
function patchError(message, code, filePath) {
  return new EditingEngineError(code, message, { path: filePath });
}
