// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import type { ConversationStoreState } from "@/v4/conversationProjectionStore.js";
import type { SessionLease } from "@/v4/sessionDataLayer.js";
import { AutonSpaceLive } from "../src/auton/project-space/AutonSpaceLive.js";
import { sampleConversationRows } from "../src/auton/project-space/sample.js";
import type { AutonProject } from "../src/auton/project-space/model.js";

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);
const PROJECT: AutonProject = {
  id: "p1",
  name: "Lunar móvil",
  path: "C:\\proyectos\\lunar",
  lastActiveAt: NOW,
};

const ROWS = sampleConversationRows();
const STATE = {
  status: "live",
  snapshot: { rows: { window: ROWS } },
  subscriptionId: "sub",
  lastError: null,
  optimisticCommands: [],
  loadingOlder: false,
  sessionPlans: [],
  planDirectoryRevision: 0,
  plansLoading: false,
  turnNavigatorDirectoryRevision: 0,
} as unknown as ConversationStoreState;

const store = {
  subscribe: () => () => undefined,
  getState: () => STATE,
};
const lease = { store } as unknown as SessionLease;

afterEach(cleanup);

describe("espacio del proyecto conectado a la sesión real", () => {
  it("proyecta mensajes, workers, plan y evidencia de las filas reales", () => {
    render(
      <ZCodeIntlProvider initialLocale="en-US">
        <AutonSpaceLive lease={lease} project={PROJECT} now={NOW} onBack={vi.fn()} />
      </ZCodeIntlProvider>,
    );

    expect(screen.getByTestId("auton-project-space")).toBeTruthy();
    expect(screen.getAllByTestId("auton-worker-row")).toHaveLength(3);
    expect(screen.getAllByText("worker 1").length).toBeGreaterThan(0);
    expect(screen.getByTestId("auton-thread").textContent).toContain("Mejora el diseño del chat");
    expect(screen.getByTestId("auton-plan-block").textContent).toContain("Revisar el diseño del chat");
    expect(screen.getByTestId("auton-evidence-block").textContent).toContain("pnpm --filter @zcode/ui test");
  });

  it("el botón atrás vuelve al hilo y una sesión sin filas no inventa workers", () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <ZCodeIntlProvider initialLocale="en-US">
        <AutonSpaceLive lease={lease} project={PROJECT} now={NOW} onBack={onBack} />
      </ZCodeIntlProvider>,
    );
    fireEvent.click(screen.getByTestId("auton-project-back"));
    expect(onBack).toHaveBeenCalledTimes(1);

    rerender(
      <ZCodeIntlProvider initialLocale="en-US">
        <AutonSpaceLive lease={null} project={PROJECT} now={NOW} onBack={onBack} />
      </ZCodeIntlProvider>,
    );
    expect(screen.queryAllByTestId("auton-worker-row")).toHaveLength(0);
    expect(screen.getByTestId("auton-worker-panel").textContent).toContain("Sin workers todavía");
  });
});
