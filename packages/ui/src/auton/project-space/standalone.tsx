import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@zcode/ui/styles.css";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { AutonWorkspaceApp } from "./AutonWorkspaceApp.js";
import { projectAutonSpace } from "./projection.js";
import { sampleConversationRows, sampleProjects } from "./sample.js";
import type {
  AutonProject,
  AutonProjectSpaceData,
  AutonThreadMessage,
} from "./model.js";

/**
 * Montaje de la superficie de Auton para su entrada del renderer. Vive en el
 * módulo ui-auton: el HTML de escritorio solo apunta aquí.
 */
function PreviewRoot() {
  const [data, setData] = useState<AutonProjectSpaceData>(() =>
    projectAutonSpace({ rows: sampleConversationRows() }),
  );

  const send = (_project: AutonProject, text: string) => {
    const message: AutonThreadMessage = {
      id: `reply-${Date.now()}`,
      at: Date.now(),
      role: "orchestrator",
      text: `Recibido. Sigo con eso: ${text}`,
    };
    setData((current) => ({ ...current, messages: [...current.messages, message] }));
  };

  const stop = (_project: AutonProject, workerId: string) => {
    const message: AutonThreadMessage = {
      id: `stop-${Date.now()}`,
      at: Date.now(),
      role: "orchestrator",
      text: `Detuve a ${workerId}.`,
    };
    setData((current) => ({
      ...current,
      workers: current.workers.map((worker) =>
        worker.id === workerId
          ? { ...worker, status: "bloqueado", lastLine: "detenido a mano", lastSignalAt: Date.now() }
          : worker,
      ),
      messages: [...current.messages, message],
    }));
  };

  return (
    <AutonWorkspaceApp
      initialProjects={sampleProjects()}
      dataForProject={() => data}
      onSendMessage={send}
      onStopWorker={stop}
    />
  );
}

export function mountAutonSpace(container: HTMLElement): void {
  document.documentElement.classList.add("dark", "theme-zai-dark");
  createRoot(container).render(
    <ZCodeIntlProvider initialLocale="en-US">
      <PreviewRoot />
    </ZCodeIntlProvider>,
  );
}
