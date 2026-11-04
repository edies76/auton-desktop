// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { IServiceAccessor } from "@zcode/services";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { ServiceProvider } from "@/hooks/useServices.js";
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

const STATE = {
  status: "live",
  snapshot: { rows: { window: sampleConversationRows() } },
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

const INDEX = JSON.stringify([
  {
    workerId: "agent_muse",
    taskId: "agent_muse",
    engine: "muse",
    engineSessionId: "muse-session-1",
    workspace: "C:\\proyectos\\lunar\\.auton\\workers\\agent_muse",
    status: "completed",
    startedAt: "2026-11-02T12:00:00.000Z",
    endedAt: "2026-11-02T12:00:10.000Z",
    transcriptFile: "C:\\proyectos\\lunar\\.auton\\workers\\agent_muse\\worker-transcript.json",
    description: "landing",
    mode: "build",
    effort: "standard",
  },
]);

const TRANSCRIPT = JSON.stringify([
  { id: "t1", at: 1, kind: "message", role: "orchestrator", text: "primer encargo" },
  { id: "t2", at: 2, kind: "message", role: "worker", text: "primera respuesta" },
  { id: "t3", at: 3, kind: "tool", text: "leyendo el proyecto", status: "completed" },
  { id: "t4", at: 4, kind: "close", text: "Turno completado.", status: "completed" },
]);

const services = {
  fileService: {
    readTextFile: vi.fn(async ({ path }: { path: string }) => {
      if (path.endsWith("index.json")) {
        return { path, content: INDEX, offset: 0, bytesRead: INDEX.length };
      }
      if (path.endsWith("worker-transcript.json")) {
        return { path, content: TRANSCRIPT, offset: 0, bytesRead: TRANSCRIPT.length };
      }
      throw new Error(`ENOENT: ${path}`);
    }),
  },
} as unknown as IServiceAccessor;

afterEach(cleanup);

describe("conversación real de los workers en el espacio", () => {
  it("lee el índice y la transcripción del workspace y los pinta en el detalle", async () => {
    render(
      <ZCodeIntlProvider initialLocale="en-US">
        <ServiceProvider services={services}>
          <AutonSpaceLive lease={lease} project={PROJECT} now={NOW} onBack={vi.fn()} />
        </ServiceProvider>
      </ZCodeIntlProvider>,
    );

    const open = await screen.findByLabelText("Abrir worker landing");
    fireEvent.click(open);

    await waitFor(() => {
      expect(screen.getByTestId("auton-worker-detail")).toBeTruthy();
    });
    const transcript = screen.getByTestId("auton-worker-transcript").textContent ?? "";
    expect(transcript).toContain("Orquestador: primer encargo");
    expect(transcript).toContain("primera respuesta");
    expect(transcript).toContain("leyendo el proyecto");
    expect(transcript).toContain("Turno completado.");
  });
});
