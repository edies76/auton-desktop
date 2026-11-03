import { useCallback, useMemo, useState } from "react";
import type { ConversationRow } from "@zcode/shared/zcode-protocol-v4";
import { useAutonClock } from "./clock.js";
import { AutonProjectsScreen, type AutonProjectDraft } from "./ProjectListScreen.js";
import { AutonProjectSpace } from "./ProjectSpaceScreen.js";
import { projectAutonSpace } from "./projection.js";
import {
  emptySpaceData,
  projectIdFor,
  type AutonProject,
  type AutonProjectSpaceData,
  type AutonThreadMessage,
} from "./model.js";

const STORAGE_KEY = "auton.projects.v1";

function readStoredProjects(): AutonProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is AutonProject =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as AutonProject).id === "string" &&
        typeof (entry as AutonProject).name === "string" &&
        typeof (entry as AutonProject).path === "string" &&
        typeof (entry as AutonProject).lastActiveAt === "number",
    );
  } catch {
    return [];
  }
}

function writeStoredProjects(projects: readonly AutonProject[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // El espacio sigue funcionando sin persistencia.
  }
}

export interface AutonWorkspaceAppProps {
  /** Proyectos iniciales; si se omite, se leen del almacenamiento local. */
  initialProjects?: readonly AutonProject[];
  /** Filas reales de la conversación del orquestador; se proyectan al espacio. */
  rows?: readonly ConversationRow[];
  /** Proyección lista por proyecto, para consumidores que ya la calculan. */
  dataForProject?: (project: AutonProject) => AutonProjectSpaceData;
  /** Reloj inyectado para pruebas; si se omite, corre solo. */
  now?: number;
  /** Mensaje del humano al orquestador. */
  onSendMessage?: (project: AutonProject, text: string) => void;
  /** Parada manual de un worker. */
  onStopWorker?: (project: AutonProject, workerId: string) => void;
}

/**
 * La superficie de Auton: lista de proyectos y espacio de un proyecto, con el
 * hilo del orquestador y el panel de workers. No conoce Electron ni servicios.
 */
export function AutonWorkspaceApp({
  initialProjects,
  rows,
  dataForProject,
  now: injectedNow,
  onSendMessage,
  onStopWorker,
}: AutonWorkspaceAppProps) {
  const [projects, setProjects] = useState<AutonProject[]>(() =>
    initialProjects ? [...initialProjects] : readStoredProjects(),
  );
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [sentMessages, setSentMessages] = useState<Record<string, AutonThreadMessage[]>>({});
  const now = useAutonClock(injectedNow);

  const persist = useCallback((next: AutonProject[]) => {
    setProjects(next);
    writeStoredProjects(next);
  }, []);

  const createProject = useCallback(
    (draft: AutonProjectDraft) => {
      const project: AutonProject = {
        id: projectIdFor(draft.name, draft.path, projects),
        name: draft.name,
        path: draft.path,
        lastActiveAt: now,
      };
      persist([...projects, project]);
      setActiveProjectId(project.id);
    },
    [now, persist, projects],
  );

  const openProject = useCallback(
    (project: AutonProject) => {
      persist(
        projects.map((entry) =>
          entry.id === project.id ? { ...entry, lastActiveAt: now } : entry,
        ),
      );
      setActiveProjectId(project.id);
    },
    [now, persist, projects],
  );

  const activeProject = activeProjectId
    ? projects.find((project) => project.id === activeProjectId)
    : undefined;

  const spaceData = useMemo<AutonProjectSpaceData>(() => {
    if (!activeProject) return emptySpaceData();
    const base = dataForProject
      ? dataForProject(activeProject)
      : rows
        ? projectAutonSpace({ rows, now })
        : emptySpaceData();
    const extra = sentMessages[activeProject.id] ?? [];
    return { ...base, messages: [...base.messages, ...extra] };
  }, [activeProject, dataForProject, now, rows, sentMessages]);

  const send = useCallback(
    (text: string) => {
      if (!activeProject) return;
      setSentMessages((current) => ({
        ...current,
        [activeProject.id]: [
          ...(current[activeProject.id] ?? []),
          {
            id: `human-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            at: Date.now(),
            role: "human",
            text,
          },
        ],
      }));
      onSendMessage?.(activeProject, text);
    },
    [activeProject, onSendMessage],
  );

  return (
    <div className="h-dvh w-full bg-background" data-testid="auton-workspace-app">
      {activeProject ? (
        <AutonProjectSpace
          project={activeProject}
          data={spaceData}
          now={now}
          onBack={() => setActiveProjectId(null)}
          onStopWorker={(workerId) => onStopWorker?.(activeProject, workerId)}
          onSend={send}
        />
      ) : (
        <AutonProjectsScreen
          projects={projects}
          now={now}
          onOpen={openProject}
          onCreate={createProject}
        />
      )}
    </div>
  );
}
