import { Folder, Plus, Search } from "lucide-react";
import type { ProjectSidebarProps, ProjectSidebarView } from "@/project-sidebar/contract.js";
import { Button } from "@/components/ui/button.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatCommandShortcutLabel } from "@/lib/keyboardShortcuts.js";
import { ControlHintTooltip } from "@/ControlHintTooltip.js";

/**
 * Cabecera del panel del proyecto. En workers muestra el proyecto activo como
 * una fila nativa (icono de carpeta + nombre); no hay menú de vistas de ZCode.
 */
export function ProjectSidebarListHeader({
  onOpenCommandCenter,
  view,
  onViewChange,
  projectName,
  projectPath,
  home = false,
  onAddProject,
}: {
  onOpenCommandCenter: ProjectSidebarProps["onOpenCommandCenter"];
  view: ProjectSidebarView;
  onViewChange(view: ProjectSidebarView): void;
  projectName?: string;
  projectPath?: string;
  /** Pantalla de entrada: solo proyectos, sin búsqueda de tareas. */
  home?: boolean;
  onAddProject?: () => void;
}) {
  const { intl } = useZCodeIntl();
  return (
    <div
      className="flex min-w-0 shrink-0 items-center gap-1 px-2 pb-2"
      data-testid="sidebar-search-toolbar"
    >
      {view === "workers" ? (
        projectName ? (
          <button
            type="button"
            data-testid="auton-project-switcher"
            title={projectPath ?? projectName}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-selected px-2.5 py-1.5 text-left text-ui-base text-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => onViewChange("projects")}
          >
            <Folder className="size-4 shrink-0 text-foreground-subtle" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{projectName}</span>
              {projectPath ? (
                <span className="block truncate text-ui-sm text-foreground-subtlest">
                  {projectPath}
                </span>
              ) : null}
            </span>
          </button>
        ) : (
          <span className="min-w-0 flex-1" aria-hidden="true" />
        )
      ) : (
        <span
          data-testid="sidebar-list-title"
          className="min-w-0 flex-1 truncate px-2.5 text-ui-base font-medium text-foreground-subtle"
        >
          {intl.formatMessage({ id: "project.projects" })}
        </span>
      )}
      {view === "projects" && onAddProject ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-foreground-subtle hover:text-foreground"
          data-testid="sidebar-add-project"
          aria-label={intl.formatMessage({ id: "project.create" })}
          onClick={onAddProject}
        >
          <Plus className="size-3.5" />
        </Button>
      ) : null}
      {home ? null : (
        <ControlHintTooltip
          title={intl.formatMessage({ id: "commandCenter.open" })}
          shortcut={formatCommandShortcutLabel("k")}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-foreground-subtle hover:text-foreground"
            data-testid="sidebar-search-open"
            aria-label={intl.formatMessage({ id: "commandCenter.open" })}
            onClick={onOpenCommandCenter}
          >
            <Search className="size-3.5" />
          </Button>
        </ControlHintTooltip>
      )}
    </div>
  );
}
