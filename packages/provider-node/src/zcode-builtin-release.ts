import { z } from "zod";
import {
  ModelConfigRules,
  parseZCodeBuiltinModelConfigRules,
  parseZCodeBuiltinProviderConfigRules,
  ProviderTemplateMap,
  type ProviderConfigMap,
} from "@zcode/provider";

export const ZCODE_BUILTIN_RELEASE_SCHEMA_VERSION = 1 as const;
const RETIRED_ZAPI_PROVIDER_ID = "builtin:zapi";

export interface ZCodeBuiltinConfigContent {
  readonly providers: ProviderConfigMap;
  readonly providerTemplates: ProviderTemplateMap;
  readonly modelConfigRules: ModelConfigRules;
}

export interface ZCodeBuiltinRelease {
  readonly schemaVersion: typeof ZCODE_BUILTIN_RELEASE_SCHEMA_VERSION;
  readonly revision: number;
  readonly config: ZCodeBuiltinConfigContent;
}

const releaseSchema = z
  .object({
    schemaVersion: z.literal(ZCODE_BUILTIN_RELEASE_SCHEMA_VERSION),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    config: z
      .object({
        providerConfigRules: z.unknown(),
        modelConfigRules: z.unknown(),
      })
      .strict(),
  })
  .strict();

export function decodeZCodeBuiltinRelease(input: unknown): ZCodeBuiltinRelease {
  const parsed = releaseSchema.parse(input);
  const { providers, providerTemplates } = parseZCodeBuiltinProviderConfigRules(
    parsed.config.providerConfigRules,
  );
  // ZAPI 已退出产品，旧 Remote Release 或 LKG 不能在 Renderer 静态入口删除后
  // 又通过目标 Host Registry 将它重新发布。拒绝整份不兼容 Release，让 Source 回落到兼容候选。
  if (providers.has(RETIRED_ZAPI_PROVIDER_ID)) {
    throw new Error(`ZCode Built-in Release 包含已退出的 Provider: ${RETIRED_ZAPI_PROVIDER_ID}`);
  }
  return Object.freeze({
    schemaVersion: ZCODE_BUILTIN_RELEASE_SCHEMA_VERSION,
    revision: parsed.revision,
    config: Object.freeze({
      providers,
      providerTemplates,
      modelConfigRules: parseZCodeBuiltinModelConfigRules(parsed.config.modelConfigRules),
    }),
  });
}

export function encodeZCodeBuiltinRelease(release: ZCodeBuiltinRelease): object {
  return {
    schemaVersion: ZCODE_BUILTIN_RELEASE_SCHEMA_VERSION,
    revision: release.revision,
    config: {
      providerConfigRules: {
        templateRules: release.config.providerTemplates.toJSON(),
        providerRules: release.config.providers.toJSON(),
      },
      modelConfigRules: release.config.modelConfigRules.toZCodeBuiltinJSON(),
    },
  };
}

export function serializeZCodeBuiltinRelease(release: ZCodeBuiltinRelease): string {
  return JSON.stringify(encodeZCodeBuiltinRelease(release));
}

/**
 * Las plantillas que trae el producto en su archivo bundled (hoy las de
 * Auton: `auton` y `auton-meta`) no existen en el Release remoto de ZCode.
 * Si el Release activo viene de la caché remota, esas plantillas se pierden
 * y crear un proveedor desde ellas falla con "Template no existe".
 * Esta mezcla devuelve solo las plantillas bundled que el Release
 * seleccionado no trae, con sus reglas de modelo; nunca pisa una plantilla
 * que el Release seleccionado ya define. La mezcla es solo en memoria:
 * el archivo activo y su revision quedan intactos.
 */
export function mergeBundledOnlyProviderTemplates(
  selected: ZCodeBuiltinRelease,
  bundled: ZCodeBuiltinRelease,
): ZCodeBuiltinRelease {
  const missing = bundled.config.providerTemplates
    .entries()
    .filter(([templateId]) => !selected.config.providerTemplates.has(templateId));
  if (missing.length === 0) {
    return selected;
  }
  const missingIds = new Set(missing.map(([templateId]) => templateId));
  const extraRules = bundled.config.modelConfigRules
    .rules()
    .filter((rule) => rule.type === "template-model" && missingIds.has(rule.templateId));
  return Object.freeze({
    schemaVersion: selected.schemaVersion,
    revision: selected.revision,
    config: Object.freeze({
      providers: selected.config.providers,
      providerTemplates: selected.config.providerTemplates.overlay(
        new ProviderTemplateMap(missing),
      ),
      modelConfigRules:
        extraRules.length === 0
          ? selected.config.modelConfigRules
          : new ModelConfigRules([...selected.config.modelConfigRules.rules(), ...extraRules]),
    }),
  });
}
