import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import {
  parseZCodeBuiltinModelConfigRules,
  type ModelConfigRules,
} from "@zcode/provider";

const url = "https://opencode.ai/zen/go/v1";
const models = ["beam-free", "longcat-2.5-preview-free"];
let rules: ModelConfigRules;
let templates: {
  templateId: string;
  templateNameMap?: Record<string, string>;
  config: {
    api: { type: string; baseUrl: string };
    access: unknown;
    logo: unknown;
    builtinModelIds: string[];
  };
}[];
beforeAll(async () => {
  const release = JSON.parse(
    await readFile(new URL("../../../config/provider/zcode-builtin.json", import.meta.url), "utf8"),
  );
  rules = parseZCodeBuiltinModelConfigRules(release.config.modelConfigRules);
  templates = release.config.providerConfigRules.templateRules;
});

describe("Auton provider template", () => {
  it("expone el template auton sobre la API de Go con sus modelos", () => {
    const t = templates.find((t) => t.templateId === "auton");
    expect(t).toBeDefined();
    expect(t!.config.api).toEqual({ type: "openai-chat-completions", baseUrl: url });
    expect(t!.config.access).toEqual({
      type: "api-key",
      apiKeyManagementUrl: "https://opencode.ai/auth",
    });
    expect(t!.config.logo).toEqual({ type: "builtin", key: "auton" });
    expect(t!.config.builtinModelIds).toEqual(models);
  });

  it.each(models)("%s resuelve con tool calls y queda habilitado", (modelId) => {
    const resolved = rules.resolve({
      providerId: "personal-auton",
      modelId,
      apiType: "openai-chat-completions",
      baseUrl: url,
      templateId: "auton",
    });
    expect(resolved.validateComplete()).toEqual([]);
    expect(resolved.enabled).toBe(true);
    expect(resolved.properties?.supportsToolCall).toBe(true);
  });
});

const metaUrl = "https://api.meta.ai/v1";
const metaModels = [
  "muse-wonder-1.0",
  "muse-spark-1.3",
  "muse-spark-1.3-contributor",
  "muse-spark-1.2",
  "muse-spark-1.2-contributor",
  "muse-spark-1.1",
];

describe("Auton Meta provider template", () => {
  it("se presenta solo como Meta, sin el prefijo Auton", () => {
    const t = templates.find((t) => t.templateId === "auton-meta");
    expect(t?.templateNameMap).toEqual({ "zh-CN": "Meta", "en-US": "Meta" });
  });

  it("expone el template auton-meta sobre la API de Meta con sus modelos", () => {
    const t = templates.find((t) => t.templateId === "auton-meta");
    expect(t).toBeDefined();
    expect(t!.config.api).toEqual({ type: "openai-chat-completions", baseUrl: metaUrl });
    expect(t!.config.access).toEqual({
      type: "api-key",
      apiKeyManagementUrl: "https://dev.meta.ai",
    });
    expect(t!.config.logo).toEqual({ type: "builtin", key: "auton" });
    expect(t!.config.builtinModelIds).toEqual(metaModels);
  });

  it.each(metaModels)("%s resuelve con tool calls y queda habilitado", (modelId) => {
    const resolved = rules.resolve({
      providerId: "personal-auton-meta",
      modelId,
      apiType: "openai-chat-completions",
      baseUrl: metaUrl,
      templateId: "auton-meta",
    });
    expect(resolved.validateComplete()).toEqual([]);
    expect(resolved.enabled).toBe(true);
    expect(resolved.properties?.supportsToolCall).toBe(true);
  });
});
