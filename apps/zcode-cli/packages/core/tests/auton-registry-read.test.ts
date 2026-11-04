import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AUTON_REGISTRY_READ_VERSION,
  formatAutonRegistryMatches,
  readAutonRegistry,
  searchAutonRegistry,
  verifyAutonRegistry,
  type AutonRegistrySnapshot,
} from "../src/auton/registry.js";

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auton-registry-"));
  workspaces.push(dir);
  return dir;
}

function planFixture(): unknown {
  return {
    version: 1,
    goal: {
      title: "Memoria durable de Auton",
      statement: "Que el orquestador recuerde lo que ya pasó",
      done: ["buscar por texto", "no perder el registro"],
    },
    limits: {
      version: 1,
      maxAttempts: 3,
      unknownHandling: "wait",
    },
    limitHistory: [
      {
        at: "2026-11-01T10:00:00.000Z",
        field: "maxAttempts",
        from: "2",
        to: "3",
        reason: "el contrato necesitó una vuelta más",
        approvedBy: "human",
      },
    ],
    limitReports: [
      {
        at: "2026-11-01T11:00:00.000Z",
        field: "maxAttempts",
        observed: "el tercer intento era necesario",
        expected: "4",
        by: "prog1",
      },
    ],
    items: [
      {
        id: "s1",
        title: "Login durable",
        detail: "Leer el diario y responder preguntas",
        status: "running",
        owner: "programmer",
        effort: "standard",
        files: ["src/login.ts"],
        evidence: [
          {
            kind: "test",
            label: "Login test",
            ref: "tests/login.test.ts",
          },
        ],
        attempts: 1,
      },
      {
        id: "s2",
        title: "Otra cosa",
        status: "ready",
      },
    ],
    updatedAt: "2026-11-01T12:00:00.000Z",
  };
}

async function writeRegistryFixture(root: string): Promise<void> {
  const dir = join(root, ".auton");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "plan.json"), `${JSON.stringify(planFixture(), null, 2)}\n`, "utf8");
  await writeFile(
    join(dir, "changes.jsonl"),
    [
      JSON.stringify({
        at: "2026-11-01T12:10:00.000Z",
        agentId: "prog1",
        sessionId: "sess_auton_prog1",
        itemId: "s1",
        path: "src/login.ts",
        before: "SECRET_BEFORE",
        after: "SECRET_AFTER",
      }),
      JSON.stringify({
        at: "2026-11-01T12:11:00.000Z",
        agentId: "prog2",
        sessionId: "sess_auton_prog2",
        path: "README.md",
        before: null,
        after: "# Hola\n",
      }),
    ].join("\n") + "\n",
    "utf8",
  );
  await writeFile(
    join(dir, "reverts.jsonl"),
    `${JSON.stringify({
      at: "2026-11-01T12:20:00.000Z",
      selection: { agentId: "prog1", itemId: "s1" },
      files: [{ path: "src/login.ts", outcome: "reverted" }],
    })}\n`,
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Auton registry read (Nivel 0)", () => {
  it("reads an empty workspace without inventing records", () => {
    return workspace().then((root) => {
      const snapshot = readAutonRegistry(root, new Date("2026-11-02T00:00:00.000Z"));
      expect(snapshot.version).toBe(AUTON_REGISTRY_READ_VERSION);
      expect(snapshot.generatedAt).toBe("2026-11-02T00:00:00.000Z");
      expect(snapshot.records).toEqual([]);
      expect(snapshot.warnings).toEqual([]);
    });
  });

  it("turns the plan, changes and reverts into linked cards", async () => {
    const root = await workspace();
    await writeRegistryFixture(root);

    const snapshot = readAutonRegistry(root);
    const byId = new Map(snapshot.records.map((record) => [record.id, record]));

    expect(byId.get("goal")?.title).toBe("Memoria durable de Auton");
    expect(byId.get("item:s1")?.status).toBe("running");
    expect(byId.get("item:s1")?.paths).toEqual(["src/login.ts"]);
    expect(byId.get("decision:limit:1")?.summary).toContain("maxAttempts");
    expect(byId.get("report:limit:1")?.summary).toContain("prog1");
    expect(byId.get("artifact:s1:1")?.refs).toContain("tests/login.test.ts");
    expect(byId.get("change:1")?.itemId).toBe("s1");
    expect(byId.get("change:1")?.refs).toContain("item:s1");
    expect(byId.get("revert:1")?.summary).toContain("reverted 1");
    expect(snapshot.warnings).toEqual([]);
  });

  it("never exposes the before/after content of a change", async () => {
    const root = await workspace();
    await writeRegistryFixture(root);

    const serialized = JSON.stringify(readAutonRegistry(root));
    expect(serialized).not.toContain("SECRET_BEFORE");
    expect(serialized).not.toContain("SECRET_AFTER");
    expect(serialized).toContain("src/login.ts");
  });

  it("searches by text, id, reference and kind with a hard limit", async () => {
    const root = await workspace();
    await writeRegistryFixture(root);
    const snapshot = readAutonRegistry(root);

    const text = searchAutonRegistry(snapshot, { text: "login" });
    expect(text.matches.map((match) => match.record.id)).toContain("item:s1");
    expect(text.matches.map((match) => match.record.id)).toContain("change:1");
    expect(text.matches.every((match) => match.score > 0)).toBe(true);

    const byId = searchAutonRegistry(snapshot, { id: "item:s1" });
    expect(byId.matches).toHaveLength(1);
    expect(byId.matches[0]?.record.kind).toBe("sprint");

    const byRef = searchAutonRegistry(snapshot, { ref: "src/login.ts" });
    expect(byRef.matches.map((match) => match.record.id)).toEqual(
      expect.arrayContaining(["item:s1", "change:1", "revert:1"]),
    );

    const changes = searchAutonRegistry(snapshot, { kind: "change" });
    expect(changes.matches).toHaveLength(2);

    const capped = searchAutonRegistry(snapshot, { text: "login", limit: 2 });
    expect(capped.matches).toHaveLength(2);
    expect(capped.total).toBeGreaterThan(2);
    expect(capped.truncated).toBe(true);
    expect(formatAutonRegistryMatches(capped).split("\n")).toHaveLength(2);
  });

  it("keeps reading when a line or the plan is corrupt", async () => {
    const root = await workspace();
    await writeRegistryFixture(root);
    const dir = join(root, ".auton");
    await writeFile(
      join(dir, "changes.jsonl"),
      `${JSON.stringify({
        at: "2026-11-01T13:00:00.000Z",
        agentId: "prog3",
        sessionId: "sess_auton_prog3",
        itemId: "s9",
        path: "src/otro.ts",
        before: null,
        after: "x",
      })}\n{not-json}\n`,
      "utf8",
    );

    const snapshot = readAutonRegistry(root);
    expect(snapshot.records.some((record) => record.id === "change:1")).toBe(true);
    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "malformed_line" }),
        expect.objectContaining({ code: "broken_ref" }),
      ]),
    );

    await writeFile(join(dir, "plan.json"), "{incompleto", "utf8");
    const withoutPlan = readAutonRegistry(root);
    expect(withoutPlan.records.some((record) => record.id === "change:1")).toBe(true);
    expect(withoutPlan.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "invalid_plan" })]),
    );
  });

  it("verifies duplicate ids and broken references without fixing them", async () => {
    const root = await workspace();
    await writeRegistryFixture(root);
    const snapshot = readAutonRegistry(root);
    const broken: AutonRegistrySnapshot = {
      ...snapshot,
      records: [
        ...snapshot.records,
        { ...snapshot.records[0]!, refs: ["item:missing"] },
      ],
    };

    const result = verifyAutonRegistry(broken);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_id" }),
        expect.objectContaining({ code: "broken_ref" }),
      ]),
    );
  });
});
