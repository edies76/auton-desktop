import { createRoot } from "react-dom/client";
import "@zcode/ui/styles.css";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import {
  AutonWorkspaceApp,
  demoDataForProject,
  demoProjects,
} from "@/auton/project-space/index.js";

document.documentElement.classList.add("dark", "theme-zai-dark");

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <ZCodeIntlProvider initialLocale="en-US">
      <AutonWorkspaceApp initialProjects={demoProjects()} dataForProject={demoDataForProject} />
    </ZCodeIntlProvider>,
  );
}
