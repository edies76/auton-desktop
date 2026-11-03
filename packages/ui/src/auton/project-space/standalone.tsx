import { createRoot } from "react-dom/client";
import "@zcode/ui/styles.css";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { AutonWorkspaceApp } from "./AutonWorkspaceApp.js";
import { sampleConversationRows, sampleProjects } from "./sample.js";

/**
 * Montaje de la superficie de Auton para su entrada del renderer. Vive en el
 * módulo ui-auton: el HTML de escritorio solo apunta aquí.
 */
export function mountAutonSpace(container: HTMLElement): void {
  document.documentElement.classList.add("dark", "theme-zai-dark");
  createRoot(container).render(
    <ZCodeIntlProvider initialLocale="en-US">
      <AutonWorkspaceApp initialProjects={sampleProjects()} rows={sampleConversationRows()} />
    </ZCodeIntlProvider>,
  );
}
