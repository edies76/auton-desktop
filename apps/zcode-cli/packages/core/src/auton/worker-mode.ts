// ============================================================
// Modo del worker Auton — la decisión, separada de la ejecución
// ============================================================
// Un worker puede correr como subagente (el comportamiento de siempre) o como
// sesión completa de ZCode: herramientas completas, navegador propio y espacio
// de trabajo aislado. Todo lo que depende del modo se resuelve aquí, en puro,
// para poder probarlo sin levantar el runtime.

import { join, resolve } from "node:path";

export const AUTON_WORKER_MODE_ENV = "AUTON_WORKER_MODE";

export type AutonWorkerMode = "subagent" | "session";

/** El modo de siempre. Apagar el interruptor devuelve exactamente esto. */
export const DEFAULT_AUTON_WORKER_MODE: AutonWorkerMode = "subagent";

export function parseAutonWorkerMode(value: unknown): AutonWorkerMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "session") return "session";
  if (normalized === "subagent") return "subagent";
  return undefined;
}

/**
 * Orden de precedencia: lo que pide el despacho, después el interruptor del
 * entorno/configuración, después el valor por defecto. Un valor inválido se
 * ignora en vez de romper el despacho.
 */
export function resolveAutonWorkerMode(
  input: {
    requested?: unknown;
    env?: string | undefined;
    fallback?: AutonWorkerMode;
  } = {},
): AutonWorkerMode {
  return (
    parseAutonWorkerMode(input.requested) ??
    parseAutonWorkerMode(input.env) ??
    input.fallback ??
    DEFAULT_AUTON_WORKER_MODE
  );
}

/** Quién manda sobre la pestaña del navegador que usa el worker para probarse. */
export type AutonBrowserOwner = "parent" | "worker";

export interface AutonWorkerPlacement {
  mode: AutonWorkerMode;
  /** Tipo de sesión con el que nace el worker. */
  taskType: "subagent_child" | "auton_worker_session";
  toolset: "main";
  /** `undefined` significa juego completo de herramientas. */
  toolAllowlist: readonly string[] | undefined;
  workingDirectory: string;
  workspaceRoot: string;
  browserOwner: AutonBrowserOwner;
  isolatedWorkspace: boolean;
}

/** Carpeta propia de cada worker de sesión, hermana del proyecto y aislada. */
export function autonWorkerWorkspacePath(input: {
  workspaceRoot: string;
  workerSessionId: string;
  baseDir?: string;
}): string {
  // Absoluta siempre: las tools de ejecución rechazan rutas relativas, y un
  // workspace relativo dejaría al worker sin poder correr su primer comando.
  const base = resolve(input.baseDir?.trim() || join(input.workspaceRoot, ".auton", "workers"));
  return resolve(base, input.workerSessionId);
}

/**
 * Resuelve todo lo que cambia con el modo de una sola vez. En modo subagente
 * reproduce el comportamiento actual; en modo sesión abre el juego completo y
 * el espacio propio.
 */
export function resolveAutonWorkerPlacement(input: {
  mode: AutonWorkerMode;
  parentWorkingDirectory: string;
  workspaceRoot: string;
  workerSessionId: string;
  baseDir?: string;
  /** La lista que hoy produce la política de subagentes; se ignora en modo sesión. */
  subagentToolAllowlist?: readonly string[];
}): AutonWorkerPlacement {
  if (input.mode === "session") {
    const workspace = autonWorkerWorkspacePath({
      workspaceRoot: input.workspaceRoot,
      workerSessionId: input.workerSessionId,
      ...(input.baseDir ? { baseDir: input.baseDir } : {}),
    });
    return {
      mode: "session",
      taskType: "auton_worker_session",
      toolset: "main",
      toolAllowlist: undefined,
      workingDirectory: workspace,
      workspaceRoot: workspace,
      browserOwner: "worker",
      isolatedWorkspace: true,
    };
  }

  return {
    mode: "subagent",
    taskType: "subagent_child",
    toolset: "main",
    toolAllowlist: input.subagentToolAllowlist,
    workingDirectory: input.parentWorkingDirectory,
    workspaceRoot: input.workspaceRoot,
    browserOwner: "parent",
    isolatedWorkspace: false,
  };
}

/**
 * El canal del coordinador se registra en los dos modos: la marca de subagente
 * deja de ser la condición. Solo hace falta el puerto de respuesta.
 */
export function shouldRegisterCoordinatorChannel(input: {
  hasCoordinatorPort: boolean;
}): boolean {
  return input.hasCoordinatorPort;
}

export interface AutonWorkerBrowserScope {
  owner: AutonBrowserOwner;
  childSessionId: string;
  parentSessionId: string;
  /** Las pestañas viven en la sesión padre para que el humano las vea. */
  tabOwner: "parent";
}

export function resolveWorkerBrowserScope(input: {
  mode: AutonWorkerMode;
  childSessionId: string;
  parentSessionId: string;
}): AutonWorkerBrowserScope {
  return {
    owner: input.mode === "session" ? "worker" : "parent",
    childSessionId: input.childSessionId,
    parentSessionId: input.parentSessionId,
    tabOwner: "parent",
  };
}
