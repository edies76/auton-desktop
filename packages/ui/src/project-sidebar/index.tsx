import { SidebarTooltipProvider } from "@/ControlHintTooltip.js";
export { AutonProjectList } from "@/project-sidebar/AutonProjectList.js";
export { readProjectSidebarView } from "@/project-sidebar/view-preference.js";
export { ArchiveManagement } from "@/project-sidebar/ArchiveManagement.js";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollFadeViewport } from "@/components/ui/scroll-fade-viewport.js";
import { TID_SIDEBAR } from "@zcode/shared/test-ids";
import { remoteHostIdFromWorkspaceIdentity } from "@/project-sidebar/contract.js";
import type {
  ProjectSidebarProps,
  VirtualProject,
  Locale,
  Theme,
  RemoteProjectHost,
} from "@/project-sidebar/contract.js";
import { useProjectDirectory } from "@/project-sidebar/ProjectDirectoryProvider.js";
export {
  ProjectDirectoryProvider,
  useOptionalProjectDirectory,
} from "@/project-sidebar/ProjectDirectoryProvider.js";
export { ProjectComposerMenu } from "@/project-sidebar/ProjectComposerMenu.js";
import { AutonWorkersSidebar } from "@/project-sidebar/AutonWorkersSidebar.js";
import { AutonProjectPicker } from "@/project-sidebar/AutonProjectPicker.js";
import { useAutonHomeStore } from "@/auton/index.js";
import {
  captureV4ComposerDraftHandoff,
} from "@/v4/composer/composerDraftWorkspaceTransfer.js";
import {
  persistV4ComposerDraft,
  readV4ComposerDraft,
  resolveComposerScope,
} from "@/v4/composer/composerDraftStore.js";
import {
  claimProjectConversationCreation,
  ensureProjectConversation,
  isPromotableProjectTask,
  projectConversationKey,
  rememberProjectOrchestrator,
  shouldOpenProjectOrchestrator,
} from "@/project-sidebar/projectConversation.js";
import { useAutonProjectConversationStore } from "@/project-sidebar/projectConversationStore.js";
import { useProjectTaskNavigation } from "@/project-sidebar/useProjectTaskNavigation.js";
import { selectSortedProjects, projectKey } from "@/project-sidebar/view.js";
import { ProjectCreation } from "@/project-sidebar/ProjectCreation.js";
import { ProjectEditor } from "@/project-sidebar/ProjectEditor.js";
import { RemoteProjectPicker } from "@/project-sidebar/RemoteProjectPicker.js";
import { ProjectSidebarListHeader } from "@/project-sidebar/ProjectSidebarListHeader.js";
import { ProjectSidebarNavigation } from "@/project-sidebar/ProjectSidebarNavigation.js";
import { HomeOnlyWorkspaceRows } from "@/project-sidebar/HomeOnlyWorkspaceRows.js";
import { WorkspaceSidebarFooter } from "@/WorkspaceSidebarFooter.js";
import { SidebarBottomActivity } from "@/sidebar-activity/SidebarBottomActivity.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { useTabStoreApi } from "@/store/TabStoreProvider.js";
import { useZCodeSessionStore } from "@/store/zcodeSessionStore.js";
import { useZCodeStore } from "@/store/StoreProvider.js";
import { useCodingPlanUpgradeDialog } from "@/settings/CodingPlanUpgradeDialogProvider.js";
export { attachRemoteProjectWorkspace } from "@/project-sidebar/remote-navigation.js";
export { resolveEntryProject } from "@/project-sidebar/view.js";
export type {
  SidebarFileTreeOpenRequest,
  ProjectSidebarProps,
} from "@/project-sidebar/contract.js";

const PROJECT_START_PROMPT =
  "Arranca la conversación de este proyecto: preséntate en una frase como el orquestador, di que estás listo y pregunta qué quiere hacer el humano. No abras workers ni toques archivos hasta que responda.";

// 右侧面板显隐曾让所有项目的菜单和 Tooltip 重渲染；只隔离无关父更新，保留目录/context 订阅。
export const ProjectSidebar = memo(function ProjectSidebar(props: ProjectSidebarProps) {
  const {
    tree: authoritativeTree,
    directory,
    service,
    remoteService,
    availability,
    refresh,
    error,
    loading,
    preferences,
  } = useProjectDirectory();
  const tree = authoritativeTree;
  const onSelectTask = useProjectTaskNavigation(props, tree, remoteService);
  const { intl, localePreference, setLocalePreference } = useZCodeIntl();
  const tabStore = useTabStoreApi();
  const setTheme = useZCodeStore((state) => state.setTheme);
  const { openCodingPlanUpgrade } = useCodingPlanUpgradeDialog();
  const { view: storedView, setView } = preferences;
  const homeVisible = useAutonHomeStore((state) => state.homeVisible);
  const enterProject = useAutonHomeStore((state) => state.enterProject);
  // El arranque vive en la pantalla de proyectos; dentro de un proyecto manda
  // la preferencia guardada (workers por defecto).
  const view = homeVisible ? "projects" : storedView === "projects" ? "projects" : "workers";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<{ project: VirtualProject | null } | null>(null);
  const [creating, setCreating] = useState(false);
  // 当前任务只影响远端“创建项目”的默认设备；分组继承在点击时读，
  // 避免本地会话/草稿切换让全部项目的菜单与 Tooltip 重渲染。
  const hasActiveRemoteTask = useZCodeSessionStore((state) =>
    Boolean(
      props.workspaceIdentity &&
      state.workspaces[props.workspaceIdentity.trim() || props.workspacePath]?.activeTaskId,
    ),
  );
  const [remotePicker, setRemotePicker] = useState<RemoteProjectHost | null>(null);
  const activeTaskId = useZCodeSessionStore((state) => {
    const workspaceKey = props.workspaceIdentity?.trim() || props.workspacePath;
    return state.workspaces[workspaceKey]?.activeTaskId ?? null;
  });
  const workspaceKey = props.workspaceIdentity?.trim() || props.workspacePath;
  const activeProject = useMemo(() => {
    const activeProjectId = activeTaskId
      ? tree.tasks.find((task) => task.taskId === activeTaskId)?.projectId
      : null;
    const latestProjectId = tree.tasks.find((task) => !task.archived)?.projectId;
    return (
      tree.projects.find((project) => project.id === activeProjectId) ??
      tree.projects.find((project) => project.id === latestProjectId) ??
      tree.projects[0] ??
      null
    );
  }, [activeTaskId, tree.projects, tree.tasks]);
  const activeConversation = useMemo(() => {
    if (!activeProject) return null;
    const key = projectConversationKey(workspaceKey, activeProject.id);
    const projectTasks = tree.tasks.filter((task) => task.projectId === activeProject.id);
    return {
      key,
      conversation: ensureProjectConversation(key, projectTasks, activeTaskId),
    };
  }, [activeProject, activeTaskId, tree.tasks, workspaceKey]);
  // El shell no conoce el árbol de proyectos; publica la identidad resuelta
  // para etiquetar el hilo como orquestador solo cuando de verdad lo es.
  useEffect(() => {
    const state = useAutonProjectConversationStore.getState();
    if (!activeProject || !activeConversation?.conversation.orchestratorTaskId) {
      state.clear();
      return;
    }
    state.publish({
      workspaceKey,
      projectId: activeProject.id,
      orchestratorTaskId: activeConversation.conversation.orchestratorTaskId,
      legacyTaskIds: activeConversation.conversation.legacyTaskIds,
    });
  }, [activeConversation, activeProject, workspaceKey]);
  const autoOpenedRef = useRef<string | null>(null);
  const createdConversationRef = useRef<Set<string>>(new Set());
  // Al abrir un proyecto, se abre directo su única conversación de orquestador.
  // En la pantalla de proyectos no se crea ni se abre nada.
  useEffect(() => {
    if (homeVisible) return;
    const orchestratorId = activeConversation?.conversation.orchestratorTaskId;
    if (orchestratorId) {
      if (autoOpenedRef.current === orchestratorId) return;
      // La sesión activa manda salvo que sea un chat legado del proyecto; en
      // ese caso se abre la conversación persistida del orquestador.
      if (
        !shouldOpenProjectOrchestrator({
          activeTaskId,
          orchestratorTaskId: orchestratorId,
          legacyTaskIds: activeConversation?.conversation.legacyTaskIds ?? [],
        })
      ) {
        return;
      }
      const orchestrator = tree.tasks.find((task) => task.taskId === orchestratorId);
      if (!orchestrator) return;
      autoOpenedRef.current = orchestratorId;
      onSelectTask(
        orchestrator.workspacePath,
        orchestrator.taskId,
        orchestrator.workspaceIdentity,
      );
      return;
    }
    // Proyecto sin conversación: se crea su chat principal y el orquestador
    // arranca el hilo con una presentación proactiva, sin bienvenida aparte.
    if (!activeProject) return;
    const key = projectConversationKey(workspaceKey, activeProject.id);
    if (!claimProjectConversationCreation(createdConversationRef.current, key)) return;
    props.onCreateTask({
      projectId: activeProject.id,
      taskGroupId: null,
      initialPrompt: PROJECT_START_PROMPT,
    });
  }, [
    activeConversation,
    activeProject,
    activeTaskId,
    homeVisible,
    onSelectTask,
    props,
    tree.tasks,
    workspaceKey,
  ]);
  // Una sesión nueva del proyecto (no legada) pasa a ser la conversación del
  // orquestador; así sigue habiendo un solo chat.
  useEffect(() => {
    if (!activeTaskId || !activeConversation || !activeProject) return;
    if (activeConversation.conversation.orchestratorTaskId === activeTaskId) return;
    if (
      !isPromotableProjectTask({
        taskId: activeTaskId,
        legacyTaskIds: activeConversation.conversation.legacyTaskIds,
      })
    ) {
      return;
    }
    const belongs = tree.tasks.some(
      (task) => task.taskId === activeTaskId && task.projectId === activeProject.id,
    );
    if (!belongs) return;
    rememberProjectOrchestrator(activeConversation.key, activeTaskId);
  }, [activeConversation, activeProject, activeTaskId, tree.tasks]);
  const projects = preferences.sort(selectSortedProjects(tree));
  const selectProject = useCallback(
    (project: VirtualProject) => {
      enterProject();
      const key = projectConversationKey(workspaceKey, project.id);
      const projectTasks = tree.tasks.filter((task) => task.projectId === project.id);
      const conversation = ensureProjectConversation(key, projectTasks, activeTaskId);
      const orchestrator = tree.tasks.find(
        (task) => task.taskId === conversation.orchestratorTaskId,
      );
      if (orchestrator) {
        // Lo que el humano escribió en la pantalla de entrada viaja al chat del
        // proyecto. Si el proyecto ya tenía un borrador con texto, ese manda.
        if (homeVisible) {
          const handoff = captureV4ComposerDraftHandoff(
            props.workspacePath,
            props.workspaceIdentity,
          );
          if (handoff.draft.text.trim()) {
            const targetScope = resolveComposerScope(project.id, props.workspaceIdentity);
            const targetDraft = readV4ComposerDraft(
              props.workspacePath,
              props.workspaceIdentity,
              orchestrator.taskId,
              targetScope,
            );
            if (!targetDraft?.text.trim()) {
              persistV4ComposerDraft(
                props.workspacePath,
                props.workspaceIdentity,
                orchestrator.taskId,
                { ...handoff.draft, projectId: undefined, taskGroupId: undefined },
                targetScope,
              );
            }
          }
        }
        onSelectTask(
          orchestrator.workspacePath,
          orchestrator.taskId,
          orchestrator.workspaceIdentity,
        );
      } else {
        props.onCreateTask({
          projectId: project.id,
          taskGroupId: null,
          initialPrompt: PROJECT_START_PROMPT,
        });
      }
      setView("workers");
    },
    [
      activeTaskId,
      enterProject,
      homeVisible,
      onSelectTask,
      props,
      setView,
      tree.tasks,
      workspaceKey,
    ],
  );
  const openSettings = useCallback(() => {
    tabStore.getState().openSettingsTab();
  }, [tabStore]);
  const changeLocale = useCallback(
    (value: string) => setLocalePreference(value as Locale | "system"),
    [setLocalePreference],
  );
  const changeTheme = useCallback((value: string) => setTheme(value as Theme), [setTheme]);
  const upgrade = useCallback<
    NonNullable<Parameters<typeof WorkspaceSidebarFooter>[0]["onUpgradeClick"]>
  >(
    (providerId, funnelContext) => openCodingPlanUpgrade({ providerId, funnelContext }),
    [openCodingPlanUpgrade],
  );
  const banner = useMemo(() => <SidebarBottomActivity />, []);
  // 手机远控 home-only 没有 base attachment，也就没有项目契约；改用 relay 层工作区列表与重连入口。
  const homeOnlySwitcher = service ? undefined : props.webRemoteControlWorkspaceSwitcher;
  return (
    <SidebarTooltipProvider>
        <aside data-testid={TID_SIDEBAR} className="flex h-full min-h-0 flex-col overflow-hidden">
          <div
            className={`h-12 shrink-0 [app-region:drag] ${props.isWebRemoteControl ? "max-md:hidden" : ""}`}
          />
          {/* 内联改名聚焦曾把 hidden 容器横向滚动，导致手机整栏左移；滑动面板只裁切，不允许焦点滚动。 */}
          <div className="relative min-h-0 flex-1 overflow-clip">
            <div
              data-project-sidebar-panel="navigation"
              className="absolute inset-0 flex min-h-0 flex-col"
            >
              {/* 原因：顶层新建显式传 null 会抹掉当前项目；省略归属，让 Root 与快捷键共用继承路径。 */}
              <ProjectSidebarNavigation
                props={props}
                home={homeVisible}
                onCreate={() => props.onCreateTask()}
              />
              <div
                data-testid="sidebar-task-list-region"
                className="flex min-h-0 flex-1 flex-col border-t border-border/50 pt-3 [anchor-name:--sidebar-task-list-divider]"
              >
                <ProjectSidebarListHeader
                  onOpenCommandCenter={props.onOpenCommandCenter}
                  view={view}
                  home={homeVisible}
                  onViewChange={setView}
                  projectName={activeProject?.name}
                  projectPath={activeProject?.roots[0]?.rootPath}
                  onAddProject={service ? () => setCreating(true) : undefined}
                />
                {/* 原因：仅设 overflow-y:auto 会让拖拽位移打开水平滚动；列表始终只允许纵向滚动。 */}
                {/* 原因：项目侧栏迁移后普通滚动容器遗漏边缘渐隐；复用统一 mask，随实际滚动边界更新。 */}
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <ScrollFadeViewport ref={scrollRef} className="overflow-x-hidden">
                    <div className="flex flex-col gap-3 pb-3">
                      {homeOnlySwitcher ? (
                        <HomeOnlyWorkspaceRows switcher={homeOnlySwitcher} />
                      ) : view === "projects" ? (
                        <AutonProjectPicker
                          projects={projects}
                          activeProjectId={homeVisible ? null : (activeProject?.id ?? null)}
                          onSelect={selectProject}
                        />
                      ) : (
                        <AutonWorkersSidebar
                          workspacePath={props.workspacePath}
                          workspaceIdentity={props.workspaceIdentity}
                          workspaceRemoteSessionId={props.workspaceRemoteSessionId}
                          orchestratorTaskId={
                            activeConversation?.conversation.orchestratorTaskId ?? null
                          }
                        />
                      )}                      {loading && !homeOnlySwitcher ? (
                        <p className="px-4 text-ui-sm text-foreground-subtle">
                          {intl.formatMessage({ id: "common.loading" })}
                        </p>
                      ) : null}
                      {error && !homeOnlySwitcher ? (
                        <p role="alert" className="px-4 text-ui-sm text-destructive">
                          {error}
                        </p>
                      ) : null}
                    </div>
                  </ScrollFadeViewport>
                </div>
              </div>
              <WorkspaceSidebarFooter
                className="pr-3"
                theme={props.theme}
                localeMenuValue={localePreference}
                onLocaleChange={changeLocale}
                onThemeChange={changeTheme}
                onSettingsButtonClick={openSettings}
                onUsageClick={openSettings}
                onUpgradeClick={upgrade}
                onLogin={props.onLogin}
                onLogout={props.onLogout}
                user={props.user}
                workspacePath={props.workspacePath}
                // 项目侧栏不再从 tab 反推身份；远控入口必须沿用当前 attachment 的精确 scope。
                workspaceIdentity={props.workspaceIdentity}
                workspaceRemoteSessionId={props.workspaceRemoteSessionId}
                isDesktop={props.isDesktop}
                banner={banner}
              />
            </div>
          </div>
          {creating && service && remoteService ? (
            <ProjectCreation
              workspacePath={props.workspacePath}
              workspaceIdentity={props.workspaceIdentity}
              onCreateTask={(request) => {
                enterProject();
                setView("workers");
                props.onCreateTask(request);
              }}
              directory={directory}
              defaultDeviceId={
                hasActiveRemoteTask && props.workspaceIdentity
                  ? (remoteHostIdFromWorkspaceIdentity(props.workspaceIdentity) ?? "local")
                  : "local"
              }
              allowDeviceManagement={props.isDesktop === true}
              projects={tree.projects}
              service={service}
              remoteService={remoteService}
              onOpenRemoteWorkspace={props.onOpenRemoteWorkspace}
              onClose={() => setCreating(false)}
              onSaved={refresh}
            />
          ) : null}
          {remotePicker && service && remoteService ? (
            <RemoteProjectPicker
              key={remotePicker.membershipId}
              host={remotePicker}
              service={service}
              remoteService={remoteService}
              onClose={() => setRemotePicker(null)}
              onSaved={refresh}
            />
          ) : null}
          {editor && service ? (
            <ProjectEditor
              key={editor.project?.id ?? "new"}
              project={editor.project}
              host={directory.hosts.find((host) => host.id === editor.project?.hostId)}
              projects={tree.projects.filter(
                (project) => !availability.get(projectKey(project))?.entryId,
              )}
              service={service}
              onClose={() => setEditor(null)}
              onSaved={refresh}
              onDeleted={refresh}
            />
          ) : null}
        </aside>
      </SidebarTooltipProvider>
  );
});

export { ComposerSubmissionPendingContext } from "@/project-sidebar/ComposerSubmissionPendingContext.js";
