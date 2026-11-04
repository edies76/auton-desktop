import { ArrowRight, Folder } from "lucide-react";
import { useAutonHomeStore } from "@/auton/index.js";
import { Button } from "@/components/ui/button.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatTaskRelativeTime } from "@/lib/taskListItemPresentation.js";
import type { VirtualProject } from "./contract.js";
import { useProjectTree } from "./useProjectTree.js";

interface HomeProjectTask {
  taskId: string;
  projectId?: string | null;
  title: string;
  status?: string;
  updatedAt: number;
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
  tasks: readonly HomeProjectTask[],
  projectId: string,
): HomeProjectTask | undefined {
  return tasks
    .filter((task) => task.projectId === projectId)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

function recapFor(task: HomeProjectTask | undefined): string {
  if (!task) return "Sin sesiones todavía.";
  if (task.status === "running") return `Trabajando en: ${task.title}`;
  if (task.status === "error") return `Con error en: ${task.title}`;
  return `Última sesión: ${task.title}`;
}

/**
 * Resumen central de la pantalla de entrada. Lista los proyectos reales del
 * workspace y el último trabajo de cada uno en una línea; no hay compositor.
 */
export function ProjectHomeOverview() {
  const { intl } = useZCodeIntl();
  const requestProject = useAutonHomeStore((state) => state.requestProject);
  const { tree, loading } = useProjectTree();
  const projects = [...tree.projects]
    .filter((project) => !project.deleted)
    .sort((left, right) => {
      const leftAt = latestTask(tree.tasks, left.id)?.updatedAt ?? left.updatedAt;
      const rightAt = latestTask(tree.tasks, right.id)?.updatedAt ?? right.updatedAt;
      return rightAt - leftAt;
    });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-8 py-12">
        <header className="border-border border-b pb-6">
          <p className="text-ui-xs text-foreground-subtlest">Auton</p>
          <h1 className="mt-1 text-ui-xl font-semibold tracking-tight text-foreground">
            Proyectos
          </h1>
          <p className="mt-1 text-ui-sm text-foreground-subtle">
            Elige un proyecto para entrar. El resumen es lo último que se trabajó ahí.
          </p>
        </header>

        {loading && projects.length === 0 ? (
          <p className="mt-8 text-ui-sm text-foreground-subtlest">Cargando proyectos…</p>
        ) : projects.length === 0 ? (
          <div className="mt-10 rounded-lg border border-border border-dashed px-6 py-12 text-center">
            <Folder className="mx-auto size-6 text-foreground-subtlest" />
            <p className="mt-3 text-ui-sm text-foreground-subtle">
              Todavía no hay proyectos. Crea uno con el botón + del panel izquierdo.
            </p>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {projects.map((project) => {
              const path = rootOf(project);
              const latest = latestTask(tree.tasks, project.id);
              return (
                <li key={project.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    data-testid="auton-home-project-row"
                    data-project-id={project.id}
                    className="group flex h-auto w-full items-center gap-3 rounded-md px-1 py-4 text-left hover:bg-muted/30"
                    onClick={() => requestProject(project.id)}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/40 text-foreground-subtle">
                      <Folder className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui-base font-medium text-foreground">
                        {project.name}
                      </span>
                      <span className="mt-0.5 block truncate text-ui-xs text-foreground-subtlest">
                        {path}
                      </span>
                      <span
                        className="mt-1.5 block truncate text-ui-sm text-foreground-subtle"
                        data-testid="auton-home-project-recap"
                      >
                        {recapFor(latest)}
                      </span>
                    </span>
                    {latest ? (
                      <span className="shrink-0 text-ui-xs text-foreground-subtlest">
                        {formatTaskRelativeTime(latest.updatedAt, intl)}
                      </span>
                    ) : null}
                    <ArrowRight className="size-4 shrink-0 text-foreground-subtlest transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
