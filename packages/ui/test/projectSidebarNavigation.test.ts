// @vitest-environment jsdom
import { createElement, Fragment } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectSidebarListHeader } from "@/project-sidebar/ProjectSidebarListHeader.js";
import { ProjectSidebarNavigation } from "@/project-sidebar/ProjectSidebarNavigation.js";
import { TooltipProvider } from "@/components/ui/tooltip.js";

vi.mock("@/NewTaskButtonGroup.js", () => ({ NewTaskButtonGroup: () => null }));
vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({ intl: { formatMessage: ({ id }: { id: string }) => id } }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([
  ["MacIntel", "⌘ K"],
  ["Win32", "Ctrl+K"],
  ["Linux x86_64", "Ctrl+K"],
])(
  "SBV01: title row search icon opens existing search with the %s shortcut",
  async (platform, shortcut) => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform!);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(platform!);
    const onOpenCommandCenter = vi.fn();
    render(
      createElement(
        TooltipProvider,
        {},
        createElement(
          Fragment,
          {},
          createElement(ProjectSidebarNavigation, {
            props: {},
            onCreate: vi.fn(),
          }),
          createElement(ProjectSidebarListHeader, {
            onOpenCommandCenter,
            view: "projects",
            onViewChange: vi.fn(),
          }),
        ),
      ),
    );
    const search = screen.getByTestId("sidebar-search-open");
    expect(search.tagName).toBe("BUTTON");
    expect(search.querySelector("input")).toBeNull();
    expect(search.textContent).toBe("");
    expect(search.getAttribute("aria-label")).toBe("commandCenter.open");
    expect(screen.getByTestId("sidebar-search-toolbar").querySelector("kbd")).toBeNull();
    fireEvent.focus(search);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.querySelector('[data-slot="kbd"]')?.textContent).toBe(shortcut);
    fireEvent.click(search);
    expect(onOpenCommandCenter).toHaveBeenCalledOnce();
  },
);

it("SBV02: la cabecera no ofrece las vistas nativas de ZCode", () => {
  render(
    createElement(
      TooltipProvider,
      {},
      createElement(
        Fragment,
        {},
        createElement(ProjectSidebarNavigation, {
          props: {},
          onCreate: vi.fn(),
        }),
        createElement(ProjectSidebarListHeader, {
          onOpenCommandCenter: vi.fn(),
          view: "projects",
          onViewChange: vi.fn(),
        }),
      ),
    ),
  );

  expect(screen.queryByTestId("sidebar-view-menu")).toBeNull();
  expect(screen.queryByTestId("sidebar-view-projects")).toBeNull();
  expect(screen.queryByTestId("sidebar-view-timeline")).toBeNull();
  expect(screen.getByTestId("sidebar-list-title").textContent).toBe("project.projects");
});

it("SBV03: en workers la cabecera muestra el proyecto y su ruta, sin logo", () => {
  const onViewChange = vi.fn();
  render(
    createElement(
      TooltipProvider,
      null,
      createElement(ProjectSidebarListHeader, {
        onOpenCommandCenter: vi.fn(),
        view: "workers",
        onViewChange,
        projectName: "Lunar",
        projectPath: "/workspace/lunar",
      }),
    ),
  );
  const switcher = screen.getByTestId("auton-project-switcher");
  expect(switcher.textContent).toContain("Lunar");
  expect(switcher.textContent).toContain("/workspace/lunar");
  expect(switcher.querySelector("[data-desktop-logo-badge]")).toBeNull();
  expect(switcher.querySelector(".lucide-folder")).not.toBeNull();
  fireEvent.click(switcher);
  expect(onViewChange).toHaveBeenCalledWith("projects");
});

it("SBV04: la pantalla de entrada solo ofrece proyectos", () => {
  render(
    createElement(
      TooltipProvider,
      null,
      createElement(ProjectSidebarNavigation, {
        props: { onOpenAutomations: vi.fn(), onOpenPluginStore: vi.fn() },
        home: true,
        onCreate: vi.fn(),
      }),
      createElement(ProjectSidebarListHeader, {
        onOpenCommandCenter: vi.fn(),
        view: "projects",
        home: true,
        onViewChange: vi.fn(),
      }),
    ),
  );

  expect(screen.queryByTestId("plugin-store-sidebar-open")).toBeNull();
  expect(screen.queryByTestId("sidebar-search-open")).toBeNull();
  expect(screen.getByTestId("sidebar-list-title").textContent).toBe("project.projects");
});
