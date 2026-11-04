import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AUTON_REGISTRY_FILE_NAME,
  AutonRegistryEventSchema,
  type AutonRegistryEvent,
} from "@zcode/contracts";
import {
  appendRegistryRecord,
  readRegistryLog,
  registryLogPath,
  verifyRegistryLog,
} from "../src/auton/registry-store.js";

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-registry-store-"));
  workspaces.push(dir);
  return dir;
}

async function logLines(root: string): Promise<string[]> {
  const raw = await readFile(registryLogPath(root), "utf8");
  return raw.split("\n").filter((line) => line.length > 0);
}

function baseInput(overrides: Partial<Parameters<typeof appendRegistryRecord>[1]> = {}) {
  return {
    kind: "decision" as const,
    title: "Decisión de prueba",
    summary: "Una línea sin secretos",
    refs: [],
    source: "test",
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("appendRegistryRecord", () => {
  it("agrega un evento y la lectura lo devuelve", async () => {
    const root = await workspace();
    const result = appendRegistryRecord(root, baseInput({ id: "evt:1" }));

    expect(result.appended).toBe(true);
    expect(result.record?.id).toBe("evt:1");
    expect(result.record?.version).toBe(1);

    const log = readRegistryLog(root);
    expect(log.records).toHaveLength(1);
    expect(log.records[0]?.title).toBe("Decisión de prueba");
    expect(log.warnings).toEqual([]);

    const lines = await logLines(root);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ id: "evt:1", kind: "decision" });
  });

  it("no reescribe la primera línea al agregar la segunda", async () => {
    const root = await workspace();
    appendRegistryRecord(root, baseInput({ id: "evt:1", title: "Primera" }));
    const before = await logLines(root);

    appendRegistryRecord(root, baseInput({ id: "evt:2", title: "Segunda" }));
    const after = await logLines(root);

    expect(after).toHaveLength(2);
    expect(after[0]).toBe(before[0]);
  });

  it("no duplica un id existente", async () => {
    const root = await workspace();
    const first = appendRegistryRecord(root, baseInput({ id: "evt:1", title: "Original" }));

    const second = appendRegistryRecord(root, baseInput({ id: "evt:1", title: "Distinta" }));

    expect(second.appended).toBe(false);
    expect(second.reason).toBe("duplicate_id");
    expect(second.record?.title).toBe("Original");
    expect(second.record?.id).toBe(first.record?.id);
    expect(await logLines(root)).toHaveLength(1);
    expect(readRegistryLog(root).records).toHaveLength(1);
  });

  it("no duplica un dedupeKey existente", async () => {
    const root = await workspace();
    appendRegistryRecord(
      root,
      baseInput({ id: "evt:1", dedupeKey: "dispatch:item:s1:attempt:1" }),
    );

    const second = appendRegistryRecord(
      root,
      baseInput({ id: "evt:2", dedupeKey: "dispatch:item:s1:attempt:1" }),
    );

    expect(second.appended).toBe(false);
    expect(second.reason).toBe("duplicate_dedupe_key");
    expect(second.record?.id).toBe("evt:1");
    expect(await logLines(root)).toHaveLength(1);
  });

  it("redacta sk-, Bearer, password= y claves privadas antes de escribir", async () => {
    const root = await workspace();
    const apiKey = "sk-live-abcdef1234567890";
    const bearer = "Bearer eyJhbGciOiJIUzI1NiJ9.secret";
    const password = "password=hunter2";
    const privateBody = "MIIEpAIBAAKCAQEAsecretprivatekeybody";
    const privateKey = [
      "-----BEGIN RSA PRIVATE KEY-----",
      privateBody,
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");

    const result = appendRegistryRecord(
      root,
      baseInput({
        id: "evt:secret",
        title: `Clave ${apiKey}`,
        summary: `${bearer} ${password} ${privateKey}`,
        refs: [`ref ${apiKey}`],
        paths: [`src/${password}.ts`],
      }),
    );

    expect(result.appended).toBe(true);
    expect(result.record?.title).not.toContain(apiKey);
    expect(result.record?.summary).not.toContain("hunter2");
    expect(result.record?.summary).not.toContain(privateBody);
    expect(result.record?.summary).toContain("[REDACTED PRIVATE KEY]");
    expect(result.record?.refs.join(" ")).not.toContain(apiKey);
    expect(result.record?.paths?.join(" ")).not.toContain("hunter2");

    const raw = await readFile(registryLogPath(root), "utf8");
    for (const secret of [apiKey, "eyJhbGciOiJIUzI1NiJ9.secret", "hunter2", privateBody]) {
      expect(raw).not.toContain(secret);
    }
  });

  it("trunca title, summary, refs y paths a sus topes", async () => {
    const root = await workspace();
    const result = appendRegistryRecord(
      root,
      baseInput({
        id: "evt:long",
        title: "t".repeat(250),
        summary: "s".repeat(1000),
        refs: Array.from({ length: 25 }, () => "r".repeat(350)),
        paths: Array.from({ length: 55 }, () => "p".repeat(520)),
      }),
    );

    expect(result.appended).toBe(true);
    const record = result.record as AutonRegistryEvent;
    expect(record.title.length).toBe(200);
    expect(record.title.endsWith("…")).toBe(true);
    expect(record.summary.length).toBe(800);
    expect(record.summary.endsWith("…")).toBe(true);
    expect(record.refs).toHaveLength(20);
    expect(record.refs.every((ref) => ref.length === 300 && ref.endsWith("…"))).toBe(true);
    expect(record.paths).toHaveLength(50);
    expect(record.paths?.every((path) => path.length === 500 && path.endsWith("…"))).toBe(true);
    expect(AutonRegistryEventSchema.safeParse(record).success).toBe(true);
  });

  it("tolera una línea corrupta y avisa sin perder el resto", async () => {
    const root = await workspace();
    const dir = join(root, ".auton");
    await mkdir(dir, { recursive: true });
    const valid = appendRegistryRecord(root, baseInput({ id: "evt:1" })).record;
    await writeFile(
      registryLogPath(root),
      `${JSON.stringify(valid)}\nno es json\n{"version":1,"id":"roto"}\n`,
      "utf8",
    );

    const log = readRegistryLog(root);

    expect(log.records).toHaveLength(1);
    expect(log.records[0]?.id).toBe("evt:1");
    expect(log.warnings.map((warning) => warning.code)).toEqual([
      "malformed_line",
      "invalid_record",
    ]);
    expect(log.warnings[0]?.source).toBe(`${AUTON_REGISTRY_FILE_NAME}:2`);
    expect(verifyRegistryLog(log).ok).toBe(false);
  });

  it("genera el mismo id para el mismo contenido", async () => {
    const rootA = await workspace();
    const rootB = await workspace();
    const input = baseInput({
      at: "2026-11-04T10:00:00.000Z",
      title: "Id determinista",
      summary: "mismo contenido",
      dedupeKey: "goal:1",
    });

    const first = appendRegistryRecord(rootA, input);
    const second = appendRegistryRecord(rootB, input);

    expect(first.record?.id).toBe(second.record?.id);
    expect(first.record?.id).toBe(`evt:2026-11-04T10:00:00.000Z:${(first.record?.id ?? "").split(":").at(-1)}`);
    expect(first.record?.id.startsWith("evt:2026-11-04T10:00:00.000Z:")).toBe(true);
  });

  it("solo escribe las claves del contrato, sin before/after ni contenido", async () => {
    const root = await workspace();
    appendRegistryRecord(
      root,
      baseInput({
        id: "evt:shape",
        status: "done",
        agentId: "prog1",
        itemId: "s1",
        refs: ["item:s1"],
        paths: ["src/login.ts"],
        dedupeKey: "change:12",
      }),
    );

    const lines = await logLines(root);
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
    const allowed = new Set([
      "version",
      "id",
      "at",
      "kind",
      "title",
      "summary",
      "refs",
      "source",
      "status",
      "agentId",
      "itemId",
      "paths",
      "dedupeKey",
    ]);

    expect(Object.keys(record).filter((key) => !allowed.has(key))).toEqual([]);
    expect(record).not.toHaveProperty("before");
    expect(record).not.toHaveProperty("after");
    expect(JSON.stringify(record)).not.toContain("before");
    expect(JSON.stringify(record)).not.toContain("after");
  });
});
