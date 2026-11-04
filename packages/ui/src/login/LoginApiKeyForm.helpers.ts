import {
  BUILTIN_PROVIDER_TEMPLATE_IDS,
  type AppSettings,
  type Locale,
  type ProviderFamilyDomain,
} from "@zcode/shared";
import type { ModelSelectionView } from "@zcode/services";
import { encodeCustomModelValue } from "@/lib/zcodeCustomModelValue.js";

export type ApiKeyProviderChoice = "zai" | "bigmodel" | "meta";

export function resolveLoginApiKeyDefaultProvider(locale: Locale): ApiKeyProviderChoice {
  return locale === "zh-CN" ? "bigmodel" : "zai";
}

export function resolveLoginApiKeyTemplateId(
  choice: ApiKeyProviderChoice,
): "zai-api" | "bigmodel-api" | "auton-meta" {
  if (choice === "meta") {
    return "auton-meta";
  }
  return choice === "zai"
    ? BUILTIN_PROVIDER_TEMPLATE_IDS.zai
    : BUILTIN_PROVIDER_TEMPLATE_IDS.bigmodel;
}

export function resolveLoginApiKeyProviderLabel(choice: ApiKeyProviderChoice): string {
  // Welcome Screen API Key 错误提示需要使用 BigModel 品牌固定写法。
  if (choice === "meta") {
    return "Meta";
  }
  return choice === "zai" ? "Z.ai" : "BigModel";
}

export function resolveLoginApiKeyProviderFamilyDomain(
  choice: ApiKeyProviderChoice,
): ProviderFamilyDomain | undefined {
  if (choice === "meta") {
    // Meta no pertenece a ninguna familia zai/bigmodel.
    return undefined;
  }
  return choice;
}

export function buildLoginApiKeySkipSettings(
  choice: ApiKeyProviderChoice,
  now: number,
): Pick<
  AppSettings,
  "providerFamilyDomainUpdatedAt" | "providerFamilyDomainMigrated"
> &
  Partial<Pick<AppSettings, "providerFamilyDomain">> {
  const familyDomain = resolveLoginApiKeyProviderFamilyDomain(choice);
  return {
    ...(familyDomain !== undefined ? { providerFamilyDomain: familyDomain } : {}),
    providerFamilyDomainUpdatedAt: now,
    providerFamilyDomainMigrated: true,
  };
}

export function shouldShowLoginApiKeyLink(
  apiKeyValue: string,
  apiKeyUrl: string | undefined,
): boolean {
  return Boolean(apiKeyUrl) && apiKeyValue.trim().length === 0;
}

export function buildLoginApiKeyDefaultModelPreferenceFromSelection(
  view: ModelSelectionView,
  providerId: string,
): string | null {
  const firstModel = view.providers.find((provider) => provider.providerId === providerId)
    ?.models[0]?.modelId;
  return firstModel ? encodeCustomModelValue(providerId, firstModel) : null;
}

export function resolveHydratedLoginApiKeyValue({
  savedApiKey,
  userEdited,
}: {
  savedApiKey: string;
  userEdited: boolean;
}): string | null {
  if (userEdited) {
    return null;
  }
  return savedApiKey.trim();
}
