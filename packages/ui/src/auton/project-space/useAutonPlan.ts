// ============================================================
// Plan del proyecto — lectura viva desde el workspace
// ============================================================
// El tablero no habla con el modelo: lee `.auton/plan.json` con el servicio de
// archivos del host y refresca mientras la vista vive. Si el archivo no existe,
// el estado es "sin plan", no un error.

import { useEffect, useState } from "react";
import { useOptionalServices } from "@/hooks/useServices.js";
import { parseAutonPlanFile, planFilePath, type AutonPlanFile } from "./planFile.js";

interface FileTextReader {
  readTextFile(params: { path: string }): Promise<{ content: string }>;
}

export interface AutonPlanFileState {
  plan: AutonPlanFile | null;
  /** La primera lectura todavía no terminó. */
  loading: boolean;
}

export function useAutonPlan(
  workspaceRoot: string,
  pollMs = 1_500,
): AutonPlanFileState {
  const services = useOptionalServices();
  const fileService = services?.fileService as FileTextReader | undefined;
  const [state, setState] = useState<AutonPlanFileState>({
    plan: null,
    loading: Boolean(fileService && workspaceRoot),
  });

  useEffect(() => {
    if (!fileService || !workspaceRoot) {
      setState({ plan: null, loading: false });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const read = async (): Promise<void> => {
      try {
        const slice = await fileService.readTextFile({ path: planFilePath(workspaceRoot) });
        if (!cancelled) {
          setState({ plan: parseAutonPlanFile(slice.content), loading: false });
        }
      } catch {
        if (!cancelled) setState({ plan: null, loading: false });
      }
      if (!cancelled) timer = setTimeout(read, pollMs);
    };

    void read();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fileService, pollMs, workspaceRoot]);

  return state;
}
