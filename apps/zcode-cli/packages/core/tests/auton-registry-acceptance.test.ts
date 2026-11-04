// ============================================================
// Aceptación independiente — registro durable de Auton (Nivel 0)
// ============================================================
// Escrito desde docs/private/registro-durable.md y la firma pública, sin leer
// la implementación. Cada prueba fija una promesa del Nivel 0 sobre fixtures
// reales en disco: plan.json, changes.jsonl y reverts.jsonl.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatAutonRegistryMatches,
  readAutonRegistry,
  searchAutonRegistry,
  verifyAutonRegistry,
} from "../src/auton/registry.js";

const workspaces: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-registry-acceptance-"));
  workspaces.push(dir);
  return dir;
}

async function writeAutonFile(workspace: string, name: string, content: string): Promise<void> {
  const autonDir = join(workspace, ".auton");
  await mkdir(autonDir, { recursive: true });
  await writeFile(join(autonDir, name), content, "utf8");
}

async function writeJsonl(workspace: string, name: string, lines: readonly unknown[]): Promise<void> {
  const body = lines.map((line) => (typeof line === "string" ? line : JSON.stringify(line))).join("\n");
  await writeAutonFile(workspace, name, `${body}\n`);
}

interface ChangeLine {
  at: string;
  agentId: string;
  sessionId: string;
  itemId?: string;
  path: string;
  before: string | null;
  after: string | null;
}

// 120 B antes y 160 B después, como en el ejemplo de la spec.
const BEFORE_120 = `${"x".repeat(119)}\n`;
const AFTER_160 = `${"y".repeat(159)}\n`;

function changeLine(overrides: Partial<ChangeLine> & { path: string }): ChangeLine {
  return {
    at: "2026-11-04T10:00:00.000Z",
    agentId: "prog1",
    sessionId: "sess_auton_prog1",
    itemId: "s1",
    before: BEFORE_120,
    after: AFTER_160,
    ...overrides,
  };
}

function planFixture() {
  return {
    version: 1,
    goal: {
      title: "Registro durable de Auton",
      statement: "Leer el expediente sin tocar la UI",
      constraints: ["sin escritura"],
      done: ["se puede buscar por ficha"],
    },
    limits: {
      version: 1,
      maxAttempts: 3,
      approval: {
        deleteMove: true,
        outsideProject: true,
        pushMergeRebase: true,
        installDependencies: true,
        outsideScope: true,
      },
      unknownHandling: "wait",
    },
    limitHistory: [
      {
        at: "2026-11-01T09:00:00.000Z",
        field: "maxAttempts",
        from: "2",
        to: "3",
        reason: "el sprint necesitaba un reintento más",
        approvedBy: "human",
      },
    ],
    limitReports: [
      {
        at: "2026-11-02T09:00:00.000Z",
        field: "maxAttempts",
        observed: "se agotaron los intentos en una tarea de lectura",
        expected: "4",
        by: "prog1",
      },
    ],
    items: [
      {
        id: "s1",
        title: "Leer el diario de cambios",
        status: "running",
        owner: "programmer",
        files: ["src/login.ts"],
        evidence: [
          { kind: "file", label: "diario legible", ref: "src/login.ts" },
        ],
      },
      {
        id: "s10",
        title: "Tablero de sprints",
        status: "ready",
      },
    ],
    updatedAt: "2026-11-03T09:00:00.000Z",
  };
}

function revertFixture() {
  return {
    at: "2026-11-04T11:00:00.000Z",
    selection: { agentId: "prog1", paths: ["src/login.ts"] },
    files: [{ path: "src/login.ts", outcome: "restored" }],
  };
}

/** Recorre el snapshot serializable y devuelve todas las claves encontradas. */
function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key);
      collectKeys(entry, keys);
    }
  }
  return keys;
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("registro durable Nivel 0 — aceptación", () => {
  it("un workspace sin .auton no inventa fichas", async () => {
    const workspace = await makeWorkspace();

    const snapshot = readAutonRegistry(workspace);

    expect(snapshot.records).toEqual([]);
    expect(snapshot.warnings ?? []).toEqual([]);
    expect(verifyAutonRegistry(snapshot).ok).toBe(true);
  });

  it("convierte plan, cambios y reversión en fichas enlazadas", async () => {
    const workspace = await makeWorkspace();
    await writeAutonFile(workspace, "plan.json", JSON.stringify(planFixture()));
    await writeJsonl(workspace, "changes.jsonl", [
      changeLine({ path: "src/login.ts" }),
      changeLine({ path: "src/dashboard.tsx", itemId: "s10", before: null, after: "export {};\n" }),
    ]);
    await writeJsonl(workspace, "reverts.jsonl", [revertFixture()]);

    const snapshot = readAutonRegistry(workspace, new Date("2026-11-04T12:00:00.000Z"));
    const ids = snapshot.records.map((record) => record.id);

    // Goal e items del plan.
    expect(ids).toContain("goal");
    expect(ids).toContain("item:s1");
    expect(ids).toContain("item:s10");
    expect(snapshot.records.find((record) => record.id === "item:s1")?.kind).toBe("sprint");
    expect(snapshot.records.find((record) => record.id === "item:s1")?.title).toBe(
      "Leer el diario de cambios",
    );

    // Historial y reportes de límites.
    expect(ids.some((id) => id.startsWith("decision:limit:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("report:limit:"))).toBe(true);

    // Evidencia del item.
    expect(ids.some((id) => id.startsWith("artifact:s1:"))).toBe(true);

    // Cambios y reversión, con id por línea del JSONL.
    expect(ids).toContain("change:1");
    expect(ids).toContain("change:2");
    expect(ids).toContain("revert:1");

    const firstChange = snapshot.records.find((record) => record.id === "change:1");
    expect(firstChange?.kind).toBe("change");
    expect(firstChange?.itemId).toBe("s1");
    expect(firstChange?.agentId).toBe("prog1");
    expect(firstChange?.refs).toContain("item:s1");

    const revert = snapshot.records.find((record) => record.id === "revert:1");
    expect(revert?.kind).toBe("revert");
    expect(revert?.paths ?? []).toContain("src/login.ts");
    expect((revert?.refs ?? []).length).toBeGreaterThan(0);

    // El resumen de un cambio es una línea con ruta, tamaños y huella.
    expect(firstChange?.summary).not.toContain("\n");
    expect(firstChange?.summary).toContain("src/login.ts");
    expect(firstChange?.summary).toContain("120");
    expect(firstChange?.summary).toContain("160");
    expect(firstChange?.summary).toMatch(/[0-9a-f]{8}/i);

    // Un fixture sano no debe reportar problemas.
    expect(verifyAutonRegistry(snapshot).issues).toEqual([]);
  });

  it("busca por texto, id, referencia y tipo", async () => {
    const workspace = await makeWorkspace();
    await writeAutonFile(workspace, "plan.json", JSON.stringify(planFixture()));
    await writeJsonl(workspace, "changes.jsonl", [
      changeLine({ path: "src/login.ts" }),
      changeLine({ path: "src/dashboard.tsx", itemId: "s10", before: null, after: "export {};\n" }),
    ]);
    const snapshot = readAutonRegistry(workspace);

    const byText = searchAutonRegistry(snapshot, { text: "diario" });
    expect(byText.matches.some((match) => match.record.id === "item:s1")).toBe(true);

    const byId = searchAutonRegistry(snapshot, { id: "item:s10" });
    expect(byId.matches.map((match) => match.record.id)).toEqual(["item:s10"]);

    const byKind = searchAutonRegistry(snapshot, { kind: "change", limit: 20 });
    expect(byKind.total).toBe(2);
    expect(byKind.matches).toHaveLength(2);
    expect(byKind.matches.every((match) => match.record.kind === "change")).toBe(true);

    // La referencia es coincidencia exacta, no prefijo: item:s1 no matchea item:s10.
    const byRef = searchAutonRegistry(snapshot, { ref: "item:s1", limit: 20 });
    expect(byRef.matches.length).toBeGreaterThan(0);
    expect(byRef.matches.every((match) => match.record.refs.includes("item:s1"))).toBe(true);
    expect(byRef.matches.some((match) => match.record.id === "change:2")).toBe(false);
  });

  it("respeta el tope de 5 por defecto y el máximo de 20", async () => {
    const workspace = await makeWorkspace();
    const lines = Array.from({ length: 25 }, (_, index) =>
      changeLine({
        path: `src/bulk/file-${String(index).padStart(2, "0")}.ts`,
        itemId: "s1",
      }),
    );
    await writeJsonl(workspace, "changes.jsonl", lines);
    const snapshot = readAutonRegistry(workspace);

    const defaulted = searchAutonRegistry(snapshot, { text: "bulk" });
    expect(defaulted.total).toBe(25);
    expect(defaulted.matches).toHaveLength(5);
    expect(defaulted.truncated).toBe(true);

    const hardCap = searchAutonRegistry(snapshot, { text: "bulk", limit: 100 });
    expect(hardCap.matches).toHaveLength(20);
    expect(hardCap.truncated).toBe(true);

    const small = searchAutonRegistry(snapshot, { text: "bulk", limit: 3 });
    expect(small.matches).toHaveLength(3);
    expect(small.truncated).toBe(true);

    // El formato no imprime más líneas que el límite pedido.
    const formatted = formatAutonRegistryMatches(small);
    const printed = formatted.split("\n").filter((line) => line.trim().length > 0);
    expect(printed.length).toBeLessThanOrEqual(3);
    expect(printed.every((line) => line.trimStart().startsWith("-"))).toBe(true);
  });

  it("una línea corrupta no tumba el resto y produce advertencia", async () => {
    const workspace = await makeWorkspace();
    await writeJsonl(workspace, "changes.jsonl", [
      changeLine({ path: "src/uno.ts" }),
      "{ esto no es json",
      changeLine({ path: "src/tres.ts" }),
    ]);

    const snapshot = readAutonRegistry(workspace);
    const ids = snapshot.records.map((record) => record.id);

    expect(ids).toEqual(["change:1", "change:3"]);
    expect(verifyAutonRegistry(snapshot).issues.some((issue) => issue.code === "malformed_line")).toBe(
      true,
    );

    const warningText = JSON.stringify(snapshot.warnings);
    expect(warningText).toMatch(/changes\.jsonl/i);
    expect(warningText).toMatch(/malformed|corrupt|json|inválid|invalid/i);
  });

  it("un plan corrupto no tumba el diario", async () => {
    const workspace = await makeWorkspace();
    await writeAutonFile(workspace, "plan.json", "{ esto no es un plan");
    await writeJsonl(workspace, "changes.jsonl", [changeLine({ path: "src/survive.ts" })]);

    const snapshot = readAutonRegistry(workspace);
    const ids = snapshot.records.map((record) => record.id);

    expect(ids).toContain("change:1");
    expect(ids).not.toContain("goal");

    const verification = verifyAutonRegistry(snapshot);
    expect(verification.ok).toBe(false);
    expect(verification.issues.some((issue) => issue.code === "invalid_plan")).toBe(true);
  });

  it("detecta ids duplicados", async () => {
    const workspace = await makeWorkspace();
    const plan = planFixture();
    plan.items = [
      { id: "s1", title: "Primera versión", status: "ready" },
      { id: "s1", title: "Segunda versión", status: "done" },
    ];
    await writeAutonFile(workspace, "plan.json", JSON.stringify(plan));

    const snapshot = readAutonRegistry(workspace);
    const duplicated = snapshot.records.filter((record) => record.id === "item:s1");
    expect(duplicated).toHaveLength(2);

    const verification = verifyAutonRegistry(snapshot);
    expect(verification.ok).toBe(false);
    expect(verification.issues.some((issue) => issue.code === "duplicate_id")).toBe(true);
  });

  it("detecta referencias rotas", async () => {
    const workspace = await makeWorkspace();
    await writeJsonl(workspace, "changes.jsonl", [
      changeLine({ path: "src/huerfano.ts", itemId: "s99" }),
    ]);

    const snapshot = readAutonRegistry(workspace);
    expect(snapshot.records.map((record) => record.id)).toContain("change:1");

    const verification = verifyAutonRegistry(snapshot);
    expect(verification.ok).toBe(false);
    const broken = verification.issues.filter((issue) => issue.code === "broken_ref");
    expect(broken.length).toBeGreaterThan(0);
    expect(broken.some((issue) => issue.source.includes("changes.jsonl"))).toBe(true);
  });

  it("no expone el contenido before/after en el snapshot serializado", async () => {
    const workspace = await makeWorkspace();
    const secretBefore = "SECRETO_ANTES_no_debe_salir_1234567890";
    const secretAfter = "SECRETO_DESPUES_no_debe_salir_0987654321";
    await writeJsonl(workspace, "changes.jsonl", [
      changeLine({ path: "src/secreto.ts", before: secretBefore, after: secretAfter }),
    ]);

    const snapshot = readAutonRegistry(workspace);
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain(secretBefore);
    expect(serialized).not.toContain(secretAfter);
    expect(serialized).not.toContain("SECRETO_ANTES");
    expect(serialized).not.toContain("SECRETO_DESPUES");

    const keys = collectKeys(snapshot);
    expect(keys).not.toContain("before");
    expect(keys).not.toContain("after");
    expect(keys).not.toContain("beforeBase64");
    expect(keys).not.toContain("afterBase64");
  });
});
