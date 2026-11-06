import path from "node:path";
import { EditingEngineError } from "./errors.mjs";

export function resolveWorkspacePath(inputPath, {
  workingDirectory,
  workspaceRoot,
  allowOutsideWorkspace = false,
} = {}) {
  if (typeof inputPath !== "string" || inputPath.trim().length === 0) {
    throw new EditingEngineError("invalid_path", "Tool path must not be empty");
  }
  if (!path.isAbsolute(workingDirectory ?? "") || !path.isAbsolute(workspaceRoot ?? "")) {
    throw new EditingEngineError("invalid_context", "Workspace root and working directory must be absolute paths");
  }
  const root = path.resolve(workspaceRoot);
  const cwd = path.resolve(workingDirectory);
  const resolved = path.resolve(path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath));
  if (!allowOutsideWorkspace && !isWithin(root, resolved)) {
    throw new EditingEngineError("path_outside_workspace", `Path is outside the selected workspace: ${resolved}`, { path: resolved });
  }
  return resolved;
}

export function isWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function pathKey(value) {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLocaleLowerCase("en-US") : normalized;
}
