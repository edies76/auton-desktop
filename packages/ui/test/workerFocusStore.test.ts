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
});

describe("foco del worker por workspace", () => {
  it("cierra el foco al cambiar de proyecto y lo conserva en el mismo", () => {
    const store = useAutonWorkerFocusStore.getState();
    store.open(WORKER, "workspace-a");
    closeWorkerFocusForWorkspace("workspace-a");
    expect(useAutonWorkerFocusStore.getState().workerId).toBe("worker-1");

    closeWorkerFocusForWorkspace("workspace-b");
    expect(useAutonWorkerFocusStore.getState().workerId).toBeNull();
  });

  it("el resumen lee el worker vivo por id, no el snapshot de apertura", () => {
    const store = useAutonWorkerFocusStore.getState();
    store.open(WORKER, "workspace-a");
    store.setLiveWorkers([{ ...WORKER, status: "terminado" }]);
    expect(focusedWorker(useAutonWorkerFocusStore.getState())?.status).toBe("terminado");
  });
});
