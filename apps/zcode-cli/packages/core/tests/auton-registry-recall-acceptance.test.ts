// ============================================================
// Aceptación independiente — registro durable Nivel 1B
// ============================================================
// Escrito desde docs/private/registro-durable.md (Nivel 1A/1B) y la firma
// pública, sin leer la implementación del lector ni del handler.
// Cada prueba fija una promesa sobre fixtures reales en disco: plan.json,
// changes.jsonl y .auton/registry.jsonl.

import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AUTON_RECALL_TOOL_NAME,
  AutonRecallInputJsonSchema,
  AutonRecallInputSchema,
  AutonRecallOutputSchema,
  AutonRegistryEventSchema,
} from "@zcode/contracts";
import {
  formatAutonRegistryMatches,
  readAutonRegistry,
  searchAutonRegistry,
} from "../src/auton/registry.js";
import { appendRegistryRecord } from "../src/auton/registry-store.js";
import { autonRecallHandler, autonRecallToolEntry } from "../src/auton/recall-handler.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-recall-acceptance-"));
  workspaces.push(dir);
  return dir;
}

async function writeAutonFile(workspace: string, name: string, content: string): Promise<void> {
  const autonDir = join(workspace, ".auton");
  await mkdir(autonDir, { recursive: true });
  await writeFile(join(autonDir, name), content, "utf8");
}

async function writeJsonl(workspace: string, name: string, lines: readonly unknown[]): Promise<void> {
  const body = lines
    .map((line) => (typeof line === "string" ? line : JSON.stringify(line)))
    .join("\n");
  await writeAutonFile(workspace, name, `${body}\n`);
}

function context(workspace: string): ToolExecutionContext {
  return { workingDirectory: workspace, workspaceRoot: workspace } as unknown as ToolExecutionContext;
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
    limitHistory: [],
    limitReports: [],
    items: [
      {
        id: "s1",
        title: "Leer el diario de cambios",
        status: "running",
        owner: "programmer",
        files: ["src/login.ts"],
        evidence: [{ kind: "file", label: "diario legible", ref: "src/login.ts" }],
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

interface ChangeLine {
  at: string;
  agentId: string;
  sessionId: string;
  itemId?: string;
  path: string;
  before: string | null;
  after: string | null;
}

function changeLine(overrides: Partial<ChangeLine> & { path: string }): ChangeLine {
  return {
    at: "2026-11-04T10:00:00.000Z",
    agentId: "prog1",
    sessionId: "sess_auton_prog1",
    itemId: "s1",
    before: "linea antes\n",
    after: "linea despues\n",
    ...overrides,
  };
}

function durableDispatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "dispatch:7",
    at: "2026-11-04T10:30:00.000Z",
    kind: "dispatch" as const,
    title: "Despacho del sprint uno",
    summary: "prog1 tomo el item s1",
    refs: ["item:s1"],
    source: "dispatch:7",
    status: "running",
    agentId: "prog1",
    itemId: "s1",
    ...overrides,
  };
}

interface RecallOutput {
  text: string;
  matches: Array<Record<string, unknown>>;
  total: number;
  truncated: boolean;
}

async function recall(workspace: string, input: Record<string, unknown>): Promise<RecallOutput> {
  return (await autonRecallHandler(input, context(workspace))) as RecallOutput;
}

function printedLines(text: string): string[] {
  return text.split("\n").filter((line) => line.trim().length > 0);
}

/** Recorre el valor serializable y devuelve todas las claves encontradas. */
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

describe("registro durable Nivel 1B — aceptación", () => {
  it("un evento durable escrito con appendRegistryRecord aparece en readAutonRegistry", async () => {
    const workspace = await makeWorkspace();

    const appended = appendRegistryRecord(workspace, durableDispatch());
    expect(appended.appended).toBe(true);
    expect(AutonRegistryEventSchema.safeParse(appended.record).success).toBe(true);

    const snapshot = readAutonRegistry(workspace);
    const found = snapshot.records.filter((record) => record.id === "dispatch:7");

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: "dispatch:7",
      kind: "dispatch",
      title: "Despacho del sprint uno",
      summary: "prog1 tomo el item s1",
      refs: ["item:s1"],
      // La fuente la declara el escritor, no es la línea del archivo.
      source: "dispatch:7",
      status: "running",
      agentId: "prog1",
      itemId: "s1",
    });
  });

  it("un durable con id item:s1 reemplaza la ficha del plan y no queda duplicado", async () => {
    const workspace = await makeWorkspace();
    await writeAutonFile(workspace, "plan.json", JSON.stringify(planFixture()));

    const derived = readAutonRegistry(workspace).records.find((record) => record.id === "item:s1");
    expect(derived?.kind).toBe("sprint");
    expect(derived?.title).toBe("Leer el diario de cambios");

    appendRegistryRecord(
      workspace,
      durableDispatch({
        id: "item:s1",
        kind: "dispatch",
        title: "Leer el diario (version durable)",
        summary: "el orquestador despacho el item s1 a prog1",
        source: "dispatch:7",
      }),
    );

    const snapshot = readAutonRegistry(workspace);
    const sameId = snapshot.records.filter((record) => record.id === "item:s1");

    // Gana el durable y no se suma una segunda ficha con el mismo id.
    expect(sameId).toHaveLength(1);
    expect(sameId[0]?.kind).toBe("dispatch");
    expect(sameId[0]?.title).toBe("Leer el diario (version durable)");
    expect(sameId[0]?.source).toBe("dispatch:7");
  });

  it("busca por texto, id, referencia exacta y kind dispatch", async () => {
    const workspace = await makeWorkspace();
    await writeAutonFile(workspace, "plan.json", JSON.stringify(planFixture()));
    appendRegistryRecord(workspace, durableDispatch());
    appendRegistryRecord(
      workspace,
      durableDispatch({
        id: "dispatch:8",
        title: "Despacho del tablero",
        summary: "prog2 tomo el tablero de sprints",
        refs: ["item:s10"],
        source: "dispatch:8",
        agentId: "prog2",
        itemId: "s10",
      }),
    );

    const snapshot = readAutonRegistry(workspace);

    // "tablero" también aparece en el título del item:s10 del plan; se usa una
    // frase que solo vive en el resumen del durable para aislar el match.
    const byText = searchAutonRegistry(snapshot, { text: "prog2 tomo" });
    expect(byText.matches.map((match) => match.record.id)).toEqual(["dispatch:8"]);

    const byId = searchAutonRegistry(snapshot, { id: "dispatch:7" });
    expect(byId.matches.map((match) => match.record.id)).toEqual(["dispatch:7"]);

    // La referencia es exacta: item:s1 no debe arrastrar item:s10.
    const byRef = searchAutonRegistry(snapshot, { ref: "item:s1", limit: 20 });
    expect(byRef.matches.length).toBeGreaterThan(0);
    expect(byRef.matches.every((match) => match.record.refs.includes("item:s1"))).toBe(true);
    expect(byRef.matches.some((match) => match.record.id === "dispatch:8")).toBe(false);

    const byKind = searchAutonRegistry(snapshot, { kind: "dispatch", limit: 20 });
    expect(byKind.total).toBe(2);
    expect(byKind.matches).toHaveLength(2);
    expect(byKind.matches.every((match) => match.record.kind === "dispatch")).toBe(true);

    // El formato compacto conserva el tope y una línea por ficha.
    const formatted = formatAutonRegistryMatches(byKind);
    expect(printedLines(formatted).length).toBeLessThanOrEqual(2);
    expect(printedLines(formatted).every((line) => line.startsWith("- "))).toBe(true);
  });

  it("AutonRecall con query devuelve texto, matches, total y truncated; default 5 líneas", async () => {
    const workspace = await makeWorkspace();
    for (let index = 1; index <= 8; index += 1) {
      appendRegistryRecord(
        workspace,
        durableDispatch({
          id: `dispatch:${index}`,
          title: `Despacho memoria-fria ${index}`,
          summary: `memoria-fria intento ${index}`,
          source: `dispatch:${index}`,
        }),
      );
    }

    const output = await recall(workspace, { query: "memoria-fria" });

    expect(AutonRecallOutputSchema.safeParse(output).success).toBe(true);
    expect(output.total).toBe(8);
    expect(output.matches).toHaveLength(5); // 5 por defecto
    expect(output.truncated).toBe(true);
    expect(printedLines(output.text)).toHaveLength(5);
    expect(output.text).not.toContain("\n\n");
    expect(output.text).toContain("[dispatch]");
    expect(output.text).toMatch(/dispatch:\d+/);
    expect(output.matches.every((match) => match.kind === "dispatch")).toBe(true);
  });

  it("el texto nunca supera limit líneas y limit 20 se acepta", async () => {
    const workspace = await makeWorkspace();
    for (let index = 1; index <= 8; index += 1) {
      appendRegistryRecord(
        workspace,
        durableDispatch({
          id: `dispatch:${index}`,
          title: `Despacho memoria-tibia ${index}`,
          summary: `memoria-tibia intento ${index}`,
          source: `dispatch:${index}`,
        }),
      );
    }

    const small = await recall(workspace, { query: "memoria-tibia", limit: 2 });
    expect(small.matches).toHaveLength(2);
    expect(small.total).toBe(8);
    expect(small.truncated).toBe(true);
    expect(printedLines(small.text)).toHaveLength(2);

    const wide = await recall(workspace, { query: "memoria-tibia", limit: 20 });
    expect(wide.matches).toHaveLength(8);
    expect(wide.total).toBe(8);
    expect(wide.truncated).toBe(false);
    expect(printedLines(wide.text)).toHaveLength(8);
  });

  it("sin selector falla la validación y limit fuera de 1..20 se rechaza", () => {
    // Sin query/id/ref/kind no se adivina: la validación falla.
    expect(AutonRecallInputSchema.safeParse({}).success).toBe(false);
    expect(AutonRecallInputSchema.safeParse({ limit: 5 }).success).toBe(false);

    expect(AutonRecallInputSchema.safeParse({ query: "algo", limit: 50 }).success).toBe(false);
    expect(AutonRecallInputSchema.safeParse({ query: "algo", limit: 0 }).success).toBe(false);
    expect(AutonRecallInputSchema.safeParse({ query: "algo", limit: 21 }).success).toBe(false);
    expect(AutonRecallInputSchema.safeParse({ query: "algo", limit: 5.5 }).success).toBe(false);
    expect(AutonRecallInputSchema.safeParse({ query: "algo", limit: 20 }).success).toBe(true);
    expect(AutonRecallInputSchema.safeParse({ query: "algo", limit: 1 }).success).toBe(true);

    // Cada selector por sí solo alcanza.
    expect(AutonRecallInputSchema.safeParse({ id: "item:s1" }).success).toBe(true);
    expect(AutonRecallInputSchema.safeParse({ ref: "item:s1" }).success).toBe(true);
    expect(AutonRecallInputSchema.safeParse({ kind: "dispatch" }).success).toBe(true);

    // El esquema público de entrada para el modelo también existe.
    expect(AutonRecallInputJsonSchema).toBeTruthy();
  });

  it("un workspace vacío devuelve texto de sin recuerdos, matches [] y total 0", async () => {
    const workspace = await makeWorkspace();

    const output = await recall(workspace, { query: "algo que no paso" });

    expect(output.matches).toEqual([]);
    expect(output.total).toBe(0);
    expect(output.truncated).toBe(false);
    expect(output.text.trim().length).toBeGreaterThan(0);
    expect(output.text).toMatch(/sin recuerdos|no hay recuerdos|sin resultados|no encontr/i);
    // El aviso de vacío es una línea informativa, no una ficha con "- ".
    const lines = printedLines(output.text);
    expect(lines.length).toBeLessThanOrEqual(1);
    expect(lines.some((line) => line.startsWith("- "))).toBe(false);
    expect(AutonRecallOutputSchema.safeParse(output).success).toBe(true);
  });

  it("el output no expone before/after ni el contenido de los archivos", async () => {
    const workspace = await makeWorkspace();
    const secretBefore = "SECRETO_ANTES_no_debe_salir_1234567890";
    const secretAfter = "SECRETO_DESPUES_no_debe_salir_0987654321";
    await writeJsonl(workspace, "changes.jsonl", [
      changeLine({ path: "src/secreto.ts", before: secretBefore, after: secretAfter }),
    ]);
    appendRegistryRecord(
      workspace,
      durableDispatch({
        title: "Despacho seguro",
        summary: "prog1 trabajo en src/secreto.ts sin filtrar contenido",
      }),
    );

    const snapshot = readAutonRegistry(workspace);
    const snapshotJson = JSON.stringify(snapshot);
    expect(snapshotJson).not.toContain(secretBefore);
    expect(snapshotJson).not.toContain(secretAfter);

    const output = await recall(workspace, { query: "secreto" });
    const outputJson = JSON.stringify(output);

    expect(outputJson).not.toContain(secretBefore);
    expect(outputJson).not.toContain(secretAfter);
    expect(output.text).not.toContain("SECRETO_ANTES");
    expect(output.text).not.toContain("SECRETO_DESPUES");
    expect(output.matches.length).toBeGreaterThan(0);

    const keys = collectKeys(output);
    expect(keys).not.toContain("before");
    expect(keys).not.toContain("after");
    expect(keys).not.toContain("beforeBase64");
    expect(keys).not.toContain("afterBase64");
  });

  it("expone metadatos de lectura y concurrencia segura, con el nombre público", () => {
    expect(AUTON_RECALL_TOOL_NAME).toBe("AutonRecall");
    expect(autonRecallToolEntry.metadata.name).toBe(AUTON_RECALL_TOOL_NAME);
    expect(autonRecallToolEntry.metadata.readOnly).toBe(true);
    expect(autonRecallToolEntry.metadata.concurrentSafe).toBe(true);
    expect(autonRecallToolEntry.metadata.needsApproval).toBe(false);
    expect(autonRecallToolEntry.inputSchema).toBeTruthy();
    expect(autonRecallToolEntry.runtimeInputSchema).toBeTruthy();
  });

  it("propaga la advertencia malformed_line del log durable sin tumbar el resto", async () => {
    const workspace = await makeWorkspace();
    appendRegistryRecord(workspace, durableDispatch());
    await appendFile(join(workspace, ".auton", "registry.jsonl"), "esto no es json\n", "utf8");

    const snapshot = readAutonRegistry(workspace);

    // El evento sano sigue leyéndose.
    expect(snapshot.records.map((record) => record.id)).toContain("dispatch:7");

    // La línea corrupta del log durable se reporta como malformed_line.
    const warnings = (snapshot.warnings ?? []) as Array<{ code?: string; source?: string }>;
    expect(warnings.some((warning) => warning.code === "malformed_line")).toBe(true);
    expect(JSON.stringify(warnings)).toMatch(/registry\.jsonl/i);

    // También una búsqueda sigue funcionando sobre el resto.
    const found = searchAutonRegistry(snapshot, { id: "dispatch:7" });
    expect(found.matches.map((match) => match.record.id)).toEqual(["dispatch:7"]);
  });
});
