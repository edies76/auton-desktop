import { afterEach, describe, expect, it } from "vitest";
import type { AutonWorkerView } from "../src/auton/project-space/model.js";
import {
  closeWorkerFocusForWorkspace,
  focusedWorker,
  useAutonWorkerFocusStore,
} from "../src/auton/project-space/workerFocusStore.js";

const WORKER: AutonWorkerView = {
  id: "worker-1",
  name: "Worker",
  status: "trabajando",
  startedAt: 0,
  lastSignalAt: 0,
  transcript: [],
};

afterEach(() => {
  useAutonWorkerFocusStore.getState().close();
  useAutonWorkerFocusStore.getState().setLiveWorkers([]);
});

describe("foco del worker por workspace", () => {
  it("cierra el foco al cambiar de proyecto y lo conserva en el mismo", () => {
    const store = useAutonWorkerFocusStore.getState();
    store.setLiveWorkers([WORKER]);
    store.select(WORKER.id, "workspace-a");
    closeWorkerFocusForWorkspace("workspace-a");
    expect(useAutonWorkerFocusStore.getState().selectedWorkerId).toBe("worker-1");

    closeWorkerFocusForWorkspace("workspace-b");
    expect(useAutonWorkerFocusStore.getState().selectedWorkerId).toBeNull();
    expect(useAutonWorkerFocusStore.getState().liveWorkers).toEqual([]);
  });

  it("la selección lee el worker vivo por id, no un snapshot de apertura", () => {
    const store = useAutonWorkerFocusStore.getState();
    store.setLiveWorkers([{ ...WORKER, status: "terminado" }]);
    store.select(WORKER.id, "workspace-a");
    expect(focusedWorker(useAutonWorkerFocusStore.getState())?.status).toBe("terminado");
  });

  it("seleccionar una fila no reemplaza la lista viva del panel", () => {
    const store = useAutonWorkerFocusStore.getState();
    store.setLiveWorkers([WORKER, { ...WORKER, id: "worker-2", name: "Otro" }]);
    store.select("worker-2", "workspace-a");

    expect(useAutonWorkerFocusStore.getState().liveWorkers).toHaveLength(2);
    expect(focusedWorker(useAutonWorkerFocusStore.getState())?.name).toBe("Otro");
  });
});
