import { ArrowRight, Folder } from "lucide-react";
import type { VirtualProject } from "./contract.js";
import { Button } from "@/components/ui/button.js";
import { useProjectTree } from "./useProjectTree.js";

/** Lo mínimo que la lista necesita de una tarea del proyecto. */
interface AutonProjectTask {
  taskId: string;
  projectId?: string | null;
  updatedAt: number;
}

export interface AutonProjectListProps {
  onOpenProject: (project: VirtualProject, rootPath: string, taskId: string) => void;
  onOpenWorkspace: (path: string) => void;
}

function rootOf(project: VirtualProject): string {
  return (
    project.roots.find((root) => root.isPrimary)?.rootPath ??
    project.roots[0]?.rootPath ??
    project.directoryMatchPath ??
    ""
  );
}

function latestTask(
  tasks: readonly AutonProjectTask[],
  projectId: string,
): AutonProjectTask | undefined {
  return tasks
    .filter((task) => task.projectId === projectId)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

/**
 * Pantalla 1 de Auton dentro de la app: los proyectos reales del workspace
 * (`useProjectTree`), con el mismo gris y los mismos tokens del shell.
 * Abrir un proyecto entra a su sesión más reciente; si no tiene, abre el
 * workspace para crear la primera.
 */
export function AutonProjectList({ onOpenProject, onOpenWorkspace }: AutonProjectListProps) {
  const { tree, loading } = useProjectTree();
  const projects = [...tree.projects]
    .filter((project) => !project.deleted)
    .sort((left, right) => {
      const leftAt = latestTask(tree.tasks, left.id)?.updatedAt ?? left.updatedAt;
      const rightAt = latestTask(tree.tasks, right.id)?.updatedAt ?? right.updatedAt;
      return rightAt - leftAt;
    });

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-6 py-8">
      <header className="border-border border-b pb-5">
        <p className="text-ui-xs text-foreground-subtlest">Auton · Espacio del proyecto</p>
        <h1 className="mt-1 text-ui-xl font-semibold tracking-tight text-foreground">Proyectos</h1>
        <p className="mt-1 text-ui-sm text-foreground-subtle">
          Abre un proyecto para dirigir sus agentes desde un solo hilo.
        </p>
      </header>

      {loading && projects.length === 0 ? (
        <p className="mt-8 text-ui-sm text-foreground-subtlest">Cargando proyectos…</p>
      ) : projects.length === 0 ? (
        <div className="mt-10 rounded-lg border border-border border-dashed px-6 py-12 text-center">
          <Folder className="mx-auto size-6 text-foreground-subtlest" />
          <p className="mt-3 text-ui-sm text-foreground-subtle">
            Todavía no hay proyectos. Crea uno desde el sidebar de ZCode.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {projects.map((project) => {
            const path = rootOf(project);
            const task = latestTask(tree.tasks, project.id);
            const count = tree.tasks.filter((entry) => entry.projectId === project.id).length;
            return (
              <li key={project.id}>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="auton-project-row"
                  data-project-id={project.id}
                  className="group flex h-auto w-full items-center gap-3 rounded-md px-2 py-3 text-left hover:bg-muted/40"
                  onClick={() =>
                    task && path
                      ? onOpenProject(project, path, task.taskId)
                      : path && onOpenWorkspace(path)
                  }
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Folder className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui-sm font-medium text-foreground">
                      {project.name}
                    </span>
                    <span className="block truncate text-ui-xs text-foreground-subtlest">
                      {path}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-ui-xs text-foreground-subtlest sm:block">
                    {count === 0 ? "sin sesiones" : count === 1 ? "1 sesión" : `${count} sesiones`}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-foreground-subtlest transition-transform group-hover:translate-x-0.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-auto pt-6 text-ui-xs text-foreground-subtlest">
        Los agentes completos son los workers; el orquestador es el hilo.
      </p>
    </div>
  );
}
