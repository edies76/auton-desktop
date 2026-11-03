// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { AutonWorkerPanel } from "../src/auton/project-space/WorkerPanel.js";
import { AutonWorkerDetail } from "../src/auton/project-space/WorkerDetail.js";
import { AutonProjectSpace } from "../src/auton/project-space/ProjectSpaceScreen.js";
import type {
  AutonProject,
  AutonProjectSpaceData,
  AutonWorkerStatus,
  AutonWorkerView,
} from "../src/auton/project-space/model.js";
import { projectSessionWorkerView } from "../src/auton/project-space/sessionWorker.js";
import { transcriptFromMuseTurns } from "../../../apps/zcode-cli/packages/core/src/auton/workerTranscript.js";

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

function renderUi(ui: ReactElement) {
  return render(<ZCodeIntlProvider initialLocale="en-US">{ui}</ZCodeIntlProvider>);
}

function withIntl(ui: ReactElement) {
  return <ZCodeIntlProvider initialLocale="en-US">{ui}</ZCodeIntlProvider>;
}
const STATUSES: AutonWorkerStatus[] = [
  "trabajando",
  "preguntando",
  "esperando",
  "bloqueado",
  "terminado",
];

function worker(id: string, status: AutonWorkerStatus, overrides: Partial<AutonWorkerView> = {}): AutonWorkerView {
  return {
    id,
    name: `worker ${id}`,
    status,
    startedAt: NOW - 65_000,
    lastSignalAt: NOW - 2_000,
    lastLine: "línea viva",
    transcript: [
      { id: `${id}-e1`, at: NOW - 50_000, kind: "message", text: "trabajando en el encargo" },
      { id: `${id}-e2`, at: NOW - 20_000, kind: "tool", text: "Edit src/chat.tsx" },
    ],
    ...overrides,
  };
}

const WORKERS = STATUSES.map((status, index) => worker(`w${index + 1}`, status));

const PROJECT: AutonProject = {
  id: "p1",
  name: "Lunar móvil",
  path: "C:\\proyectos\\lunar",
  lastActiveAt: NOW,
};

const DATA: AutonProjectSpaceData = {
  messages: [
    { id: "m1", at: NOW - 120_000, role: "human", text: "Mejora el diseño del chat." },
    { id: "m2", at: NOW - 110_000, role: "orchestrator", text: "Reparto dos frentes." },
  ],
  workers: WORKERS,
  tramos: [{ id: "t1", startedAt: NOW - 120_000, workerIds: WORKERS.map((entry) => entry.id) }],
};

afterEach(cleanup);

describe("panel de workers", () => {
  it("pinta los cinco estados con etiqueta distinta", () => {
    renderUi(
      <AutonWorkerPanel workers={WORKERS} now={NOW} onOpenWorker={vi.fn()} onStopWorker={vi.fn()} />,
    );

    const rows = screen.getAllByTestId("auton-worker-row");
    expect(rows).toHaveLength(5);
    const labels = rows.map((row) => within(row).getByTestId("auton-worker-status").textContent);
    expect(labels).toEqual(["Trabajando", "Preguntando", "Esperando", "Bloqueado", "Terminado"]);
    expect(new Set(rows.map((row) => row.dataset.status))).toEqual(new Set(STATUSES));
  });

  it("muestra el reloj y avanza con el reloj inyectado", () => {
    const { rerender } = renderUi(
      <AutonWorkerPanel workers={WORKERS} now={NOW} onOpenWorker={vi.fn()} onStopWorker={vi.fn()} />,
    );

    const row = screen.getAllByTestId("auton-worker-row")[0]!;
    expect(within(row).getByTestId("auton-worker-clock").textContent).toBe("01:05");

    rerender(
      withIntl(
        <AutonWorkerPanel
          workers={WORKERS}
          now={NOW + 10_000}
          onOpenWorker={vi.fn()}
          onStopWorker={vi.fn()}
        />,
      ),
    );
    expect(within(row).getByTestId("auton-worker-clock").textContent).toBe("01:15");
  });

  it("un worker callado se ve callado, con parpadeo", () => {
    const silent = worker("w9", "trabajando", { lastSignalAt: NOW - 75_000 });
    const { container } = renderUi(
      <AutonWorkerPanel workers={[silent]} now={NOW} onOpenWorker={vi.fn()} onStopWorker={vi.fn()} />,
    );

    const silence = screen.getByTestId("auton-worker-silence");
    expect(silence.textContent).toBe("sin señales hace 1m");
    expect(silence.className).toContain("animate-pulse");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("el control de parada llama al worker correcto y no abre el detalle", () => {
    const onOpenWorker = vi.fn();
    const onStopWorker = vi.fn();
    renderUi(
      <AutonWorkerPanel
        workers={WORKERS}
        now={NOW}
        onOpenWorker={onOpenWorker}
        onStopWorker={onStopWorker}
      />,
    );

    const second = screen.getAllByTestId("auton-worker-row")[1]!;
    fireEvent.click(within(second).getByTestId("auton-worker-stop"));

    expect(onStopWorker).toHaveBeenCalledWith("w2");
    expect(onOpenWorker).not.toHaveBeenCalled();
  });

  it("el control de parada usa el identificador del worker, no el de la sesión", () => {
    const onStopWorker = vi.fn();
    const sessionWorker = projectSessionWorkerView({
      agentId: "agent_1",
      description: "landing",
      status: "running",
      startedAt: NOW - 30_000,
      childSessionId: "sess_auton_agent_1",
    });

    renderUi(
      <AutonWorkerPanel
        workers={[sessionWorker]}
        now={NOW}
        onOpenWorker={vi.fn()}
        onStopWorker={onStopWorker}
      />,
    );

    fireEvent.click(screen.getByTestId("auton-worker-stop"));
    expect(onStopWorker).toHaveBeenCalledWith("agent_1");
  });

  it("la fila abre el detalle y el detalle no tiene campo de texto", () => {
    const onOpenWorker = vi.fn();
    renderUi(
      <AutonWorkerPanel
        workers={WORKERS}
        now={NOW}
        onOpenWorker={onOpenWorker}
        onStopWorker={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByTestId("auton-worker-open")[0]!);
    expect(onOpenWorker).toHaveBeenCalledWith("w1");
  });

  it("el detalle muestra la conversación, no tiene input y vuelve atrás", () => {
    const onBack = vi.fn();
    const { container } = renderUi(
      <AutonWorkerDetail worker={WORKERS[0]!} now={NOW} onBack={onBack} />,
    );

    expect(screen.getByTestId("auton-worker-transcript").textContent).toContain(
      "trabajando en el encargo",
    );
    expect(container.querySelector("textarea, input, [contenteditable='true']")).toBeNull();

    fireEvent.click(screen.getByTestId("auton-worker-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("espacio del proyecto", () => {
  it("tiene un solo campo de texto, en el hilo del orquestador", () => {
    const { container } = renderUi(
      <AutonProjectSpace
        project={PROJECT}
        data={DATA}
        now={NOW}
        onBack={vi.fn()}
        onStopWorker={vi.fn()}
      />,
    );

    const textboxes = container.querySelectorAll("textarea, input:not([type='button']), [contenteditable='true']");
    expect(textboxes).toHaveLength(1);
    expect(screen.getByTestId("auton-composer")).toBe(textboxes[0]);
    expect(screen.getByTestId("auton-orchestrator-badge").textContent).toContain("Orquestador");
    expect(screen.getAllByTestId("auton-worker-row")[0]!.dataset.role).toBe("worker");
  });

  it("abrir un worker muestra su detalle sin campo de texto y atrás vuelve al hilo", () => {
    const { container } = renderUi(
      <AutonProjectSpace
        project={PROJECT}
        data={DATA}
        now={NOW}
        onBack={vi.fn()}
        onStopWorker={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByTestId("auton-worker-open")[0]!);
    expect(screen.getByTestId("auton-worker-detail")).toBeTruthy();
    expect(screen.queryByTestId("auton-composer")).toBeNull();
    expect(container.querySelector("textarea, input, [contenteditable='true']")).toBeNull();

    fireEvent.click(screen.getByTestId("auton-worker-back"));
    expect(screen.getByTestId("auton-composer")).toBeTruthy();
  });

  it("el detalle muestra la conversación completa del motor", () => {
    const transcript = transcriptFromMuseTurns(
      [
        {
          turnId: "turn-1",
          userText: "primer encargo",
          assistantText: "listo, revisé todo",
          items: [
            {
              itemId: "u1",
              kind: "userMessage",
              status: "completed",
              text: "primer encargo",
            },
            {
              itemId: "tool-1",
              kind: "toolCall",
              status: "completed",
              summary: "leyendo el proyecto",
            },
            {
              itemId: "a1",
              kind: "agentMessage",
              status: "completed",
              text: "listo, revisé todo",
            },
          ],
          terminal: "completed",
        },
      ],
      NOW - 20_000,
    );
    const sessionWorker = projectSessionWorkerView({
      agentId: "agent_muse",
      description: "muse",
      status: "completed",
      startedAt: NOW - 20_000,
      completedAt: NOW,
      childSessionId: "sess_auton_agent_muse",
      transcript,
    });

    renderUi(<AutonWorkerDetail worker={sessionWorker} now={NOW} onBack={vi.fn()} />);

    const visible = screen.getByTestId("auton-worker-transcript").textContent ?? "";
    expect(visible).toContain("Orquestador: primer encargo");
    expect(visible).toContain("leyendo el proyecto");
    expect(visible).toContain("listo, revisé todo");
    expect(visible).toContain("Turno completado.");
    expect(
      screen.getByTestId("auton-worker-transcript").querySelector('[data-event-kind="close"]'),
    ).toBeTruthy();
  });
});
