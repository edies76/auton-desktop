// ============================================================
// Registro durable de Auton — índice persistente (Nivel 1C)
// ============================================================
// El índice es una caché derivada de registry.jsonl: solo vale si el esquema
// valida y si su `sourceBytes` coincide con el tamaño real del log. Nunca es
// fuente de verdad y nunca debe dejar temporales.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AutonRegistryAppendInput } from "@zcode/contracts";
import {
  appendRegistryRecord,
  readRegistryLog,
  registryLogPath,
} from "../src/auton/registry-store.js";
import { readAutonRegistry } from "../src/auton/registry.js";
import {
  readRegistryIndex,
  readRegistryLogCached,
  refreshRegistryIndex,
  registryIndexPath,
  writeRegistryIndex,
} from "../src/auton/registry-index.js";

const workspaces: string[] = [];
const FIXED_AT = "2026-11-04T12:00:00.000Z";

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-registry-index-"));
  workspaces.push(dir);
  return dir;
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

function seed(root: string, overrides: Partial<AutonRegistryAppendInput> = {}) {
  const result = appendRegistryRecord(root, event(overrides));
  if (!result.appended) throw new Error("no se pudo sembrar el evento");
  return result;
}

async function logLines(root: string): Promise<string[]> {
  const raw = await readFile(registryLogPath(root), "utf8");
  return raw.split("\n").filter((line) => line.length > 0);
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("índice persistente del registro durable (Nivel 1C)", () => {
  it("un append actualiza el índice con los mismos records y el tamaño real", async () => {
    const root = await workspace();
    seed(root, { id: "evt:1", title: "Primera" });
    seed(root, { id: "evt:2", title: "Segunda" });

    const index = readRegistryIndex(root);
    const log = readRegistryLog(root);

    expect(index).not.toBeNull();
    expect(index?.records).toEqual(log.records);
    expect(index?.warnings).toEqual([]);
    expect(index?.sourceBytes).toBe(statSync(registryLogPath(root)).size);
    expect(index?.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("readRegistryIndex devuelve el índice fresco y readRegistryLogCached lo usa", async () => {
    const root = await workspace();
    seed(root, { id: "evt:1", summary: "resumen original" });

    const index = readRegistryIndex(root);
    expect(index).not.toBeNull();

    // Alterar solo el índice: si la lectura cacheada lo usa, devuelve el texto
    // alterado sin releer el log (sourceBytes no cambió).
    const tampered = {
      ...index!,
      records: index!.records.map((record) => ({ ...record, summary: "resumen desde el índice" })),
    };
    await writeFile(registryIndexPath(root), `${JSON.stringify(tampered)}\n`, "utf8");

    const cached = readRegistryLogCached(root);
    expect(cached.records[0]?.summary).toBe("resumen desde el índice");
  });

  it("la ruta del lector (readAutonRegistry) usa el índice y cae al log si falta", async () => {
    const root = await workspace();
    seed(root, { id: "evt:real", title: "Evento real en el log" });

    const decoy = {
      version: 1,
      id: "evt:senuelo",
      at: FIXED_AT,
      kind: "decision",
      title: "Evento señuelo",
      summary: "Solo existe en el índice",
      refs: [],
      source: "test:index",
    };
    await writeFile(
      registryIndexPath(root),
      `${JSON.stringify({
        version: 1,
        generatedAt: FIXED_AT,
        sourceBytes: statSync(registryLogPath(root)).size,
        records: [decoy],
        warnings: [],
      })}\n`,
      "utf8",
    );

    const fromIndex = readAutonRegistry(root);
    expect(fromIndex.records.some((record) => record.id === "evt:senuelo")).toBe(true);
    expect(fromIndex.records.some((record) => record.id === "evt:real")).toBe(false);

    // Sin índice, el lector vuelve al log real y el señuelo desaparece.
    await rm(registryIndexPath(root), { force: true });
    const fromLog = readAutonRegistry(root);
    expect(fromLog.records.some((record) => record.id === "evt:real")).toBe(true);
    expect(fromLog.records.some((record) => record.id === "evt:senuelo")).toBe(false);
  });

  it("una línea corrupta cambia el tamaño, invalida el índice y la lectura cae al log", async () => {
    const root = await workspace();
    seed(root, { id: "evt:1" });
    const before = readRegistryIndex(root);
    expect(before).not.toBeNull();

    await writeFile(registryLogPath(root), `${await readFile(registryLogPath(root), "utf8")}{roto\n`, "utf8");
    expect(readRegistryIndex(root)).toBeNull();

    const log = readRegistryLogCached(root);
    expect(log.records).toHaveLength(1);
    expect(log.warnings.some((warning) => warning.code === "malformed_line")).toBe(true);

    const rebuilt = readRegistryIndex(root);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt?.sourceBytes).toBe(statSync(registryLogPath(root)).size);
    expect(rebuilt?.warnings.some((warning) => warning.code === "malformed_line")).toBe(true);
  });

  it("un índice con esquema inválido devuelve null", async () => {
    const root = await workspace();
    seed(root, { id: "evt:1" });
    await writeFile(
      registryIndexPath(root),
      `${JSON.stringify({ version: 99, generatedAt: "", sourceBytes: 1, records: [], warnings: [] })}\n`,
      "utf8",
    );
    expect(readRegistryIndex(root)).toBeNull();

    await writeFile(registryIndexPath(root), "no es json\n", "utf8");
    expect(readRegistryIndex(root)).toBeNull();
  });

  it("un workspace sin log no tiene índice válido y la lectura cacheada está vacía", async () => {
    const root = await workspace();
    expect(readRegistryIndex(root)).toBeNull();

    const log = readRegistryLogCached(root);
    expect(log.records).toEqual([]);
    expect(log.warnings).toEqual([]);
    expect(readRegistryIndex(root)).toBeNull();
  });

  it("el índice no deja archivos .tmp", async () => {
    const root = await workspace();
    seed(root, { id: "evt:1" });
    refreshRegistryIndex(root);

    const dir = join(root, ".auton");
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dir);
    expect(entries.some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("se reconstruye tras un append y no conserva registros viejos si el log cambió", async () => {
    const root = await workspace();
    seed(root, { id: "evt:viejo", title: "Viejo" });

    const replacement = {
      version: 1,
      id: "evt:nuevo",
      at: FIXED_AT,
      kind: "decision",
      title: "Nuevo",
      summary: "Reemplazo completo del log",
      refs: [],
      source: "test:replacement",
    };
    await writeFile(registryLogPath(root), `${JSON.stringify(replacement)}\n`, "utf8");

    const log = readRegistryLogCached(root);
    expect(log.records.map((record) => record.id)).toEqual(["evt:nuevo"]);

    const rebuilt = readRegistryIndex(root);
    expect(rebuilt?.records.map((record) => record.id)).toEqual(["evt:nuevo"]);
    expect(rebuilt?.records.some((record) => record.id === "evt:viejo")).toBe(false);
  });

  it("el índice no contiene before/after ni claves fuera del contrato", async () => {
    const root = await workspace();
    seed(root, { id: "evt:1", summary: "sin cuerpos de archivo" });
    const index = readRegistryIndex(root);
    expect(index).not.toBeNull();

    const serialized = JSON.stringify(index?.records);
    expect(serialized).not.toContain('"before"');
    expect(serialized).not.toContain('"after"');

    for (const record of index?.records ?? []) {
      expect(Object.keys(record).sort()).toEqual(
        Object.keys(record)
          .filter((key) => !["before", "after"].includes(key))
          .sort(),
      );
    }
  });

  it("writeRegistryIndex usa el tamaño real del log y generatedAt determinista", async () => {
    const root = await workspace();
    await mkdir(join(root, ".auton"), { recursive: true });
    seed(root, { id: "evt:1" });
    const log = readRegistryLog(root);
    const now = new Date("2026-11-04T13:00:00.000Z");

    const index = writeRegistryIndex(root, log, now);
    expect(index.generatedAt).toBe(now.toISOString());
    expect(index.sourceBytes).toBe(statSync(registryLogPath(root)).size);
    expect(index.records).toEqual(log.records);
    expect(await logLines(root)).toHaveLength(1);
  });
});
