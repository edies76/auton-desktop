export interface FileRevision {
  id: string;
  mtimeMs?: number;
  sizeBytes?: number;
  hash?: string;
}

export interface FileSystemReadTextResult {
  path: string;
  content: string;
  encoding?: string;
  lineEndings?: "LF" | "CRLF";
  revision?: FileRevision;
  sizeBytes?: number;
}

export interface FileSystemReadTextRangeResult {
  path: string;
  content: string;
  startLine: number;
  lineCount: number;
  totalLines: number;
  sizeBytes: number;
  bytesRead: number;
  truncated: boolean;
  revision?: FileRevision;
}
export interface FileSystemReadBytesResult {
  path: string;
  content: Uint8Array;
  bytesRead: number;
  sizeBytes: number;
  revision?: FileRevision;
}

export interface FileSystemStatResult {
  path: string;
  kind: "file" | "directory" | "symlink" | "other" | "missing";
  sizeBytes: number;
  mtimeMs?: number;
  revision?: FileRevision;
}

export interface FileSystemPort {
  stat(request: { path: string; trace?: unknown }, options?: { signal?: AbortSignal }): Promise<FileSystemStatResult>;
  readTextFile(request: { path: string; trace?: unknown }, options?: { signal?: AbortSignal }): Promise<FileSystemReadTextResult>;
  /** Optional. Enables exact byte snapshots in the Auton change journal. */
  readBinaryFile?(request: { path: string; trace?: unknown }, options?: { signal?: AbortSignal }): Promise<FileSystemReadBytesResult>;
  readTextFileRange(request: { path: string; offsetLine: number; limitLines?: number; maxBytes?: number; trace?: unknown }, options?: { signal?: AbortSignal }): Promise<FileSystemReadTextRangeResult>;
  writeTextFile(request: { path: string; content: string; encoding?: string; lineEndings?: "LF" | "CRLF"; createParents?: boolean; atomic?: boolean; expectedRevision?: FileRevision; trace?: unknown }, options?: { signal?: AbortSignal }): Promise<{ path: string; bytesWritten: number; revision?: FileRevision }>;
  removeFile(request: { path: string; trace?: unknown }, options?: { signal?: AbortSignal }): Promise<{ path: string; removed: boolean }>;
}

export interface EditingEngineOptions {
  fileSystem: FileSystemPort;
  workspaceRoot: string;
  workingDirectory?: string;
  allowOutsideWorkspace?: boolean;
  maxReadBytes?: number;
  maxReadTokens?: number;
  onFileChange?: (change: {
    type: "add" | "update" | "delete" | "move";
    path: string;
    previousPath?: string;
    before: string | null;
    after: string | null;
    /** Base64 raw-byte snapshots; omitted when the host cannot capture a revision-safe snapshot. */
    beforeBase64?: string | null;
    afterBase64?: string | null;
    encoding?: string;
    lineEndings?: "LF" | "CRLF";
    revision?: FileRevision;
  }) => Promise<void> | void;
  trace?: unknown;
}

export interface ReadInput { file_path: string; offset?: number; limit?: number; }
export interface WriteInput { file_path: string; content: string; }
export interface EditInput { file_path: string; old_string: string; new_string: string; replace_all?: boolean; }
export interface DiffHunk { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[]; }
export interface ReadTextOutput {
  type: "text";
  filePath: string;
  content: string;
  numLines: number;
  startLine: number;
  totalLines: number;
  sizeBytes?: number;
  bytesRead?: number;
  truncated?: boolean;
  partialViewNotice?: string;
}
export interface WriteOutput {
  type: "create" | "update";
  filePath: string;
  content: string;
  structuredPatch: DiffHunk[];
  originalFile: string | null;
  userModified: false;
  journalWarning?: string;
}
export interface EditOutput {
  filePath: string;
  oldString: string;
  newString: string;
  originalFile: string;
  structuredPatch: DiffHunk[];
  userModified: false;
  replaceAll: boolean;
  matchStrategy: string;
  matchCandidateCount: number;
  journalWarning?: string;
}
export interface ApplyPatchOutput {
  files: Array<{
    filePath: string;
    type: "add" | "update" | "delete" | "move";
    movePath?: string;
    structuredPatch: DiffHunk[];
    additions: number;
    deletions: number;
    journalWarning?: string;
  }>;
  structuredPatch: DiffHunk[];
  summary: string;
}

export class EditingEngineError extends Error {
  code: string;
  path?: string;
}

export class AutonEditingEngine {
  constructor(options: EditingEngineOptions);
  read(input: ReadInput, options?: { signal?: AbortSignal }): Promise<ReadTextOutput>;
  formatRead(output: ReadTextOutput | { type: "file_unchanged" }): string;
  write(input: WriteInput, options?: { signal?: AbortSignal }): Promise<WriteOutput>;
  edit(input: EditInput, options?: { signal?: AbortSignal }): Promise<EditOutput>;
  applyPatch(input: string | { patch_text: string }, options?: { signal?: AbortSignal }): Promise<ApplyPatchOutput>;
}

export const READ_MAX_FILE_SIZE_BYTES: number;
export const READ_MAX_OUTPUT_TOKENS: number;
export const READ_DEFAULT_MAX_LINES: number;
export const MAX_EDIT_FILE_SIZE_BYTES: number;
export function parseStructuredPatch(input: string): unknown[];
export function applyChunks(content: string, chunks: unknown[], filePath?: string): string;
export function createStructuredPatch(filePath: string, oldContent: string, newContent: string): { hunks: DiffHunk[]; additions: number; deletions: number };
export function isWithin(root: string, candidate: string): boolean;
export function resolveWorkspacePath(inputPath: string, options: { workspaceRoot: string; workingDirectory: string; allowOutsideWorkspace?: boolean; operation?: string }): string;
