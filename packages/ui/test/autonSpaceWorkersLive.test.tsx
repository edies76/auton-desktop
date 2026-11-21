// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { IServiceAccessor } from "@zcode/services";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { ServiceProvider } from "@/hooks/useServices.js";
import type { ConversationStoreState } from "@/v4/conversationProjectionStore.js";
import type { SessionLease } from "@/v4/sessionDataLayer.js";
import { AutonSpaceLive } from "../src/auton/project-space/AutonSpaceLive.js";
import { createAutonSpaceProducer } from "../src/auton/project-space/spaceProducer.js";
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

const RUNNING_INDEX = JSON.stringify([
  {
    workerId: "agent_run",
    taskId: "agent_run",
    engine: "zcode",
    engineSessionId: "sess_auton_agent_run",
    workspace: "C:\\proyectos\\lunar\\.auton\\workers\\agent_run",
    status: "running",
    startedAt: "2026-11-02T12:00:00.000Z",
    transcriptFile: "C:\\proyectos\\lunar\\.auton\\workers\\agent_run\\worker-transcript.json",
    description: "landing viva",
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

const files = vi.hoisted(() => ({
  index: "" as string,
  transcript: "" as string,
}));
files.index = INDEX;
files.transcript = TRANSCRIPT;

const reads = vi.hoisted(() => ({ calls: [] as string[] }));

const services = {
  fileService: {
    readTextFile: vi.fn(async ({ path }: { path: string }) => {
      reads.calls.push(path);
      if (path.endsWith("index.json")) {
        return { path, content: files.index, offset: 0, bytesRead: files.index.length };
      }
      if (path.endsWith("worker-transcript.json")) {
        return {
          path,
          content: files.transcript,
          offset: 0,
          bytesRead: files.transcript.length,
        };
      }
      throw new Error(`ENOENT: ${path}`);
    }),
  },
} as unknown as IServiceAccessor;

afterEach(() => {
  cleanup();
  files.index = INDEX;
  files.transcript = TRANSCRIPT;
  reads.calls = [];
});

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

describe("espacio del proyecto: ticks, lecturas y productor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function flush(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  function mountLive() {
    return render(
      <ZCodeIntlProvider initialLocale="en-US">
        <ServiceProvider services={services}>
          <AutonSpaceLive lease={lease} project={PROJECT} onBack={vi.fn()} />
        </ServiceProvider>
      </ZCodeIntlProvider>,
    );
  }

  it("10 ticks con archivos intactos: a lo sumo 3 pasadas de lectura, no una por tick", async () => {
    files.index = RUNNING_INDEX;
    mountLive();
    await flush();
    // Pasada inicial: índice + transcripción.
    expect(reads.calls.length).toBe(2);

    const deltas: number[] = [];
    for (let tick = 0; tick < 10; tick += 1) {
      const before = reads.calls.length;
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
      await flush();
      deltas.push(reads.calls.length - before);
    }

    // Cadencia declarada: vuelve a leer a los 4 s y a los 8 s; en medio, nada.
    expect(deltas).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 0, 0]);
    const passes = 1 + deltas.filter((delta) => delta > 0).length;
    expect(passes).toBeLessThanOrEqual(3);
  });

  it("un cambio real en la transcripción aparece dentro de su intervalo", async () => {
    files.index = RUNNING_INDEX;
    mountLive();
    await flush();
    await flush();

    const row = document.querySelector('[data-worker-id="sess_auton_agent_run"]');
    expect(row).toBeTruthy();
    fireEvent.click(row!.querySelector('[data-testid="auton-worker-open"]')!);
    await flush();
    expect(screen.getByTestId("auton-worker-transcript").textContent ?? "").not.toContain(
      "avance nuevo",
    );

    files.transcript = JSON.stringify([
      { id: "t1", at: 1, kind: "message", role: "orchestrator", text: "primer encargo" },
      { id: "t2", at: 2, kind: "message", role: "worker", text: "primera respuesta" },
      { id: "t5", at: 5, kind: "message", role: "worker", text: "avance nuevo" },
    ]);

    // Dentro del intervalo declarado (4 s) la línea nueva ya se ve.
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    await flush();
    expect(screen.getByTestId("auton-worker-transcript").textContent ?? "").toContain(
      "avance nuevo",
    );
  });

  it("el productor del espacio conserva identidad sin cambios y refleja una fila nueva", () => {
    const produce = createAutonSpaceProducer("p1");
    const rows = sampleConversationRows();
    const agents: never[] = [];
    const sessionWorkers = [] as never[];

    const first = produce({ rows, agents, sessionWorkers });
    const second = produce({ rows, agents, sessionWorkers });
    expect(second).toBe(first);

    // El reloj avanza: la identidad no depende del tiempo.
    vi.setSystemTime(NOW + 60_000);
    const third = produce({ rows, agents, sessionWorkers });
    expect(third).toBe(first);

    // Una fila nueva (array nuevo) sí se refleja.
    const last = rows.at(-1)!;
    const newRow = {
      ...last,
      rowId: 9_999,
      createdAtSeq: 9_999,
      createdAt: NOW + 1,
      kind: "assistantText",
      text: "fila nueva",
    } as (typeof rows)[number];
    const withNewRow = [...rows, newRow];
    const fourth = produce({ rows: withNewRow, agents, sessionWorkers });
    expect(fourth).not.toBe(first);
    expect(fourth.messages.some((message) => message.text === "fila nueva")).toBe(true);
  });
});
