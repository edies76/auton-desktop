// ============================================================
// Aceptación independiente — registro durable Nivel 1C
// ============================================================
// Escrito desde docs/private/registro-durable.md (Niveles 1A/1B/1C) y las
// firmas públicas, sin leer la implementación del índice ni de los hooks.
// Cada prueba fija una promesa sobre un workspace real en disco: frescura del
// índice, caída al log, caché real, hooks del plan y de la reversión, y
// privacidad del contenido.

import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTON_REGISTRY_FILE_NAME,
  AUTON_REGISTRY_INDEX_FILE_NAME,
  AutonRegistryEventSchema,
  AutonRegistryIndexSchema,
  AutonRegistryLogSchema,
  type AutonRegistryAppendInput,
} from "@zcode/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { buildAutonSection } from "../src/auton/contextAuton.js";
import { recordFileChange } from "../src/auton/journal.js";
import { autonPlanHandler } from "../src/auton/plan-handler.js";
import { readAutonRegistry } from "../src/auton/registry.js";
import { readRegistryIndex, readRegistryLogCached, registryIndexPath } from "../src/auton/registry-index.js";
import { appendRegistryRecord, registryLogPath } from "../src/auton/registry-store.js";
import { autonRevertHandler } from "../src/auton/revert-handler.js";
import { builtInTools } from "../src/tool/handlers/index.js";
import type { ToolExecutionContext } from "../src/tool/types.js";

const workspaces: string[] = [];
const FIXED_ISO = "2026-11-04T12:00:00.000Z";
const FORBIDDEN_KEYS = ["before", "after", "beforeBase64", "afterBase64"];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-registry-hooks-acceptance-"));
  workspaces.push(dir);
  return dir;
}

function fixedNow(): Date {
  return new Date(FIXED_ISO);
}

function context(workspaceRoot: string): ToolExecutionContext {
  return {
    workingDirectory: workspaceRoot,
    workspaceRoot,
    sessionId: "sess_orchestrator",
  } as unknown as ToolExecutionContext;
}

function appendInput(overrides: Partial<AutonRegistryAppendInput> = {}): AutonRegistryAppendInput {
  return {
    kind: "decision",
    title: "Decisión de aceptación",
    summary: "Una decisión registrada para la prueba",
    refs: [],
    source: "acceptance:1",
    ...overrides,
  };
}

interface RawEvent extends Record<string, unknown> {
  id: string;
  kind: string;
  status?: string;
  paths?: string[];
  itemId?: string;
  refs?: string[];
}

async function readRawLines(workspace: string): Promise<string[]> {
  return (await readFile(registryLogPath(workspace), "utf8"))
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

async function readRawEvents(workspace: string): Promise<RawEvent[]> {
  return (await readRawLines(workspace)).map((line) => JSON.parse(line) as RawEvent);
}

async function readRawIndex(workspace: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(registryIndexPath(workspace), "utf8")) as Record<string, unknown>;
}

async function logBytes(workspace: string): Promise<number> {
  return (await stat(registryLogPath(workspace))).size;
}

async function writeIndex(workspace: string, index: unknown): Promise<void> {
  await mkdir(dirname(registryIndexPath(workspace)), { recursive: true });
  await writeFile(registryIndexPath(workspace), `${JSON.stringify(index)}\n`, "utf8");
}

async function assertNoTempFiles(workspace: string): Promise<void> {
  const entries = await readdir(join(workspace, ".auton"));
  expect(entries.filter((entry) => entry.endsWith(".tmp"))).toEqual([]);
}

/** Recorre un valor serializable y devuelve todas las claves encontradas. */
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

function assertNoFileContent(serialized: string, values: readonly unknown[]): void {
  for (const key of FORBIDDEN_KEYS) {
    expect(serialized).not.toContain(`"${key}"`);
  }
  for (const value of values) {
    expect(serialized).not.toContain(String(value));
  }
}

function decoyEvent() {
  return AutonRegistryEventSchema.parse({
    version: 1,
    id: "decoy:indice",
    at: FIXED_ISO,
    kind: "decision",
    title: "Evento señuelo del índice",
    summary: "Este evento no existe en el log durable",
    refs: [],
    source: "decoy:1",
    status: "fake",
  });
}

function limits(version: number, maxAttempts = 3) {
  return {
    version,
    maxAttempts,
    approval: {
      deleteMove: true,
      outsideProject: true,
      pushMergeRebase: true,
      installDependencies: true,
      outsideScope: true,
    },
    unknownHandling: "wait" as const,
  };
}

function planPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: "write" as const,
    goal: {
      title: "Registro durable Nivel 1C",
      statement: "Índice persistente y hooks mínimos",
      done: ["el índice es caché y el log manda"],
    },
    limits: limits(2, 5),
    limitHistory: [
      {
        at: "2026-11-04T10:00:00.000Z",
        field: "maxAttempts",
        from: "3",
        to: "5",
        reason: "más aire para items con red",
        approvedBy: "human" as const,
      },
    ],
    limitReports: [
      {
        at: "2026-11-04T11:00:00.000Z",
        field: "maxAttempts",
        observed: "el item se quedó sin intentos",
        expected: "5",
        by: "prog1",
        note: "reporte del worker",
      },
    ],
    items: [
      {
        id: "s1",
        title: "Índice persistente",
        status: "running" as const,
        owner: "programmer" as const,
        files: ["src/auton/registry-index.ts"],
      },
      {
        id: "s2",
        title: "Hooks mínimos",
        status: "ready" as const,
        owner: "orchestrator" as const,
      },
    ],
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("índice persistente Nivel 1C — aceptación independiente", () => {
  it("appendRegistryRecord deja un índice válido y con el tamaño exacto del log", async () => {
    const workspace = await makeWorkspace();

    const result = appendRegistryRecord(
      workspace,
      appendInput({
        id: "evt:index:1",
        kind: "change",
        title: "Cambio en src/login.ts",
        summary: "src/login.ts cambió sin guardar contenido",
        refs: ["item:s1"],
        source: "changes.jsonl:12",
        paths: ["src/login.ts"],
      }),
      { now: fixedNow() },
    );
    expect(result.appended).toBe(true);

    expect(registryIndexPath(workspace)).toBe(
      join(workspace, ".auton", AUTON_REGISTRY_INDEX_FILE_NAME),
    );
    const rawIndex = await readRawIndex(workspace);
    const parsed = AutonRegistryIndexSchema.safeParse(rawIndex);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.sourceBytes).toBe(await logBytes(workspace));
    expect(parsed.data.records.map((record) => record.id)).toContain("evt:index:1");
    expect(parsed.data.warnings).toEqual([]);
    expect(await readRawLines(workspace)).toHaveLength(1);
    await assertNoTempFiles(workspace);

    const fresh = readRegistryIndex(workspace);
    expect(fresh?.sourceBytes).toBe(parsed.data.sourceBytes);
    expect(fresh?.records.map((record) => record.id)).toContain("evt:index:1");
  });

  it("readRegistryIndex acepta lo fresco y devuelve null con esquema inválido o tamaño distinto", async () => {
    const workspace = await makeWorkspace();
    appendRegistryRecord(workspace, appendInput({ id: "evt:fresh:1" }), { now: fixedNow() });

    const fresh = await readRawIndex(workspace);
    expect(readRegistryIndex(workspace)).not.toBeNull();

    await writeIndex(workspace, { ...fresh, extra: "fuera del contrato" });
    expect(readRegistryIndex(workspace)).toBeNull();

    const wrongBytes = Number(fresh.sourceBytes) + 1;
    await writeIndex(workspace, { ...fresh, sourceBytes: wrongBytes });
    expect(readRegistryIndex(workspace)).toBeNull();

    // Otra vez fresco: el índice volvió a validar.
    await writeIndex(workspace, fresh);
    expect(readRegistryIndex(workspace)).not.toBeNull();
  });

  it("una línea corrupta invalida el índice, cae al log y reconstruye con malformed_line", async () => {
    const workspace = await makeWorkspace();
    appendRegistryRecord(workspace, appendInput({ id: "evt:corrupt:ok" }), { now: fixedNow() });

    const beforeCorruption = readRegistryLogCached(workspace, fixedNow());
    expect(beforeCorruption.warnings).toEqual([]);
    const freshBytes = await logBytes(workspace);
    expect(readRegistryIndex(workspace)?.sourceBytes).toBe(freshBytes);

    await appendFile(registryLogPath(workspace), "{ esto no es json\n", "utf8");

    const cached = readRegistryLogCached(workspace, fixedNow());
    expect(AutonRegistryLogSchema.safeParse(cached).success).toBe(true);
    expect(cached.records.map((record) => record.id)).toEqual(["evt:corrupt:ok"]);
    expect(cached.warnings.some((warning) => warning.code === "malformed_line")).toBe(true);

    const rebuilt = readRegistryIndex(workspace);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt?.sourceBytes).toBe(await logBytes(workspace));
    expect(rebuilt?.warnings.some((warning) => warning.code === "malformed_line")).toBe(true);
    expect(rebuilt?.records.map((record) => record.id)).toEqual(["evt:corrupt:ok"]);
    await assertNoTempFiles(workspace);
  });

  it("el índice es un caché real: un señuelo fresco manda y al borrarlo vuelve el log", async () => {
    const workspace = await makeWorkspace();
    appendRegistryRecord(
      workspace,
      appendInput({
        id: "dispatch:real",
        kind: "dispatch",
        title: "Evento real del log",
        summary: "este evento sí está en registry.jsonl",
        source: "dispatch:real",
      }),
      { now: fixedNow() },
    );

    const decoy = decoyEvent();
    await writeIndex(workspace, {
      version: 1,
      generatedAt: FIXED_ISO,
      sourceBytes: await logBytes(workspace),
      records: [decoy],
      warnings: [],
    });

    // Si leyó el índice, la ficha del log no aparece y la señuelo sí.
    const withDecoy = readAutonRegistry(workspace);
    expect(withDecoy.records.map((record) => record.id)).toContain("decoy:indice");
    expect(withDecoy.records.map((record) => record.id)).not.toContain("dispatch:real");
    expect(withDecoy.records.find((record) => record.id === "decoy:indice")?.title).toBe(
      "Evento señuelo del índice",
    );

    await unlink(registryIndexPath(workspace));

    // Sin índice, la fuente de verdad es el log.
    const fromLog = readAutonRegistry(workspace);
    expect(fromLog.records.map((record) => record.id)).toContain("dispatch:real");
    expect(fromLog.records.map((record) => record.id)).not.toContain("decoy:indice");
  });

  it("el índice no deja .tmp ni contiene claves de contenido de archivos", async () => {
    const workspace = await makeWorkspace();
    appendRegistryRecord(
      workspace,
      appendInput({
        id: "evt:clean:1",
        kind: "change",
        title: "Cambio sin contenido",
        summary: "src/app.ts cambió de 10 B a 20 B",
        source: "changes.jsonl:1",
        paths: ["src/app.ts"],
      }),
      { now: fixedNow() },
    );
    appendRegistryRecord(
      workspace,
      appendInput({ id: "evt:clean:2", kind: "report", source: "plan.json:r1" }),
      { now: fixedNow() },
    );

    await assertNoTempFiles(workspace);
    const serialized = await readFile(registryIndexPath(workspace), "utf8");
    const keys = collectKeys(JSON.parse(serialized));
    for (const key of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(key);
    }
  });
});

describe("hooks del plan Nivel 1C — aceptación independiente", () => {
  it("un write con goal, items, cambio de límite y reporte anexa los cuatro tipos y deja el índice fresco", async () => {
    const workspace = await makeWorkspace();

    const written = (await autonPlanHandler(planPayload(), context(workspace))) as {
      result?: boolean;
      errorCode?: number;
      summary?: { total: number };
    };
    expect(written.result).toBeUndefined();
    expect(written.errorCode).toBeUndefined();
    expect(written.summary?.total).toBe(2);

    const events = await readRawEvents(workspace);
    const kinds = new Set(events.map((event) => event.kind));
    expect(kinds.has("goal")).toBe(true);
    expect(kinds.has("dispatch")).toBe(true);
    expect(kinds.has("sprint")).toBe(true);
    expect(kinds.has("decision")).toBe(true);
    expect(kinds.has("report")).toBe(true);

    // Los eventos del plan llevan referencias, no contenido.
    const decision = events.find((event) => event.kind === "decision");
    expect(decision?.refs).toBeDefined();
    const report = events.find((event) => event.kind === "report");
    expect(report?.refs).toBeDefined();

    for (const event of events) {
      expect(AutonRegistryEventSchema.safeParse(event).success).toBe(true);
    }

    const index = readRegistryIndex(workspace);
    expect(index).not.toBeNull();
    expect(AutonRegistryIndexSchema.safeParse(index).success).toBe(true);
    expect(index?.sourceBytes).toBe(await logBytes(workspace));
    expect(index?.warnings).toEqual([]);
    expect(index?.records.map((record) => record.id)).toEqual(events.map((event) => event.id));
    await assertNoTempFiles(workspace);
  });

  it("repetir exactamente la misma escritura no crece el log (idempotencia)", async () => {
    const workspace = await makeWorkspace();
    const payload = () =>
      planPayload({
        limits: limits(1, 3),
        limitHistory: [],
        limitReports: [],
        items: [
          { id: "s1", title: "Índice", status: "ready" },
          { id: "s2", title: "Hooks", status: "ready" },
        ],
      });

    await autonPlanHandler(payload(), context(workspace));
    const linesBefore = await readRawLines(workspace);
    const bytesBefore = await logBytes(workspace);

    await autonPlanHandler(payload(), context(workspace));

    expect(await readRawLines(workspace)).toEqual(linesBefore);
    expect(await logBytes(workspace)).toBe(bytesBefore);
    expect(readRegistryIndex(workspace)?.sourceBytes).toBe(bytesBefore);
  });

  it("cambiar el status de un item anexa un evento nuevo y conserva el anterior", async () => {
    const workspace = await makeWorkspace();
    const base = () =>
      planPayload({
        limits: limits(1, 3),
        limitHistory: [],
        limitReports: [],
        goal: { title: "Conservar historia" },
        items: [{ id: "s1", title: "Item que cambia", status: "ready" }],
      });

    await autonPlanHandler(base(), context(workspace));
    const before = await readRawEvents(workspace);
    const beforeIds = before.map((event) => event.id);
    const itemEventsBefore = before.filter(
      (event) => event.itemId === "s1" || (event.refs ?? []).includes("item:s1"),
    ).length;

    const secondPayload = {
      ...base(),
      items: [{ id: "s1", title: "Item que cambia", status: "done" }],
    };
    await autonPlanHandler(secondPayload, context(workspace));

    const after = await readRawEvents(workspace);
    const afterIds = after.map((event) => event.id);
    for (const id of beforeIds) expect(afterIds).toContain(id);

    const newIds = afterIds.filter((id) => !beforeIds.includes(id));
    expect(newIds.length).toBeGreaterThan(0);
    const itemEventsAfter = after.filter(
      (event) => event.itemId === "s1" || (event.refs ?? []).includes("item:s1"),
    );
    expect(itemEventsAfter.length).toBeGreaterThan(itemEventsBefore);
  });

  it("una escritura rechazada por bajar attempts no anexa eventos", async () => {
    const workspace = await makeWorkspace();
    const withAttempts = (attempts: number) =>
      planPayload({
        limits: limits(1, 3),
        limitHistory: [],
        limitReports: [],
        goal: { title: "Intentos que no bajan" },
        items: [{ id: "s1", title: "Item con intentos", status: "ready", attempts }],
      });

    await autonPlanHandler(withAttempts(2), context(workspace));
    const linesBefore = await readRawLines(workspace);

    const rejected = (await autonPlanHandler(withAttempts(1), context(workspace))) as {
      result?: boolean;
      errorCode?: number;
    };
    expect(rejected.result).toBe(false);
    expect(rejected.errorCode).toBe(42205);

    expect(await readRawLines(workspace)).toEqual(linesBefore);
  });

  it("un limitHistory nuevo sin bumpear limits.version no anexa eventos", async () => {
    const workspace = await makeWorkspace();
    const first = planPayload({
      limits: limits(1, 3),
      limitHistory: [],
      limitReports: [],
      goal: { title: "Límites versionados" },
      items: [{ id: "s1", title: "Item", status: "ready" }],
    });
    await autonPlanHandler(first, context(workspace));
    const linesBefore = await readRawLines(workspace);

    const unrecorded = {
      ...first,
      limits: limits(1, 5),
      limitHistory: [
        {
          at: "2026-11-04T11:30:00.000Z",
          field: "maxAttempts",
          from: "3",
          to: "5",
          reason: "cambio sin versión nueva",
          approvedBy: "human",
        },
      ],
    };
    const rejected = (await autonPlanHandler(unrecorded, context(workspace))) as {
      result?: boolean;
      errorCode?: number;
    };
    expect(rejected.result).toBe(false);
    expect(rejected.errorCode).toBe(42204);

    expect(await readRawLines(workspace)).toEqual(linesBefore);
  });
});

describe("hook de reversión Nivel 1C — aceptación independiente", () => {
  it("anexa un evento revert con status y paths, sin contenido, y no duplica el mismo evento", async () => {
    const workspace = await makeWorkspace();
    const beforeContent = "SECRETO_ANTES_reversion_1234567890\n";
    const afterContent = "SECRETO_DESPUES_reversion_0987654321\n";
    const file = join(workspace, "src", "nota.txt");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, afterContent, "utf8");
    recordFileChange({
      workspaceRoot: workspace,
      sessionId: "sess_auton_prog1",
      path: file,
      before: beforeContent,
      after: afterContent,
    });

    const first = (await autonRevertHandler({ agentId: "prog1" }, context(workspace))) as {
      result: string;
      files: Array<{ path: string; outcome: string }>;
    };
    expect(first.result).toBe("reverted");

    const eventsAfterFirst = await readRawEvents(workspace);
    const revertEvents = eventsAfterFirst.filter((event) => event.kind === "revert");
    expect(revertEvents).toHaveLength(1);
    const firstRevert = revertEvents[0]!;
    expect(firstRevert.status).toBe(first.result);
    expect(firstRevert.paths).toContain("src/nota.txt");
    expect(AutonRegistryEventSchema.safeParse(firstRevert).success).toBe(true);

    const second = (await autonRevertHandler({ agentId: "prog1" }, context(workspace))) as {
      result: string;
      files: Array<{ path: string; outcome: string }>;
    };
    expect(second.result).toBe("already");

    const eventsAfterSecond = await readRawEvents(workspace);
    // El MISMO evento (mismo id) no se duplica, aunque la acción quede en already.
    expect(eventsAfterSecond.filter((event) => event.id === firstRevert.id)).toHaveLength(1);
    const ids = eventsAfterSecond.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);

    const registryRaw = await readFile(registryLogPath(workspace), "utf8");
    const indexRaw = await readFile(registryIndexPath(workspace), "utf8");
    assertNoFileContent(registryRaw, [beforeContent, afterContent]);
    assertNoFileContent(indexRaw, [beforeContent, afterContent]);
    for (const key of FORBIDDEN_KEYS) {
      expect(collectKeys(eventsAfterSecond)).not.toContain(key);
      expect(collectKeys(JSON.parse(indexRaw))).not.toContain(key);
    }
  });
});

describe("cuatro piezas de AutonRecall — aceptación independiente", () => {
  it("AutonRecall está registrada, el prompt la nombra y la promesa 11 sigue escrita", async () => {
    const names = builtInTools.map((tool) => tool.metadata.name);
    expect(names).toContain("AutonRecall");

    const section = buildAutonSection().content;
    expect(section).toContain("AutonRecall");
    expect(section).toContain(".auton/registry-index.json");

    const here = dirname(fileURLToPath(import.meta.url));
    const pruebas = await readFile(
      resolve(here, "../../../../../context/PRUEBAS-QUE-PROMETEMOS.md"),
      "utf8",
    );
    expect(pruebas).toContain("### 11. Pregunta por algo viejo");
  });
});
