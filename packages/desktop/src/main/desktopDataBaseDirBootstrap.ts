import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { APP_DATA_DIR_NAME_ENV, setAppDataDirName, setDataBaseDir } from "@zcode/services/node";
import { ZCODE_VERSION } from "@zcode/shared";

interface AppVersionBootstrapApp {
  setVersion(version: string): void;
}

export function applyEarlyAppVersionBootstrap(
  app: AppVersionBootstrapApp,
  version: string = ZCODE_VERSION,
): string {
  // 原因：开发态 Electron 以 packages/desktop 为应用目录，该 package.json 没有 version 字段，
  // app.getVersion() 返回 "0.0"；autoUpdater.ts 在模块顶层解构 electron-updater 的 autoUpdater，
  // getter 会立即构造 AppUpdater 并校验 semver，抛错使 main 在 whenReady 之前就退出、无窗口。
  // 打包态由 electron-builder 注入根 package.json 的版本；这里在任何业务模块加载前用同一
  // 来源（构建期 __ZCODE_VERSION__）显式对齐，保证开发态与打包态版本一致。
  app.setVersion(version);
  return version;
}

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

// El CLI del agente arranca con su propia casa (.auton/cli). Se hereda una sola vez
// el config del ZCode viejo (modelo, features, hooks) para no dejar al usuario a
// oscuras; sus sesiones y su base no viajan.
function seedAutonCliConfig(homePath: string = homedir()): void {
  const target = join(homePath, ".auton", "cli", "config.json");
  if (existsSync(target)) return;
  const legacy = join(homePath, ".zcode", "cli", "config.json");
  if (!existsSync(legacy)) return;
  try {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(legacy, target);
  } catch {
    // Si no se puede heredar, el CLI arranca con su config por defecto.
  }
}

export function applyEarlyDataBaseDirBootstrap(): string | null {
  if (!process.env[APP_DATA_DIR_NAME_ENV]?.trim()) {
    process.env[APP_DATA_DIR_NAME_ENV] = ".auton";
  }
  seedAutonSettingsFromLegacy();
  seedAutonCliConfig();
  setAppDataDirName(process.env[APP_DATA_DIR_NAME_ENV] ?? ".auton");
  const dataBaseDir = readBootstrapDataBaseDirFromDisk();
  if (dataBaseDir) {
    // 启动早期就把 dataBaseDir 注入进来，避免 logger / crashReporter 先按默认 HOME 建目录，
    // 导致后续再切换到自定义目录时，日志和 crash dump 落在两套路径里。
    setDataBaseDir(dataBaseDir);
  }
  return dataBaseDir;
}

