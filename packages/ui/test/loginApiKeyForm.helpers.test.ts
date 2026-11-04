import { describe, expect, it } from "vitest";
import {
  buildLoginApiKeySkipSettings,
  resolveLoginApiKeyProviderLabel,
  resolveLoginApiKeyTemplateId,
} from "@/login/LoginApiKeyForm.helpers.js";

describe("Meta API key provider choice", () => {
  it("resolves the meta choice to the auton-meta template", () => {
    expect(resolveLoginApiKeyTemplateId("meta")).toBe("auton-meta");
  });

  it("labels the meta choice as Meta", () => {
    expect(resolveLoginApiKeyProviderLabel("meta")).toBe("Meta");
  });

  it("skipping with meta does not write a fake family domain", () => {
    expect(buildLoginApiKeySkipSettings("meta", 300)).toEqual({
      providerFamilyDomainUpdatedAt: 300,
      providerFamilyDomainMigrated: true,
    });
  });
});
