import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { APP_DATA_DIR_NAME_ENV, setAppDataDirName, setDataBaseDir } from "@zcode/services/node";

export function resolveBootstrapSettingsFile(homePath: string = homedir()): string {
  return join(homePath, ".auton", "v2", "setting.json");
}

// Auton hereda los ajustes de ZCode una sola vez (proveedores, cuenta, preferencias)
// para no dejar al usuario sin providers. La lista de proyectos y la ultima sesion
// se descartan: esos chats pertenecen a la instalacion vieja.
function seedAutonSettingsFromLegacy(homePath: string = homedir()): void {
  const target = resolveBootstrapSettingsFile(homePath);
  if (existsSync(target)) return;
  const legacy = join(homePath, ".zcode", "v2", "setting.json");
  if (!existsSync(legacy)) return;
  try {
    const raw = JSON.parse(readFileSync(legacy, "utf-8")) as Record<string, unknown>;
    delete raw.recentProjects;
    delete raw.lastWorkspaceSession;
    delete raw.lastActiveWorkspace;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");
  } catch {
    // Si el archivo viejo no se puede leer, Auton arranca con los ajustes por defecto.
  }
}

export function extractBootstrapDataBaseDir(rawValue: unknown): string | null {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const dataBaseDir = (rawValue as { dataBaseDir?: unknown }).dataBaseDir;
  if (typeof dataBaseDir !== "string") {
    return null;
  }

  const trimmed = dataBaseDir.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBootstrapDataBaseDirFromDisk(
  settingsFile: string = resolveBootstrapSettingsFile(),
): string | null {
  if (!existsSync(settingsFile)) {
    return null;
  }

  try {
    const raw = readFileSync(settingsFile, "utf-8");
    return extractBootstrapDataBaseDir(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function applyEarlyDataBaseDirBootstrap(): string | null {
  if (!process.env[APP_DATA_DIR_NAME_ENV]?.trim()) {
    process.env[APP_DATA_DIR_NAME_ENV] = ".auton";
  }
  seedAutonSettingsFromLegacy();
  setAppDataDirName(process.env[APP_DATA_DIR_NAME_ENV] ?? ".auton");
  const dataBaseDir = readBootstrapDataBaseDirFromDisk();
  if (dataBaseDir) {
    // 启动早期就把 dataBaseDir 注入进来，避免 logger / crashReporter 先按默认 HOME 建目录，
    // 导致后续再切换到自定义目录时，日志和 crash dump 落在两套路径里。
    setDataBaseDir(dataBaseDir);
  }
  return dataBaseDir;
}

