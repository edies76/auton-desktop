import { ArrowRight, FolderOpen, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { cn } from "@/components/lib/utils.js";
import {
  canCreateProject,
  formatProjectActivity,
  sortProjectsByActivity,
  validateProjectDraft,
  type AutonProject,
} from "./model.js";

export interface AutonProjectDraft {
  name: string;
  path: string;
}

export interface AutonProjectsScreenProps {
  projects: readonly AutonProject[];
  now: number;
  onOpen: (project: AutonProject) => void;
  onCreate: (draft: AutonProjectDraft) => void;
}

/**
 * Pantalla 1: los proyectos del humano. Se entra a uno o se crea uno nuevo con
 * nombre y ruta; sin las dos cosas no se abre nada.
 */
export function AutonProjectsScreen({
  projects,
  now,
  onOpen,
  onCreate,
}: AutonProjectsScreenProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const ordered = sortProjectsByActivity(projects);
  const validation = validateProjectDraft(name, path);
  const valid = canCreateProject(name, path);

  const close = () => {
    setCreating(false);
    setSubmitted(false);
    setName("");
    setPath("");
  };

  const submit = () => {
    setSubmitted(true);
    if (!validation.ok) return;
    onCreate({ name: name.trim(), path: path.trim() });
    close();
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-6 py-8">
      <header className="flex items-start justify-between gap-4 border-border border-b pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              Orquestador
            </Badge>
            <span className="text-ui-xs text-foreground-subtlest">Auton</span>
          </div>
          <h1 className="mt-2 text-ui-xl font-semibold tracking-tight text-foreground">Proyectos</h1>
          <p className="mt-1 text-ui-sm text-foreground-subtle">
            Un proyecto es un nombre y una carpeta. El orquestador trabaja dentro de esa carpeta.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setCreating(true)} data-testid="auton-new-project">
          <Plus className="size-3.5" />
          Nuevo proyecto
        </Button>
      </header>

      {ordered.length === 0 ? (
        <div
          className="mt-10 flex flex-col items-center justify-center rounded-lg border border-border border-dashed px-6 py-12 text-center"
          data-testid="auton-projects-empty"
        >
          <FolderOpen className="size-6 text-foreground-subtlest" />
          <p className="mt-3 text-ui-sm text-foreground-subtle">
            Todavía no hay proyectos. Crea uno con nombre y ruta.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border" data-testid="auton-project-list">
          {ordered.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onOpen(project)}
                data-testid="auton-project-row"
                data-project-id={project.id}
                className={cn(
                  "group flex w-full items-center gap-3 px-2 py-3 text-left transition-colors",
                  "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <FolderOpen className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui-sm font-medium text-foreground">
                    {project.name}
                  </span>
                  <span className="block truncate text-ui-xs text-foreground-subtlest">
                    {project.path}
                  </span>
                </span>
                <span className="hidden shrink-0 text-ui-xs text-foreground-subtlest sm:block">
                  {formatProjectActivity(project.lastActiveAt, now)}
                </span>
                <ArrowRight className="size-4 shrink-0 text-foreground-subtlest transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={(open) => (open ? setCreating(true) : close())}>
        <DialogContent className="sm:max-w-md" data-testid="auton-create-project-dialog">
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>
              El nombre es la etiqueta que ves. La ruta es la carpeta donde trabaja el orquestador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="auton-project-name">Nombre</Label>
              <Input
                id="auton-project-name"
                data-testid="auton-project-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={submitted && Boolean(validation.errors.name)}
                placeholder="Lunar móvil"
              />
              {submitted && validation.errors.name ? (
                <p className="text-ui-xs text-destructive" data-testid="auton-project-name-error">
                  {validation.errors.name}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auton-project-path">Ruta</Label>
              <Input
                id="auton-project-path"
                data-testid="auton-project-path"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                aria-invalid={submitted && Boolean(validation.errors.path)}
                placeholder="C:\\proyectos\\lunar-movil"
              />
              {submitted && validation.errors.path ? (
                <p className="text-ui-xs text-destructive" data-testid="auton-project-path-error">
                  {validation.errors.path}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!valid}
              onClick={submit}
              data-testid="auton-create-project-confirm"
            >
              Crear y abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
