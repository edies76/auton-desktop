import { Check, Folder } from "lucide-react";
import type { VirtualProject } from "@/project-sidebar/contract.js";
import { cn } from "@/components/lib/utils.js";

export interface AutonProjectPickerProps {
  projects: readonly VirtualProject[];
  activeProjectId: string | null;
  onSelect: (project: VirtualProject) => void;
}

/**
 * Selector de proyecto sin chats ni tareas: una fila por proyecto, con el
 * mismo estilo de fila nativa del sidebar. Elegir uno vuelve a sus workers.
 */
export function AutonProjectPicker({
  projects,
  activeProjectId,
  onSelect,
}: AutonProjectPickerProps) {
  return (
    <div className="px-1.5" data-testid="auton-project-picker" role="listbox" aria-label="Projects">
      {projects.map((project) => {
        const selected = project.id === activeProjectId;
        const path = project.roots[0]?.rootPath;
        return (
          <button
            key={`${project.hostId}::${project.id}`}
            type="button"
            role="option"
            aria-selected={selected}
            data-project-id={project.id}
            data-selected={selected ? "true" : "false"}
            title={path}
            onClick={() => onSelect(project)}
            className={cn(
              "group/project-row flex min-h-7 w-full min-w-0 items-center gap-2 rounded-lg border border-transparent pl-2.5 pr-1 py-1 text-left text-ui-base transition-colors",
              selected ? "bg-selected text-foreground" : "text-foreground hover:bg-surface-hover",
            )}
          >
            <Folder className="size-4 shrink-0 text-foreground-subtle" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            {selected ? (
              <Check className="size-4 shrink-0 text-foreground-subtle" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
