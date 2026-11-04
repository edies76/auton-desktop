// ============================================================
// Conversaciones de workers en el espacio del proyecto
// ============================================================
// El índice durable y las transcripciones viven en el workspace. Este hook los
// lee con el servicio de archivos del host y los convierte en la misma
// instantánea que ya consume la proyección del panel.

import { useEffect, useState } from "react";
import { useOptionalServices } from "@/hooks/useServices.js";
import type { AutonWorkerEvent } from "./model.js";
import type { AutonSessionWorkerSnapshot } from "./sessionWorker.js";

interface FileTextReader {
  readTextFile(params: { path: string }): Promise<{ content: string }>;
}

export interface WorkerIndexEntryLike {
  workerId: string;
  taskId?: string;
  engine: string;
  engineSessionId?: string;
  workspace?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  transcriptFile?: string;
  description: string;
  mode?: string;
  effort?: string;
}

export interface WorkerTranscriptEntryLike {
  id: string;
  at: number;
  kind: AutonWorkerEvent["kind"];
  role?: "worker" | "orchestrator";
  text: string;
  status?: string;
}

const INDEX_PATH = ".auton/workers/index.json";
const TRANSCRIPT_KINDS = new Set<AutonWorkerEvent["kind"]>([
  "message",
  "tool",
  "question",
  "close",
]);

function workspacePath(root: string, relative: string): string {
  const separator = root.includes("\\") ? "\\" : "/";
  const base = root.replace(/[\\/]+$/, "");
  return `${base}${separator}${relative.replaceAll("/", separator)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function parseWorkerIndex(raw: string): WorkerIndexEntryLike[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is WorkerIndexEntryLike => {
      if (!isRecord(value)) return false;
      return (
        typeof value.workerId === "string" &&
        typeof value.engine === "string" &&
        typeof value.status === "string" &&
        typeof value.startedAt === "string" &&
        typeof value.description === "string"
      );
    });
  } catch {
    return [];
  }
}

export function parseWorkerTranscript(raw: string): WorkerTranscriptEntryLike[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is WorkerTranscriptEntryLike => {
      if (!isRecord(value)) return false;
      return (
        typeof value.id === "string" &&
        typeof value.at === "number" &&
        typeof value.text === "string" &&
        typeof value.kind === "string" &&
        TRANSCRIPT_KINDS.has(value.kind as AutonWorkerEvent["kind"])
      );
    });
  } catch {
    return [];
  }
}

export function sessionWorkerSnapshotFromIndex(
  entry: WorkerIndexEntryLike,
  transcript: readonly WorkerTranscriptEntryLike[],
  now: number = Date.now(),
): AutonSessionWorkerSnapshot {
  const startedAt = Date.parse(entry.startedAt);
  const endedAt = entry.endedAt ? Date.parse(entry.endedAt) : undefined;
  const status: AutonSessionWorkerSnapshot["status"] =
    entry.status === "completed" ||
    entry.status === "failed" ||
    entry.status === "stopped"
      ? entry.status
      : "running";
  const last = transcript.at(-1);
  return {
    agentId: entry.workerId,
    description: entry.description,
    status,
    startedAt: Number.isFinite(startedAt) ? startedAt : now,
    ...(endedAt !== undefined && Number.isFinite(endedAt) ? { completedAt: endedAt } : {}),
    ...(entry.engineSessionId ? { childSessionId: entry.engineSessionId } : {}),
    ...(entry.status === "waiting" ? { waitingForAnswer: true } : {}),
    ...(last ? { lastLine: last.text } : {}),
    transcript,
  };
}

async function readIndex(
  fileService: FileTextReader,
  workspaceRoot: string,
): Promise<WorkerIndexEntryLike[]> {
  try {
    const slice = await fileService.readTextFile({
      path: workspacePath(workspaceRoot, INDEX_PATH),
    });
    return parseWorkerIndex(slice.content);
  } catch {
    return [];
  }
}

async function readTranscript(
  fileService: FileTextReader,
  path: string,
): Promise<WorkerTranscriptEntryLike[]> {
  try {
    const slice = await fileService.readTextFile({ path });
    return parseWorkerTranscript(slice.content);
  } catch {
    return [];
  }
}

/** Lee el índice y las transcripciones del proyecto mientras la vista vive. */
export function useSessionWorkerConversations(
  workspaceRoot: string,
  pollMs = 1_000,
): AutonSessionWorkerSnapshot[] {
  const services = useOptionalServices();
  const fileService = services?.fileService;
  const [snapshots, setSnapshots] = useState<AutonSessionWorkerSnapshot[]>([]);

  useEffect(() => {
    if (!fileService || !workspaceRoot) {
      setSnapshots([]);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const read = async (): Promise<void> => {
      const entries = await readIndex(fileService, workspaceRoot);
      const loaded = await Promise.all(
        entries.map(async (entry) => {
          const transcript = entry.transcriptFile
            ? await readTranscript(fileService, entry.transcriptFile)
            : [];
          return sessionWorkerSnapshotFromIndex(entry, transcript);
        }),
      );
      if (cancelled) return;
      setSnapshots(loaded);
      timer = setTimeout(() => void read(), pollMs);
    };

    void read();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fileService, pollMs, workspaceRoot]);

  return snapshots;
}
