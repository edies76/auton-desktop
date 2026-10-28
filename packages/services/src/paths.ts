/* path 规则集中维护：旧 task 快照与 provider 配置路径仍在这里收口。 */
import { cpSync, existsSync, lstatSync } from "node:fs";
import { cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join, win32 } from "node:path";
import { homedir } from "node:os";
import {
  DATA_BASE_DIR_FORBIDDEN_WINDOWS_INSTALL_DIR_ERROR_CODE,
  ZCODE_AGENT_RUNTIME,
} from "@zcode/shared";

let _dataBaseDir: string | null = null;
export const ZCODE_WINDOWS_APP_INSTALL_DIR_ENV = "ZCODE_WINDOWS_APP_INSTALL_DIR";
export const APP_DATA_DIR_NAME_ENV = "AUTON_DATA_DIR_NAME";
const envDataBaseDir = process.env.ZCODE_DATA_BASE_DIR?.trim() || null;
let _appDataDirName: string | null = null;

export function setAppDataDirName(dir: string | null): void {
  _appDataDirName = dir?.trim() || null;
}
const defaultDataBaseDir = process.env.HOME?.trim() || homedir();

export interface DataBaseDirTargetValidationOptions {
  platform?: NodeJS.Platform | string;
  env?: Record<string, string | undefined>;
  appInstallDir?: string | null;
}

export type DataBaseDirTargetValidationResult =
  | { ok: true }
  | {
      ok: false;
      code: typeof DATA_BASE_DIR_FORBIDDEN_WINDOWS_INSTALL_DIR_ERROR_CODE;
      forbiddenDir: string;
    };

/** Set the base directory for app data (replaces homedir() prefix). */
export function setDataBaseDir(dir: string | null): void {
  _dataBaseDir = dir?.trim() || null;
}

/** Get the current base directory. Priority: setDataBaseDir() > env ZCODE_DATA_BASE_DIR > homedir(). */
export function getDataBaseDir(): string {
  if (_dataBaseDir) return _dataBaseDir;
  if (envDataBaseDir) return envDataBaseDir;
  // 服务实例会启动后台刷新任务；若每次调用都动态读取 HOME，
  // 测试或宿主切换环境变量后，旧实例可能把数据写到新实例目录。
  return defaultDataBaseDir;
}

/** Nombre de la casa de datos: setter > env AUTON_DATA_DIR_NAME > ".zcode". */
export function getAppDataDirName(): string {
  if (_appDataDirName) return _appDataDirName;
  return process.env[APP_DATA_DIR_NAME_ENV]?.trim() || ".zcode";
}

/** {dataBaseDir}/<dirname> (por defecto .zcode; Auton usa .auton). */
export function getZCodeDataRootDir(): string {
  return join(getDataBaseDir(), getAppDataDirName());
}

/**
 * Ubicación de proveedores y credenciales. Antes apuntaba siempre a `.zcode/v2`, compartido
 * con el ZCode de verdad; ahora respeta la casa de datos de la app (`.auton`) para que las
 * dos instalaciones no se pisen. La primera vez copia lo que ya hubiera en `.zcode/v2`.
 */
export function getSharedLegacyConfigDir(): string {
  const target = join(getDataBaseDir(), getAppDataDirName(), "v2");
  const legacy = join(getDataBaseDir(), ".zcode", "v2");
  migrateOnce(legacy, target);
  return target;
}

/**
 * Copia el contenido de `from` a `to` sin sobrescribir lo que ya exista, una sola vez por
 * proceso. Sirve para heredar proveedores/credenciales del ZCode viejo sin volver a leerlo
 * nunca más.
 */
const migratedDirs = new Set<string>();
const NEVER_MIGRATE = /^(tasks-index|sessions-index|db)\.sqlite(-wal|-shm)?$/i;
function migrateOnce(from: string, to: string): void {
  if (from === to || migratedDirs.has(to)) return;
  migratedDirs.add(to);
  try {
    if (!existsSync(from) || existsSync(to)) return;
    // Nunca se heredan bases de datos ni índices de sesiones: Auton arranca con su propio
    // historial vacío. Solo viajan credenciales, proveedores y configuración.
    cpSync(from, to, { recursive: true, errorOnExist: false, force: false, filter: (source) => !NEVER_MIGRATE.test(basename(source)) });
  } catch {
    // si no se puede migrar, la app arranca vacía en vez de romperse
  }
}

/** 非项目对话共享的真实工作目录；默认 ~/.zcode/workspace/default。 */
export function getConversationWorkspaceDir(): string {
  return join(getZCodeDataRootDir(), "workspace", "default");
}

/** {dataBaseDir}/.zcode/v2 */
export function getAppConfigDir(): string {
  return join(getZCodeDataRootDir(), "v2");
}

function readEnvValue(env: Record<string, string | undefined>, key: string): string | undefined {
  const direct = env[key]?.trim();
  if (direct) {
    return direct;
  }

  const lowerKey = key.toLowerCase();
  for (const [candidateKey, value] of Object.entries(env)) {
    if (candidateKey.toLowerCase() !== lowerKey) {
      continue;
    }
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

function normalizeWindowsComparablePath(pathValue: string): string | null {
  const trimmed = pathValue.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = win32.normalize(trimmed).replace(/[\\/]+$/, "");
  if (!normalized) {
    return null;
  }

  return win32
    .resolve(normalized)
    .replace(/[\\/]+$/, "")
    .toLowerCase();
}

function isWindowsPathEqualOrInside(pathValue: string, rootValue: string): boolean {
  const normalizedPath = normalizeWindowsComparablePath(pathValue);
  const normalizedRoot = normalizeWindowsComparablePath(rootValue);
  if (!normalizedPath || !normalizedRoot) {
    return false;
  }

  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}\\`);
}

function collectWindowsForbiddenAppInstallDirs(
  options: Required<Pick<DataBaseDirTargetValidationOptions, "env">> &
    Pick<DataBaseDirTargetValidationOptions, "appInstallDir">,
): string[] {
  const env = options.env;
  const programFiles = readEnvValue(env, "ProgramFiles");
  const programFilesX86 = readEnvValue(env, "ProgramFiles(x86)");
  const programW6432 = readEnvValue(env, "ProgramW6432");
  const localAppData = readEnvValue(env, "LOCALAPPDATA");
  const candidates = [
    options.appInstallDir,
    readEnvValue(env, ZCODE_WINDOWS_APP_INSTALL_DIR_ENV),
    programFiles ? win32.join(programFiles, "ZCode") : null,
    programFilesX86 ? win32.join(programFilesX86, "ZCode") : null,
    programW6432 ? win32.join(programW6432, "ZCode") : null,
    localAppData ? win32.join(localAppData, "Programs", "ZCode") : null,
  ];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of candidates) {
    const normalized =
      typeof candidate === "string" ? normalizeWindowsComparablePath(candidate) : null;
    if (!candidate || !normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(candidate);
  }

  return result;
}

export function validateDataBaseDirTarget(
  targetBaseDir: string,
  options: DataBaseDirTargetValidationOptions = {},
): DataBaseDirTargetValidationResult {
  if ((options.platform ?? process.platform) !== "win32") {
    return { ok: true };
  }

  for (const forbiddenDir of collectWindowsForbiddenAppInstallDirs({
    env: options.env ?? process.env,
    appInstallDir: options.appInstallDir ?? null,
  })) {
    if (isWindowsPathEqualOrInside(targetBaseDir, forbiddenDir)) {
      return {
        ok: false,
        code: DATA_BASE_DIR_FORBIDDEN_WINDOWS_INSTALL_DIR_ERROR_CODE,
        forbiddenDir,
      };
    }
  }

  return { ok: true };
}

export function getExportLogStageDir(): string {
  return join(getZCodeDataRootDir(), "export-log-stage");
}

export function getExportLogDir(): string {
  return join(getZCodeDataRootDir(), "export-log");
}

export function getFeedbackRootDir(): string {
  return join(getZCodeDataRootDir(), "feedback");
}

export function getFeedbackAttachmentDir(): string {
  return join(getFeedbackRootDir(), "attachments");
}

export function getFeedbackLogArchiveDir(): string {
  return join(getFeedbackRootDir(), "logs");
}

export function getGitCheckpointIndexRootDir(): string {
  return join(getZCodeDataRootDir(), "git-checkpoint-index");
}

/** ~/.zcode/v2/tasks-index.sqlite */
export function getTasksIndexDatabasePath(): string {
  return join(getAppConfigDir(), "tasks-index.sqlite");
}

/** workspace 级身份键：远程优先使用 workspaceIdentity，本地回退 workspacePath。 */
function getWorkspaceKey(workspacePath: string, workspaceIdentity?: string): string {
  return workspaceIdentity?.trim() || workspacePath;
}

/** 与 ZCode session 持久化一致：使用 workspaceKey 的 SHA-256 前 12 位 */
export function getWorkspaceHash(workspacePath: string, workspaceIdentity?: string): string {
  return createHash("sha256")
    .update(getWorkspaceKey(workspacePath, workspaceIdentity))
    .digest("hex")
    .slice(0, 12);
}

/** ~/.zcode/v2/sessions/{workspaceHash} */
function getTaskSessionDir(workspacePath: string, workspaceIdentity?: string): string {
  return join(getAppConfigDir(), "sessions", getWorkspaceHash(workspacePath, workspaceIdentity));
}

/** ~/.zcode/v2/sessions/{workspaceHash}/{taskId}.json */
export function getLegacyTaskSessionSnapshotPath(
  workspacePath: string,
  taskId: string,
  workspaceIdentity?: string,
): string {
  return join(getTaskSessionDir(workspacePath, workspaceIdentity), `${taskId}.json`);
}

/** ~/.zcode/v2/sessions/{workspaceHash}/{taskId}.deleted.json */
export function getLegacyDeletedTaskSessionSnapshotPath(
  workspacePath: string,
  taskId: string,
  workspaceIdentity?: string,
): string {
  return join(getTaskSessionDir(workspacePath, workspaceIdentity), `${taskId}.deleted.json`);
}

/**
 * GLM（唯一 agent provider）的配置目录：~/.zcode/cli。
 * Bugfix：GLM 配置改为直接读写新版 zcode-cli 的全局配置目录，不做 workspace 隔离，
 * 避免同机不同工作区配置漂移。
 */
export function getProviderWorkspaceConfigDir(): string {
  const target = ZCODE_AGENT_RUNTIME.nativeConfigDir
    ? join(getDataBaseDir(), ZCODE_AGENT_RUNTIME.nativeConfigDir)
    : join(getDataBaseDir(), getAppDataDirName(), "cli");
  // El CLI viejo guardaba aquí su config global; se hereda una vez y no se vuelve a leer.
  migrateOnce(join(getDataBaseDir(), ".zcode", "cli"), target);
  return target;
}

/**
 * Copy the .zcode/v2 data directory from one base dir to another.
 * Excludes setting.json and its transient atomic-write siblings — bootstrap
 * state must only live at the default homedir location.
 */
export async function copyDataDirectory(oldBaseDir: string, newBaseDir: string): Promise<void> {
  const oldDir = join(oldBaseDir, getAppDataDirName(), "v2");
  const newDir = join(newBaseDir, getAppDataDirName(), "v2");
  await cp(oldDir, newDir, {
    recursive: true,
    force: false,
    filter: (source) => {
      const sourceName = basename(source);
      if (sourceName === "setting.json" || sourceName.startsWith("setting.json.")) {
        // setting.json.lock 和 setting.json.*.tmp 由原子写入短暂创建/删除，
        // 复制过程中扫描到已消失的 lock 会触发 ENOENT，并让数据目录迁移失败。
        // 这些文件都属于 bootstrap 写入中间态，不能迁移到新数据根。
        return false;
      }
      // Windows 非提权环境下 fs.cp 无法复制符号链接（EPERM）。
      // 跳过符号链接可避免 Windows 非提权环境下 fs.cp 报 EPERM。
      try {
        if (lstatSync(source).isSymbolicLink()) return false;
      } catch {
        // lstat 失败时放行，让 cp 自行处理
      }
      return true;
    },
  });
}
