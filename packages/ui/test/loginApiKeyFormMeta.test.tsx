// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginApiKeyForm } from "@/login/LoginApiKeyForm.js";

vi.mock("@/hooks/usePlatform.js", () => ({
  usePlatform: () => ({ openExternal: vi.fn() }),
}));

vi.mock("@/hooks/useProviderSettingsView.js", () => ({
  useProviderSettingsView: () => ({
    state: {
      status: "ready",
      view: {
        providerTemplates: [
          {
            templateId: "auton-meta",
            config: {
              access: {
                type: "api-key",
                apiKeyManagementUrl: "https://dev.meta.ai",
              },
            },
          },
        ],
      },
    },
    reload: vi.fn(),
  }),
}));

vi.mock("@/hooks/useServices.js", () => ({
  useServices: () => ({
    modelSelectionService: { getView: vi.fn() },
    providerSettingsService: { getView: vi.fn(), createPersonalProvider: vi.fn() },
    settingService: { update: vi.fn() },
  }),
}));

vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({
    intl: { formatMessage: ({ id }: { id: string }) => id, locale: "en-US" },
    locale: "en-US",
  }),
}));

vi.mock("@/store/StoreProvider.js", () => ({
  useZCodeStore: () => ({ markApiKeyLoginSuccess: vi.fn() }),
  useZCodeStoreWithDefault: (_selector: unknown, defaultValue: unknown) => defaultValue,
}));

afterEach(cleanup);

describe("LoginApiKeyForm Meta option", () => {
  it("muestra la opción Meta en el selector de proveedor", async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    render(
      <LoginApiKeyForm onCancel={() => {}} onSaved={() => {}} onSkipped={() => {}} />,
    );
    fireEvent.click(screen.getByTestId("login-api-key-provider-trigger"));
    expect(await screen.findByTestId("login-api-key-provider-item-meta")).toBeTruthy();
  });
});
