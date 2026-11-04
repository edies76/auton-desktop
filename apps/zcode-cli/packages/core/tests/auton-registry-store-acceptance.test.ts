// ============================================================
// Aceptación independiente — registro durable de Auton (Nivel 1A)
// ============================================================
// Escrito desde docs/private/registro-durable.md y la firma pública, sin leer
// la implementación del almacén. Cada prueba fija una promesa del Nivel 1A
// sobre un workspace real en disco: contrato estricto, append-only, idempotencia,
// redacción, topes y tolerancia a líneas corruptas.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  AUTON_REGISTRY_FILE_NAME,
  AutonRegistryEventSchema,
  AutonRegistryLogSchema,
  type AutonRegistryAppendInput,
} from "@zcode/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendRegistryRecord,
  readRegistryLog,
  redactRegistryText,
  registryLogPath,
  verifyRegistryLog,
} from "../src/auton/registry-store.js";

const workspaces: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-registry-store-acceptance-"));
  workspaces.push(dir);
  return dir;
}

const FIXED_ISO = "2026-11-04T12:00:00.000Z";

function fixedNow(): Date {
  return new Date(FIXED_ISO);
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

async function readRawLines(workspace: string): Promise<string[]> {
  const raw = await readFile(registryLogPath(workspace), "utf8");
  return raw.split("\n").filter((line) => line.length > 0);
}

async function writeRawLines(workspace: string, lines: readonly string[]): Promise<void> {
  await mkdir(dirname(registryLogPath(workspace)), { recursive: true });
  await writeFile(registryLogPath(workspace), `${lines.join("\n")}\n`, "utf8");
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("registro durable Nivel 1A — aceptación independiente", () => {
  it("un workspace sin log lee vacío, sin warnings y verifica ok", async () => {
    const workspace = await makeWorkspace();

    const log = readRegistryLog(workspace, fixedNow());

    expect(registryLogPath(workspace)).toBe(
      join(workspace, ".auton", AUTON_REGISTRY_FILE_NAME),
    );
    expect(log.version).toBe(1);
    expect(log.records).toEqual([]);
    expect(log.warnings).toEqual([]);
    expect(verifyRegistryLog(log)).toEqual({ ok: true, issues: [] });
    expect(AutonRegistryLogSchema.safeParse(log).success).toBe(true);
  });

  it("append + read: evento correcto y una sola línea JSONL", async () => {
    const workspace = await makeWorkspace();
    const input = appendInput({
      id: "evt:acceptance:1",
      kind: "change",
      title: "Cambio en src/login.ts",
      summary: "src/login.ts cambió de 120 B a 160 B",
      refs: ["item:s1"],
      source: "changes.jsonl:12",
      status: "done",
      agentId: "prog1",
      itemId: "s1",
      paths: ["src/login.ts"],
      dedupeKey: "change:12",
    });

    const result = appendRegistryRecord(workspace, input, { now: fixedNow() });

    expect(result.appended).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.record).toBeDefined();

    const lines = await readRawLines(workspace);
    expect(lines).toHaveLength(1);
    const persisted = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(persisted).toEqual(result.record);
    expect(persisted.version).toBe(1);
    expect(persisted.at).toBe(FIXED_ISO);
    expect(AutonRegistryEventSchema.safeParse(persisted).success).toBe(true);

    const log = readRegistryLog(workspace, fixedNow());
    expect(log.records).toHaveLength(1);
    expect(log.records[0]).toEqual(result.record);
    expect(log.warnings).toEqual([]);
    expect(verifyRegistryLog(log).ok).toBe(true);
  });

  it("append-only: dos appends no reescriben la primera línea", async () => {
    const workspace = await makeWorkspace();

    const first = appendRegistryRecord(
      workspace,
      appendInput({ id: "evt:append:1", title: "Primero" }),
      { now: fixedNow() },
    );
    expect(first.appended).toBe(true);
    const firstLine = (await readRawLines(workspace))[0];

    const second = appendRegistryRecord(
      workspace,
      appendInput({ id: "evt:append:2", title: "Segundo" }),
      { now: fixedNow() },
    );
    expect(second.appended).toBe(true);

    const lines = await readRawLines(workspace);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(firstLine);
    expect(lines[1]).toContain("evt:append:2");
  });

  it("idempotencia por id: no crece el archivo y devuelve duplicate_id", async () => {
    const workspace = await makeWorkspace();
    const firstInput = appendInput({ id: "evt:dup:id", title: "Original" });

    const first = appendRegistryRecord(workspace, firstInput, { now: fixedNow() });
    expect(first.appended).toBe(true);
    const linesBefore = await readRawLines(workspace);

    const second = appendRegistryRecord(
      workspace,
      { ...firstInput, title: "Intento distinto" },
      { now: fixedNow() },
    );

    expect(second.appended).toBe(false);
    expect(second.reason).toBe("duplicate_id");
    expect(second.record?.id).toBe("evt:dup:id");
    expect(second.record?.title).toBe("Original");
    expect(await readRawLines(workspace)).toEqual(linesBefore);
  });

  it("idempotencia por dedupeKey: no crece el archivo y devuelve duplicate_dedupe_key", async () => {
    const workspace = await makeWorkspace();

    const first = appendRegistryRecord(
      workspace,
      appendInput({ id: "evt:dedupe:a", dedupeKey: "decision:shared" }),
      { now: fixedNow() },
    );
    expect(first.appended).toBe(true);
    const linesBefore = await readRawLines(workspace);

    const second = appendRegistryRecord(
      workspace,
      appendInput({
        id: "evt:dedupe:b",
        dedupeKey: "decision:shared",
        title: "Otra decisión con la misma clave",
      }),
      { now: fixedNow() },
    );

    expect(second.appended).toBe(false);
    expect(second.reason).toBe("duplicate_dedupe_key");
    expect(second.record?.id).toBe("evt:dedupe:a");
    expect(await readRawLines(workspace)).toEqual(linesBefore);
  });

  it("id autogenerado: determinista con el mismo contenido y distinto con otro contenido", async () => {
    const workspace = await makeWorkspace();
    const input = appendInput({
      title: "Id determinista",
      summary: "mismo contenido produce el mismo id",
      source: "acceptance:deterministic",
    });

    const first = appendRegistryRecord(workspace, input, { now: fixedNow() });
    const second = appendRegistryRecord(workspace, input, { now: fixedNow() });

    expect(first.appended).toBe(true);
    expect(first.record?.id).toMatch(/^evt:/);
    expect(second.appended).toBe(false);
    expect(second.reason).toBe("duplicate_id");
    expect(second.record?.id).toBe(first.record?.id);

    const different = appendRegistryRecord(
      workspace,
      { ...input, summary: "contenido distinto produce otro id" },
      { now: fixedNow() },
    );

    expect(different.appended).toBe(true);
    expect(different.record?.id).toMatch(/^evt:/);
    expect(different.record?.id).not.toBe(first.record?.id);
  });

  it("redacta secretos y el original no queda en el archivo", async () => {
    const workspace = await makeWorkspace();
    const secrets = {
      sk: "sk-ant-api03-SECRETSECRETSECRET1234567890",
      bearer: "bearer-SECRET-1234567890",
      password: "contrasena-SECRET-123",
      token: "tok-SECRET-1234567890",
      apiKey: "key-SECRET-1234567890",
      privateKeyBody: "MIIEowIBAAKCAQEAprivatebodySECRET123",
    };
    const privateKeyBlock = [
      "-----BEGIN RSA PRIVATE KEY-----",
      secrets.privateKeyBody,
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");
    const text = [
      `sk=${secrets.sk}`,
      `Authorization: Bearer ${secrets.bearer}`,
      `password=${secrets.password}`,
      `token=${secrets.token}`,
      `api_key=${secrets.apiKey}`,
      privateKeyBlock,
    ].join(" | ");

    const redacted = redactRegistryText(text);
    for (const secret of Object.values(secrets)) {
      expect(redacted).not.toContain(secret);
    }

    const result = appendRegistryRecord(
      workspace,
      appendInput({
        id: "evt:redaction:1",
        kind: "artifact",
        title: `Evidencia con ${secrets.sk}`,
        summary: text,
        source: "acceptance:redaction",
      }),
      { now: fixedNow() },
    );

    expect(result.appended).toBe(true);
    const raw = await readFile(registryLogPath(workspace), "utf8");
    for (const secret of Object.values(secrets)) {
      expect(raw).not.toContain(secret);
    }
    for (const secret of Object.values(secrets)) {
      expect(result.record?.summary ?? "").not.toContain(secret);
    }
    expect(readRegistryLog(workspace, fixedNow()).records).toHaveLength(1);
  });

  it("topes: título 200, resumen 800, 20 refs de 300 y 50 paths de 500", async () => {
    const workspace = await makeWorkspace();
    const longTitle = "T".repeat(240);
    const longSummary = "S".repeat(900);
    const refs = Array.from(
      { length: 25 },
      (_, index) => `ref-${index}-${"r".repeat(index === 0 ? 350 : 5)}`,
    );
    const paths = Array.from(
      { length: 60 },
      (_, index) => `src/file-${index}-${"p".repeat(index === 0 ? 550 : 5)}`,
    );

    const result = appendRegistryRecord(
      workspace,
      appendInput({
        id: "evt:limits:1",
        title: longTitle,
        summary: longSummary,
        refs,
        paths,
      }),
      { now: fixedNow() },
    );

    expect(result.appended).toBe(true);
    const event = result.record;
    expect(event).toBeDefined();
    expect(event?.title.length).toBeLessThanOrEqual(200);
    expect(event?.title.endsWith("…")).toBe(true);
    expect(event?.summary.length).toBeLessThanOrEqual(800);
    expect(event?.summary.endsWith("…")).toBe(true);
    expect(event?.refs.length).toBeLessThanOrEqual(20);
    expect(event?.refs[0]?.length).toBeLessThanOrEqual(300);
    expect(event?.refs[0]?.endsWith("…")).toBe(true);
    expect(event?.paths?.length ?? 0).toBeLessThanOrEqual(50);
    expect(event?.paths?.[0]?.length ?? 0).toBeLessThanOrEqual(500);
    expect(event?.paths?.[0]?.endsWith("…")).toBe(true);
    expect(AutonRegistryEventSchema.safeParse(event).success).toBe(true);

    const log = readRegistryLog(workspace, fixedNow());
    expect(log.records).toHaveLength(1);
    expect(log.warnings).toEqual([]);
  });

  it("una línea corrupta no invalida el resto y reporta malformed_line", async () => {
    const workspace = await makeWorkspace();
    appendRegistryRecord(workspace, appendInput({ id: "evt:corrupt:a" }), {
      now: fixedNow(),
    });
    appendRegistryRecord(workspace, appendInput({ id: "evt:corrupt:b" }), {
      now: fixedNow(),
    });
    const [firstLine, secondLine] = await readRawLines(workspace);

    await writeRawLines(workspace, [firstLine, "{ esto no es json", secondLine]);

    const log = readRegistryLog(workspace, fixedNow());
    expect(log.records.map((record) => record.id)).toEqual(["evt:corrupt:a", "evt:corrupt:b"]);
    expect(log.warnings.some((warning) => warning.code === "malformed_line")).toBe(true);
    expect(AutonRegistryLogSchema.safeParse(log).success).toBe(true);

    const verification = verifyRegistryLog(log);
    expect(verification.ok).toBe(false);
    expect(verification.issues.some((issue) => issue.code === "malformed_line")).toBe(true);
  });

  it("una línea JSON válida con before/after o campo extra se rechaza como invalid_record", async () => {
    const workspace = await makeWorkspace();
    const valid = AutonRegistryEventSchema.parse({
      version: 1,
      id: "evt:invalid:ok",
      at: FIXED_ISO,
      kind: "decision",
      title: "Válido",
      summary: "Este registro sí cumple el contrato",
      refs: [],
      source: "acceptance:invalid",
    });
    const withContent = {
      ...valid,
      id: "evt:invalid:before-after",
      before: "contenido sensible",
      after: "contenido sensible",
    };
    const withExtraField = {
      ...valid,
      id: "evt:invalid:extra",
      campoExtra: "fuera del contrato",
    };
    const withBase64Content = {
      ...valid,
      id: "evt:invalid:base64",
      beforeBase64: "Y29udGVuaWRv",
      afterBase64: "Y29udGVuaWRv",
    };

    await writeRawLines(workspace, [
      JSON.stringify(withContent),
      JSON.stringify(withExtraField),
      JSON.stringify(withBase64Content),
      JSON.stringify(valid),
    ]);

    const log = readRegistryLog(workspace, fixedNow());
    expect(log.records.map((record) => record.id)).toEqual(["evt:invalid:ok"]);
    expect(log.warnings.filter((warning) => warning.code === "invalid_record")).toHaveLength(3);
    expect(log.records.some((record) => "before" in record || "after" in record)).toBe(false);
    expect(AutonRegistryLogSchema.safeParse(log).success).toBe(true);

    const verification = verifyRegistryLog(log);
    expect(verification.ok).toBe(false);
    expect(verification.issues.some((issue) => issue.code === "invalid_record")).toBe(true);
  });

  it("el archivo final no contiene before, after, beforeBase64 ni afterBase64", async () => {
    const workspace = await makeWorkspace();
    appendRegistryRecord(
      workspace,
      appendInput({
        id: "evt:keys:1",
        kind: "change",
        title: "Cambio sin contenido de archivos",
        summary: "src/login.ts cambió sin guardar before/after",
        paths: ["src/login.ts"],
      }),
      { now: fixedNow() },
    );

    // Un escritor adversarial intenta colar contenido de archivos. Si el
    // contrato estricto lo rechaza, perfecto; si no, el archivo tampoco debe
    // quedar con esas claves.
    try {
      appendRegistryRecord(
        workspace,
        {
          ...appendInput({ id: "evt:keys:2", kind: "change" }),
          before: "contenido original",
          after: "contenido nuevo",
          beforeBase64: "Y29udGVuaWRvIG9yaWdpbmFs",
          afterBase64: "Y29udGVuaWRvIG51ZXZv",
        } as unknown as AutonRegistryAppendInput,
        { now: fixedNow() },
      );
    } catch {
      // El rechazo por contrato estricto también es un resultado válido.
    }

    const forbidden = ["before", "after", "beforeBase64", "afterBase64"];
    for (const line of await readRawLines(workspace)) {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      for (const key of forbidden) {
        expect(Object.hasOwn(parsed, key)).toBe(false);
      }
    }

    const log = readRegistryLog(workspace, fixedNow());
    for (const record of log.records) {
      for (const key of forbidden) {
        expect(Object.hasOwn(record, key)).toBe(false);
      }
    }
  });

  it("AutonRegistryLogSchema acepta el log leído en estados vacío, sano y con warnings", async () => {
    const workspace = await makeWorkspace();

    const empty = readRegistryLog(workspace, fixedNow());
    expect(AutonRegistryLogSchema.safeParse(empty).success).toBe(true);

    appendRegistryRecord(workspace, appendInput({ id: "evt:schema:1" }), {
      now: fixedNow(),
    });
    const healthy = readRegistryLog(workspace, fixedNow());
    expect(AutonRegistryLogSchema.safeParse(healthy).success).toBe(true);

    const lines = await readRawLines(workspace);
    await writeRawLines(workspace, [...lines, "línea rota"]);
    const withWarnings = readRegistryLog(workspace, fixedNow());
    expect(withWarnings.warnings.some((warning) => warning.code === "malformed_line")).toBe(true);
    expect(AutonRegistryLogSchema.safeParse(withWarnings).success).toBe(true);
  });
});
