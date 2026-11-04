// ============================================================
// Registro durable de Auton — lectura del log y herramienta (Nivel 1B)
// ============================================================
// Fija las promesas del nivel: el lector incluye .auton/registry.jsonl, lo
// durable gana por id, la búsqueda lo encuentra y AutonRecall responde con
// punteros y un tope duro, sin exponer contenido de archivos.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AUTON_RECALL_TOOL_NAME,
  AutonRecallInputSchema,
  AutonRecallOutputSchema,
  type AutonRegistryAppendInput,
} from "@zcode/contracts";
import { readAutonRegistry, searchAutonRegistry } from "../src/auton/registry.js";
import { appendRegistryRecord, registryLogPath } from "../src/auton/registry-store.js";
import { autonRecallHandler, autonRecallToolEntry } from "../src/auton/recall-handler.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];
const FIXED_AT = "2026-11-04T12:00:00.000Z";

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-registry-recall-"));
  workspaces.push(dir);
  return dir;
}

function context(workspaceRoot: string): ToolExecutionContext {
  return {
    workingDirectory: workspaceRoot,
    workspaceRoot,
    sessionId: "sess_orchestrator",
  } as unknown as ToolExecutionContext;
}

function event(overrides: Partial<AutonRegistryAppendInput> = {}): AutonRegistryAppendInput {
  return {
    at: FIXED_AT,
    kind: "decision",
    title: "Evento durable",
    summary: "Una línea del registro durable",
    refs: [],
    source: "test:seed",
    ...overrides,
  };
}

function seedEvent(
  root: string,
  overrides: Partial<AutonRegistryAppendInput> = {},
): void {
  const result = appendRegistryRecord(root, event(overrides));
  if (!result.appended) {
    throw new Error(`no se pudo sembrar el evento ${overrides.id ?? "(autogenerado)"}`);
  }
}

async function writeAutonFile(
  root: string,
  name: string,
  content: string,
): Promise<void> {
  const dir = join(root, ".auton");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), content, "utf8");
}

function planFixture(): unknown {
  return {
    version: 1,
    goal: { title: "Memoria durable de Auton" },
    items: [{ id: "s1", title: "Ficha derivada del plan", status: "ready" }],
  };
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Auton registry read — log durable (Nivel 1B)", () => {
  it("incluye un evento durable de registry.jsonl", async () => {
    const root = await workspace();
    seedEvent(root, {
      id: "dispatch:1",
      kind: "dispatch",
      title: "Despacho a prog1",
      summary: "El item s1 arrancó con prog1",
      refs: ["item:s1"],
      source: "dispatch:1",
    });

    const snapshot = readAutonRegistry(root);
    const record = snapshot.records.find((entry) => entry.id === "dispatch:1");

    expect(record).toBeDefined();
    expect(record?.kind).toBe("dispatch");
    expect(record?.source).toBe("dispatch:1");
    expect(record?.refs).toContain("item:s1");
  });

  it("un evento durable con el mismo id reemplaza la ficha derivada sin duplicarse", async () => {
    const root = await workspace();
    await writeAutonFile(root, "plan.json", JSON.stringify(planFixture()));
    seedEvent(root, {
      id: "item:s1",
      kind: "sprint",
      title: "Ficha durable del item",
      summary: "El log durable es la última palabra",
      refs: ["goal"],
      source: "dispatch:item:s1",
    });

    const snapshot = readAutonRegistry(root);
    const matches = snapshot.records.filter((entry) => entry.id === "item:s1");

    expect(matches).toHaveLength(1);
    expect(matches[0]?.title).toBe("Ficha durable del item");
    expect(matches[0]?.source).toBe("dispatch:item:s1");
  });

  it("la búsqueda encuentra el evento durable por texto, id, ref y kind", async () => {
    const root = await workspace();
    seedEvent(root, {
      id: "dispatch:7",
      kind: "dispatch",
      title: "Despacho del login",
      summary: "prog1 arrancó el trabajo del login",
      refs: ["item:s1"],
      source: "dispatch:7",
    });
    const snapshot = readAutonRegistry(root);

    const byText = searchAutonRegistry(snapshot, { text: "login" });
    expect(byText.matches.map((match) => match.record.id)).toContain("dispatch:7");

    const byId = searchAutonRegistry(snapshot, { id: "dispatch:7" });
    expect(byId.matches.map((match) => match.record.id)).toEqual(["dispatch:7"]);

    const byRef = searchAutonRegistry(snapshot, { ref: "item:s1" });
    expect(byRef.matches.map((match) => match.record.id)).toContain("dispatch:7");

    const byKind = searchAutonRegistry(snapshot, { kind: "dispatch" });
    expect(byKind.matches.map((match) => match.record.id)).toEqual(["dispatch:7"]);
  });

  it("propaga las advertencias del log al snapshot", async () => {
    const root = await workspace();
    seedEvent(root, { id: "dispatch:ok", kind: "dispatch", source: "dispatch:ok" });
    const raw = await readFile(registryLogPath(root), "utf8");
    await writeFile(registryLogPath(root), `{no es json}\n${raw}`, "utf8");

    const snapshot = readAutonRegistry(root);

    expect(snapshot.records.some((record) => record.id === "dispatch:ok")).toBe(true);
    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "malformed_line" })]),
    );
  });
});

describe("AutonRecall tool (Nivel 1B)", () => {
  it("devuelve texto con punteros y como máximo limit líneas", async () => {
    const root = await workspace();
    for (let index = 0; index < 7; index += 1) {
      seedEvent(root, {
        id: `dispatch:${index + 1}`,
        kind: "dispatch",
        title: `Despacho ${index + 1}`,
        summary: `memoria durable ${index + 1}`,
        source: `dispatch:${index + 1}`,
      });
    }

    const output = await autonRecallHandler(
      { query: "memoria", limit: 3 },
      context(root),
    );

    expect(output.matches).toHaveLength(3);
    expect(output.total).toBe(7);
    expect(output.truncated).toBe(true);

    const lines = output.text.split("\n");
    expect(lines).toHaveLength(3);
    for (const match of output.matches) {
      expect(output.text).toContain(match.id);
      expect(output.text).toContain(match.source);
    }
    expect(AutonRecallOutputSchema.safeParse(output).success).toBe(true);
  });

  it("sin selector falla por validación", async () => {
    const root = await workspace();

    expect(AutonRecallInputSchema.safeParse({}).success).toBe(false);
    await expect(autonRecallHandler({}, context(root))).rejects.toThrow();
  });

  it("limit 50 falla y el límite por defecto es 5", async () => {
    const root = await workspace();
    for (let index = 0; index < 7; index += 1) {
      seedEvent(root, {
        id: `dispatch:default:${index + 1}`,
        kind: "dispatch",
        title: `Memoria ${index + 1}`,
        summary: "para el límite por defecto",
        source: `dispatch:default:${index + 1}`,
      });
    }

    expect(AutonRecallInputSchema.parse({ query: "memoria" }).limit).toBe(5);
    await expect(
      autonRecallHandler({ query: "memoria", limit: 50 }, context(root)),
    ).rejects.toThrow();

    const output = await autonRecallHandler({ query: "memoria" }, context(root));
    expect(output.matches).toHaveLength(5);
    expect(output.truncated).toBe(true);
    expect(output.text.split("\n")).toHaveLength(5);
  });

  it("un workspace vacío devuelve texto de sin recuerdos, matches vacíos y total 0", async () => {
    const root = await workspace();

    const output = await autonRecallHandler({ query: "cualquier cosa" }, context(root));

    expect(output.text).toBe("Sin recuerdos que coincidan.");
    expect(output.matches).toEqual([]);
    expect(output.total).toBe(0);
    expect(output.truncated).toBe(false);
    expect(AutonRecallOutputSchema.safeParse(output).success).toBe(true);
  });

  it("nunca devuelve before/after ni contenido de archivos", async () => {
    const root = await workspace();
    const secretBefore = "SECRETO_ANTES_no_debe_salir_1234567890";
    const secretAfter = "SECRETO_DESPUES_no_debe_salir_0987654321";
    await writeAutonFile(
      root,
      "changes.jsonl",
      `${JSON.stringify({
        at: FIXED_AT,
        agentId: "prog1",
        sessionId: "sess_auton_prog1",
        itemId: "s1",
        path: "src/secreto.ts",
        before: secretBefore,
        after: secretAfter,
      })}\n`,
    );

    const output = await autonRecallHandler({ id: "change:1" }, context(root));

    expect(output.matches).toHaveLength(1);
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain(secretBefore);
    expect(serialized).not.toContain(secretAfter);
    expect(serialized).not.toContain("SECRETO_ANTES");
    expect(serialized).not.toContain("SECRETO_DESPUES");
    for (const match of output.matches) {
      expect(match).not.toHaveProperty("before");
      expect(match).not.toHaveProperty("after");
      const allowed = new Set(["id", "kind", "at", "title", "summary", "refs", "source"]);
      expect(Object.keys(match).filter((key) => !allowed.has(key))).toEqual([]);
    }
    expect(AutonRecallOutputSchema.safeParse(output).success).toBe(true);
  });

  it("declara lectura y concurrencia seguras", () => {
    expect(autonRecallToolEntry.metadata.name).toBe(AUTON_RECALL_TOOL_NAME);
    expect(autonRecallToolEntry.metadata.readOnly).toBe(true);
    expect(autonRecallToolEntry.metadata.concurrentSafe).toBe(true);
    expect(autonRecallToolEntry.metadata.destructive).toBe(false);
    expect(autonRecallToolEntry.metadata.needsApproval).toBe(false);
  });
});
