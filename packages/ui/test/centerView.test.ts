import { describe, expect, it } from "vitest";
import {
  resolveCenterView,
  workerFromTaskMeta,
  type CenterViewInput,
} from "../src/auton/project-space/centerView.js";

const BASE: CenterViewInput = {
  activeTaskId: null,
  selectedWorkerId: null,
  selectionOrigin: null,
  orchestratorTaskId: "orch",
};

const WORKER_SESSION = "sess_auton_agent_1";
const OTHER_WORKER = "sess_subagent_agent_2";

describe("resolveCenterView", () => {
  const cases: Array<{ name: string; input: CenterViewInput; expected: unknown }> = [
    {
      name: "sin tarea activa ni selección muestra el orquestador",
      input: BASE,
      expected: { kind: "orchestrator" },
    },
    {
      name: "la tarea activa del orquestador muestra el orquestador",
      input: { ...BASE, activeTaskId: "orch" },
      expected: { kind: "orchestrator" },
    },
    {
      name: "una sesión de worker activa se muestra como worker-session",
      input: { ...BASE, activeTaskId: WORKER_SESSION },
      expected: {
        kind: "worker-session",
        taskId: WORKER_SESSION,
        canGoBack: true,
      },
    },
    {
      name: "sin orquestador la sesión de worker no puede parar ni volver",
      input: { ...BASE, activeTaskId: WORKER_SESSION, orchestratorTaskId: null },
      expected: {
        kind: "worker-session",
        taskId: WORKER_SESSION,
        canGoBack: false,
      },
    },
    {
      name: "la selección del panel gana sobre la tarea activa del orquestador",
      input: { ...BASE, activeTaskId: "orch", selectedWorkerId: "worker-panel", selectionOrigin: "panel" },
      expected: {
        kind: "worker-focus",
        workerId: "worker-panel",
        backToOrchestrator: false,
        canGoBack: true,
      },
    },
    {
      name: "la selección del panel gana sobre OTRA sesión de worker activa",
      input: {
        ...BASE,
        activeTaskId: WORKER_SESSION,
        selectedWorkerId: OTHER_WORKER,
        selectionOrigin: "panel",
      },
      expected: {
        kind: "worker-focus",
        workerId: OTHER_WORKER,
        backToOrchestrator: true,
        canGoBack: true,
      },
    },
    {
      name: "seleccionar la misma sesión de worker activa la trata como foco del panel",
      input: {
        ...BASE,
        activeTaskId: WORKER_SESSION,
        selectedWorkerId: WORKER_SESSION,
        selectionOrigin: "panel",
      },
      expected: {
        kind: "worker-focus",
        workerId: WORKER_SESSION,
        backToOrchestrator: true,
        canGoBack: true,
      },
    },
    {
      name: "el orquestador nunca entra como worker aunque se seleccione",
      input: { ...BASE, selectedWorkerId: "orch", selectionOrigin: "panel" },
      expected: { kind: "orchestrator" },
    },
    {
      name: "una selección de origen sesión no desplaza la sesión activa",
      input: {
        ...BASE,
        activeTaskId: WORKER_SESSION,
        selectedWorkerId: OTHER_WORKER,
        selectionOrigin: "session",
      },
      expected: {
        kind: "worker-session",
        taskId: WORKER_SESSION,
        canGoBack: true,
      },
    },
    {
      name: "un chat legado activo se trata como orquestador",
      input: { ...BASE, activeTaskId: "legacy-chat" },
      expected: { kind: "orchestrator" },
    },
    {
      name: "sin orquestador una selección de panel no ofrece parada",
      input: {
        ...BASE,
        orchestratorTaskId: null,
        selectedWorkerId: "worker-panel",
        selectionOrigin: "panel",
      },
      expected: {
        kind: "worker-focus",
        workerId: "worker-panel",
        backToOrchestrator: false,
        canGoBack: true,
      },
    },
    {
      name: "sin orquestador la selección del panel gana sobre la sesión de worker",
      input: {
        ...BASE,
        orchestratorTaskId: null,
        activeTaskId: WORKER_SESSION,
        selectedWorkerId: OTHER_WORKER,
        selectionOrigin: "panel",
      },
      expected: {
        kind: "worker-focus",
        workerId: OTHER_WORKER,
        backToOrchestrator: false,
        canGoBack: false,
      },
    },
    {
      name: "selección vacía con origen panel no inventa un worker",
      input: { ...BASE, activeTaskId: WORKER_SESSION, selectionOrigin: "panel" },
      expected: {
        kind: "worker-session",
        taskId: WORKER_SESSION,
        canGoBack: true,
      },
    },
    {
      name: "una selección que ya no existe vuelve al orquestador",
      input: {
        ...BASE,
        activeTaskId: "orch",
        selectedWorkerId: "worker-borrado",
        selectionOrigin: "panel",
        selectedWorkerExists: false,
      },
      expected: { kind: "orchestrator" },
    },
    {
      name: "una selección inexistente con worker activo cae en la sesión de worker",
      input: {
        ...BASE,
        activeTaskId: WORKER_SESSION,
        selectedWorkerId: "worker-borrado",
        selectionOrigin: "panel",
        selectedWorkerExists: false,
      },
      expected: {
        kind: "worker-session",
        taskId: WORKER_SESSION,
        canGoBack: true,
      },
    },
  ];

  for (const entry of cases) {
    it(entry.name, () => {
      expect(resolveCenterView(entry.input)).toEqual(entry.expected);
    });
  }
});

describe("workerFromTaskMeta", () => {
  it("deriva estado, nombre y reloj de la meta de la sesión", () => {
    const worker = workerFromTaskMeta({
      taskId: WORKER_SESSION,
      title: "Revisar README",
      meta: {
        taskId: WORKER_SESSION,
        traceId: "trace-1",
        title: "Revisar README",
        workspacePath: "/workspace/lunar",
        createdAt: 1_000,
        updatedAt: 5_000,
        mode: "build",
        status: "error",
        lastError: { message: "Sin permisos" },
      },
    });

    expect(worker).toMatchObject({
      id: WORKER_SESSION,
      name: "Revisar README",
      status: "bloqueado",
      startedAt: 1_000,
      lastSignalAt: 5_000,
      lastLine: "Sin permisos",
      kind: "agent",
      engine: "zcode",
    });
  });

  it("sin meta queda en espera y usa el reloj inyectado", () => {
    const worker = workerFromTaskMeta({
      taskId: WORKER_SESSION,
      title: " ",
      now: 9_000,
    });

    expect(worker).toMatchObject({
      name: "Worker",
      status: "esperando",
      startedAt: 9_000,
      lastSignalAt: 9_000,
    });
  });
});
