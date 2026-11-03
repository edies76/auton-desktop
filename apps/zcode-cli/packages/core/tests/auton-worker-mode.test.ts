import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTON_WORKER_MODE,
  autonWorkerWorkspacePath,
  parseAutonWorkerMode,
  resolveAutonWorkerMode,
  resolveAutonWorkerPlacement,
  resolveWorkerBrowserScope,
  shouldRegisterCoordinatorChannel,
} from "../src/auton/worker-mode.js";

describe("interruptor del worker", () => {
  it("por defecto usa el modo de siempre", () => {
    expect(DEFAULT_AUTON_WORKER_MODE).toBe("subagent");
    expect(resolveAutonWorkerMode()).toBe("subagent");
    expect(resolveAutonWorkerMode({ env: "" })).toBe("subagent");
  });

  it("entiende los dos valores y rechaza lo demás", () => {
    expect(parseAutonWorkerMode("SESSION")).toBe("session");
    expect(parseAutonWorkerMode(" subagent ")).toBe("subagent");
    expect(parseAutonWorkerMode("otro")).toBeUndefined();
    expect(parseAutonWorkerMode(undefined)).toBeUndefined();
  });

  it("el despacho manda sobre el interruptor, y el interruptor sobre el default", () => {
    expect(resolveAutonWorkerMode({ requested: "session", env: "subagent" })).toBe("session");
    expect(resolveAutonWorkerMode({ env: "session" })).toBe("session");
    expect(resolveAutonWorkerMode({ env: "basura", fallback: "session" })).toBe("session");
  });
});

describe("colocación del worker", () => {
  const base = {
    parentWorkingDirectory: "C:/proyecto",
    workspaceRoot: "C:/proyecto",
    workerSessionId: "sess_auton_1",
  };

  it("en modo subagente reproduce el comportamiento de hoy", () => {
    const placement = resolveAutonWorkerPlacement({
      ...base,
      mode: "subagent",
      subagentToolAllowlist: ["Read", "Grep"],
    });

    expect(placement).toMatchObject({
      mode: "subagent",
      taskType: "subagent_child",
      toolAllowlist: ["Read", "Grep"],
      workingDirectory: "C:/proyecto",
      browserOwner: "parent",
      isolatedWorkspace: false,
    });
  });

  it("en modo sesión abre juego completo, espacio propio y navegador propio", () => {
    const placement = resolveAutonWorkerPlacement({
      ...base,
      mode: "session",
      subagentToolAllowlist: ["Read", "Grep"],
    });

    expect(placement.taskType).toBe("auton_worker_session");
    expect(placement.toolAllowlist).toBeUndefined();
    expect(placement.browserOwner).toBe("worker");
    expect(placement.isolatedWorkspace).toBe(true);
    expect(placement.workingDirectory).not.toBe(base.parentWorkingDirectory);
    expect(placement.workingDirectory).toContain("workers");
  });

  it("dos workers de sesión no comparten carpeta", () => {
    const first = autonWorkerWorkspacePath({
      workspaceRoot: base.workspaceRoot,
      workerSessionId: "sess_auton_1",
    });
    const second = autonWorkerWorkspacePath({
      workspaceRoot: base.workspaceRoot,
      workerSessionId: "sess_auton_2",
    });

    expect(first).not.toBe(second);
    expect(first.replaceAll("\\", "/").startsWith(base.workspaceRoot)).toBe(true);
  });

  it("el canal del coordinador se registra con el puerto, en cualquiera de los dos modos", () => {
    expect(shouldRegisterCoordinatorChannel({ hasCoordinatorPort: true })).toBe(true);
    expect(shouldRegisterCoordinatorChannel({ hasCoordinatorPort: false })).toBe(false);
  });

  it("el navegador queda del lado del worker en modo sesión y muestra la pestaña en el padre", () => {
    const session = resolveWorkerBrowserScope({
      mode: "session",
      childSessionId: "sess_auton_1",
      parentSessionId: "sess_orchestrator",
    });
    expect(session).toEqual({
      owner: "worker",
      childSessionId: "sess_auton_1",
      parentSessionId: "sess_orchestrator",
      tabOwner: "parent",
    });

    const subagent = resolveWorkerBrowserScope({
      mode: "subagent",
      childSessionId: "sess_auton_1",
      parentSessionId: "sess_orchestrator",
    });
    expect(subagent.owner).toBe("parent");
  });
});
