// ============================================================
// Registro del proyecto: escaneo determinista y análisis del worker
// ============================================================
// Lo barato se hace sin modelo: al crear el proyecto se cuentan archivos, se
// detecta el stack por los manifiestos y se listan los archivos clave. Eso
// queda en `.auton/project.json` y el prompt del orquestador lo lee.
// El análisis profundo lo escribe el worker de solo lectura en
// `.auton/project-analysis.md`; una vez guardado no se vuelve a pedir.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const AUTON_REGISTRY_DIR = ".auton";
export const PROJECT_FACTS_FILE = "project.json";
export const PROJECT_ANALYSIS_FILE = "project-analysis.md";
export const PROJECT_FACTS_VERSION = 1 as const;

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".auton",
  "dist",
  "dist-types",
  "build",
  "out",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "target",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  ".idea",
  ".vscode",
  "tmp",
]);

const MANIFEST_STACKS: ReadonlyArray<{ files: readonly string[]; stack: string }> = [
  { files: ["package.json"], stack: "node" },
  { files: ["tsconfig.json"], stack: "typescript" },
  { files: ["pnpm-workspace.yaml"], stack: "pnpm-workspace" },
  { files: ["pnpm-lock.yaml"], stack: "pnpm" },
  { files: ["package-lock.json"], stack: "npm" },
  { files: ["yarn.lock"], stack: "yarn" },
  { files: ["bun.lockb", "bun.lock"], stack: "bun" },
  { files: ["pyproject.toml", "requirements.txt"], stack: "python" },
  { files: ["Cargo.toml"], stack: "rust" },
  { files: ["go.mod"], stack: "go" },
  { files: ["pubspec.yaml"], stack: "flutter" },
  { files: ["build.gradle", "build.gradle.kts"], stack: "android" },
  { files: ["docker-compose.yml", "docker-compose.yaml", "Dockerfile"], stack: "docker" },
  { files: ["Makefile"], stack: "make" },
];

const DEPENDENCY_STACKS: ReadonlyArray<{ dependency: string; stack: string }> = [
  { dependency: "react", stack: "react" },
  { dependency: "next", stack: "next" },
  { dependency: "vue", stack: "vue" },
  { dependency: "svelte", stack: "svelte" },
  { dependency: "@angular/core", stack: "angular" },
  { dependency: "react-native", stack: "react-native" },
  { dependency: "expo", stack: "expo" },
  { dependency: "electron", stack: "electron" },
  { dependency: "vite", stack: "vite" },
  { dependency: "tailwindcss", stack: "tailwind" },
  { dependency: "express", stack: "express" },
  { dependency: "fastify", stack: "fastify" },
  { dependency: "typescript", stack: "typescript" },
];

const KEY_FILE_CANDIDATES = [
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "tsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "README.md",
  "README",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "Makefile",
  "Dockerfile",
  "docker-compose.yml",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pubspec.yaml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  ".env.example",
] as const;

const KEY_DIRECTORIES = [
  "src",
  "app",
  "pages",
  "lib",
  "components",
  "packages",
  "apps",
  "docs",
  "test",
  "tests",
] as const;

export interface ProjectScan {
  version: typeof PROJECT_FACTS_VERSION;
  root: string;
  scannedAt: string;
  stack: string[];
  fileCount: number;
  totalBytes: number;
  keyFiles: string[];
  topDirectories: string[];
}

export interface ProjectAnalysis {
  at: string;
  summary: string;
}

export interface ProjectFacts {
  scan: ProjectScan;
  analysis?: ProjectAnalysis;
}

export interface ScanOptions {
  maxDepth?: number;
  maxEntries?: number;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readPackageDependencies(root: string): Set<string> {
  const names = new Set<string>();
  const path = join(root, "package.json");
  if (!existsSync(path)) return names;
  try {
    const raw = readFileSync(path, "utf8");
    if (raw.length > 256 * 1024) return names;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      const value = parsed[field];
      if (typeof value !== "object" || value === null) continue;
      for (const name of Object.keys(value)) names.add(name);
    }
  } catch {
    // Un manifiesto roto no puede romper el escaneo.
  }
  return names;
}

function detectStack(root: string, keyFiles: readonly string[]): string[] {
  const present = new Set(keyFiles);
  const stack = new Set<string>();
  for (const entry of MANIFEST_STACKS) {
    if (entry.files.some((file) => present.has(file))) stack.add(entry.stack);
  }
  const dependencies = readPackageDependencies(root);
  for (const entry of DEPENDENCY_STACKS) {
    if (dependencies.has(entry.dependency)) stack.add(entry.stack);
  }
  return [...stack].sort();
}

function scanTree(
  root: string,
  options: ScanOptions,
): { fileCount: number; totalBytes: number; topDirectories: string[] } {
  const maxDepth = options.maxDepth ?? 6;
  const maxEntries = options.maxEntries ?? 6000;
  let fileCount = 0;
  let totalBytes = 0;
  let seen = 0;
  const topDirectories: string[] = [];
  const queue: Array<{ path: string; depth: number; relative: string }> = [
    { path: root, depth: 0, relative: "" },
  ];

  while (queue.length > 0 && seen < maxEntries) {
    const current = queue.shift()!;
    let entries;
    try {
      entries = readdirSync(current.path, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (seen >= maxEntries) break;
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        if (current.depth === 0 && !entry.name.startsWith(".")) topDirectories.push(entry.name);
        if (current.depth + 1 > maxDepth) continue;
        queue.push({
          path: join(current.path, entry.name),
          depth: current.depth + 1,
          relative: current.relative ? `${current.relative}/${entry.name}` : entry.name,
        });
        continue;
      }
      if (!entry.isFile()) continue;
      seen += 1;
      fileCount += 1;
      try {
        totalBytes += statSync(join(current.path, entry.name)).size;
      } catch {
        // El archivo pudo desaparecer durante el escaneo; no altera el conteo.
      }
    }
  }

  topDirectories.sort((left, right) => left.localeCompare(right));
  return { fileCount, totalBytes, topDirectories };
}

function detectKeyFiles(root: string, topDirectories: readonly string[]): string[] {
  const keyFiles = KEY_FILE_CANDIDATES.filter((file) => existsSync(join(root, file)));
  const keyDirectories = KEY_DIRECTORIES.filter((directory) =>
    topDirectories.includes(directory),
  ).map((directory) => `${directory}/`);
  return [...keyFiles, ...keyDirectories];
}

/** Escanea el proyecto sin modelo: stack, tamaño, archivos y carpetas clave. */
export function scanProject(root: string, options: ScanOptions = {}): ProjectScan {
  if (!isDirectory(root)) {
    return {
      version: PROJECT_FACTS_VERSION,
      root,
      scannedAt: new Date().toISOString(),
      stack: [],
      fileCount: 0,
      totalBytes: 0,
      keyFiles: [],
      topDirectories: [],
    };
  }
  const { fileCount, totalBytes, topDirectories } = scanTree(root, options);
  const keyFiles = detectKeyFiles(root, topDirectories);
  return {
    version: PROJECT_FACTS_VERSION,
    root,
    scannedAt: new Date().toISOString(),
    stack: detectStack(root, keyFiles),
    fileCount,
    totalBytes,
    keyFiles,
    topDirectories,
  };
}

export function projectFactsPath(root: string): string {
  return join(root, AUTON_REGISTRY_DIR, PROJECT_FACTS_FILE);
}

export function projectAnalysisPath(root: string): string {
  return join(root, AUTON_REGISTRY_DIR, PROJECT_ANALYSIS_FILE);
}

function readScan(root: string): ProjectScan | undefined {
  const path = projectFactsPath(root);
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ProjectScan>;
    if (parsed.version !== PROJECT_FACTS_VERSION || typeof parsed.root !== "string") {
      return undefined;
    }
    return parsed as ProjectScan;
  } catch {
    return undefined;
  }
}

function writeScan(scan: ProjectScan): void {
  try {
    mkdirSync(join(scan.root, AUTON_REGISTRY_DIR), { recursive: true });
    writeFileSync(projectFactsPath(scan.root), `${JSON.stringify(scan, null, 2)}\n`, "utf8");
  } catch {
    // El registro es una ayuda, no un requisito para abrir el proyecto.
  }
}

function readAnalysis(root: string): ProjectAnalysis | undefined {
  const path = projectAnalysisPath(root);
  if (!existsSync(path)) return undefined;
  try {
    const summary = readFileSync(path, "utf8").trim();
    if (!summary) return undefined;
    const at = statSync(path).mtime.toISOString();
    return { at, summary: summary.length > 6000 ? `${summary.slice(0, 6000)}…` : summary };
  } catch {
    return undefined;
  }
}

/**
 * Lee el registro del proyecto. Si no hay escaneo (proyecto anterior a esta
 * capacidad), lo hace una vez y lo guarda. Determinista y sin modelo.
 */
export function ensureProjectFacts(root: string): ProjectFacts | undefined {
  if (!root || !isDirectory(root)) return undefined;
  const existing = readScan(root);
  const scan = existing ?? scanProject(root);
  if (!existing) writeScan(scan);
  const analysis = readAnalysis(root);
  return { scan, ...(analysis ? { analysis } : {}) };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Texto que entra en el prompt del orquestador. Incluye la regla del análisis
 * pendiente o la constancia de que ya está guardado.
 */
export function renderProjectFactsForPrompt(facts: ProjectFacts): string {
  const { scan, analysis } = facts;
  const lines = [
    "## Lo que ya sabes del proyecto",
    "",
    `- Raíz: ${scan.root}`,
    `- Stack: ${scan.stack.length > 0 ? scan.stack.join(", ") : "sin manifiestos reconocidos"}`,
    `- Tamaño: ${scan.fileCount} archivos, ${formatBytes(scan.totalBytes)}`,
    `- Archivos clave: ${scan.keyFiles.length > 0 ? scan.keyFiles.join(", ") : "ninguno en la raíz"}`,
    `- Carpetas de primer nivel: ${scan.topDirectories.length > 0 ? scan.topDirectories.join(", ") : "ninguna"}`,
  ];
  if (analysis) {
    lines.push(
      `- Análisis guardado (${analysis.at.slice(0, 10)}), ya está en el registro: no lo vuelvas a pedir.`,
      "",
      "Resumen del análisis previo:",
      "",
      ...analysis.summary.split("\n").map((line) => `> ${line}`),
    );
  } else {
    lines.push(
      "- Falta el análisis del proyecto. En la primera petición real, avisa (\"voy a revisar qué guarda el proyecto y preparar un plan\") y manda un worker de solo lectura; guarda su resumen y sus rutas en `.auton/project-analysis.md` con Write. Después no lo pidas otra vez.",
    );
  }
  return lines.join("\n");
}
