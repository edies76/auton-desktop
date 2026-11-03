import { useState } from "react";
import { AutonThreadView } from "./ThreadView.js";
import { AutonWorkerDetail } from "./WorkerDetail.js";
import { AutonWorkerPanel } from "./WorkerPanel.js";
import type { AutonProject, AutonProjectSpaceData } from "./model.js";

export interface AutonProjectSpaceProps {
  project: AutonProject;
  data: AutonProjectSpaceData;
  now: number;
  onBack: () => void;
  onStopWorker: (workerId: string) => void;
  onSend?: (text: string) => void;
}

/**
 * Pantalla 2: el espacio de un proyecto. Panel de workers a la izquierda y el
 * hilo del orquestador en el centro; el detalle de un worker ocupa el centro.
 */
export function AutonProjectSpace({
  project,
  data,
  now,
  onBack,
  onStopWorker,
  onSend,
}: AutonProjectSpaceProps) {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const selectedWorker = selectedWorkerId
    ? data.workers.find((worker) => worker.id === selectedWorkerId)
    : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="auton-project-space">
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="min-h-0 min-w-0 max-h-56 overflow-hidden border-border border-b lg:max-h-none lg:border-r lg:border-b-0">
          <AutonWorkerPanel
            workers={data.workers}
            now={now}
            selectedWorkerId={selectedWorkerId ?? undefined}
            onOpenWorker={(workerId) => setSelectedWorkerId(workerId)}
            onStopWorker={onStopWorker}
          />
        </div>
        <main className="min-h-0 min-w-0 overflow-hidden">
          {selectedWorker ? (
            <AutonWorkerDetail
              worker={selectedWorker}
              now={now}
              onBack={() => setSelectedWorkerId(null)}
            />
          ) : (
            <AutonThreadView
              project={project}
              data={data}
              now={now}
              onBack={onBack}
              onStopWorker={onStopWorker}
              onSend={onSend}
            />
          )}
        </main>
      </div>
    </div>
  );
}
