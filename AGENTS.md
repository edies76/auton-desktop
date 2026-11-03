<!-- AUTON: reglas de este proyecto. Lo que sigue debajo de este bloque es de ZCode y se respeta igual. -->

# Auton Desktop - reglas de este repositorio

**El documento central es [AUTON-VISION.md](./context/AUTON-VISION.md).** Antes de proponer arquitectura,
producto, UI o prioridades, leelo. Si lo que vas a hacer contradice la vision, pregunta antes de
escribir codigo.

## ANTES DE TOCAR NADA (leer en este orden)

Esto es lo que falta en el resto de la guia: **el contexto de lo que ya se decidio**. Son tres lecturas
y no son opcionales:

1. **[`context/EMPIEZA-AQUI.md`](context/EMPIEZA-AQUI.md)** — el punto de entrada unico: que es Auton en tres
   lineas, que documentos importan y **cuales estan podados** (no los leas), el estado real de hoy y lo
   que sigue en orden.
2. **[`context/REPARTO-DE-TRABAJO.md`](context/REPARTO-DE-TRABAJO.md)** — quien hace que en las tres etapas,
   con la definicion de "hecho" de cada pieza y las reglas no negociables.
3. **[`context/ARQUITECTURA-ORQUESTADOR.md`](context/ARQUITECTURA-ORQUESTADOR.md)** — la spec de trabajo del
   orquestador: bucle vivo, canales anidados, tres relojes, contexto por etapas, motor por sprint.

**Regla dura: lo que no esta en el repositorio no existe.** Los acuerdos que se tomen por el buzon de
agentes se copian aqui el mismo dia, en un commit o en un documento. Lo que solo vive en un chat, se
perdio.

**Lo que NO se toca**: la interfaz de ZCode (se reutiliza; si hace falta una pantalla nueva, se construye
con sus componentes y sus tokens) y el motor de edicion de ZCode (funciona y esta intacto).


## Que es este repo y que no

- **Auton Desktop es el producto** que se presenta en la hackathon de Meta (Global AI Developer
  Hackathon 2026): la app de escritorio donde se ve y se toca la disciplina de Auton.
- **`C:\Nueva-carpeta\auton cat jam zcode` NO es el producto.** Es el prototipo de referencia
  (orquestador + programmers sobre HTTP y Vite). Sirve como **inspiracion y fuente de ideas ya
  probadas** -el prompt del orquestador, el ciclo de revision de sprints, el protocolo de reporte
  DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED-, pero **su codigo no se copia aqui**: lo que sirva
  se reimplementa en este repo, con sus pruebas y su estilo.
- `origin` apunta a `zai-org/ZCode` (Apache 2.0) para traer actualizaciones del upstream; `auton`
  apunta a este repositorio. La licencia y los avisos de ZCode se mantienen intactos.

## Reglas duras

- **Nunca** credenciales en el repo: ni `.env`, ni keys, ni tokens en codigo, tests, docs o mensajes
  de commit. Las keys viven en configuracion privada, fuera del arbol versionado.
- No usar `--no-verify` para saltar checks, salvo cuando el hook no pueda correr (por ejemplo, push
  a un remoto recien creado y vacio). Si se usa, hay que correrlo despues a mano y decirlo.
- Un commit por cambio con sentido, con mensaje que explique que cambio y por que.
- Prioridades de la hackathon: impacto 30%, **uso de herramientas de IA de Meta 25%**, profundidad
  tecnica 20%, calidad de demo 25%. Por eso el stack de Meta (Muse Code, Meta Model API, pesos
  abiertos Muse Glimmer) tiene que estar integrado de verdad, y la demo -tablero, evidencia,
  relojes- vale tanto como la arquitectura.

## Varias manos a la vez (no pisarse)

Este repositorio lo tocan varias personas y varios agentes en paralelo. Las reglas que evitan el
merge sangriento:

1. **Una rama por persona y tema**: `feat/<nombre>/<tema>` (`feat/ana/sprint-board`). Nadie trabaja
   directo en `auton-desktop`; esa rama solo recibe merges ya verificados.
2. **Un dueño por archivo.** Antes de tocar un archivo que no es tuyo, avisa y espera el OK. Los
   archivos calientes hoy: `ProjectSidebarNavigation.tsx`, `WorkspaceShellLayout.tsx`,
   `core/src/context/sections/auton.ts` y los handlers `write.ts`, `edit.ts`, `agent.ts`.
3. **`git add` selectivo, nunca `git add -A` a ciegas**: puede haber trabajo a medias de otra
   sesión. Agrega solo lo que tú cambiaste y revisa el diff antes.
4. **Rebase antes de empujar** (`git pull --rebase auton auton-desktop`). Nunca `--force` sobre una
   rama compartida.
5. **Cambios pequeños y seguidos**: una pieza por commit. Un cambio de 600 líneas bloquea a los
   demás.
6. **El que rompe, arregla**: si tu cambio deja el árbol en rojo, lo arreglas antes de pedir merge.
7. **Docs nuevos en archivos nuevos** (`docs/...`): se integran sin conflicto. Editar un doc
   existente se avisa.

## Verificación y honestidad

- **Root cause, no síntoma.** Antes de editar, explica el mecanismo: "X causa Y, produce Z". Arregla
  la capa dueña (estado, flujo de eventos, ciclo de vida, fuente del prompt), no la salida de abajo.
- **Paridad antes de copiar un patrón de ZCode.** Mira cómo lo resuelve el upstream, en qué capa
  vive, y si la diferencia es arquitectónica o un bug local. No envíes un workaround cuando el
  hueco es de arquitectura.
- **La fuente de verdad va en disco, no en memoria**: el plan en `.auton/plan.json`, el diario en
  `.auton/changes.jsonl`, el rastro de reversiones en `.auton/reverts.jsonl`. Prohibido construir
  decisiones de producto sobre estado efímero del cliente.
- **Si tomas un atajo, dilo**: qué se dejó por el camino corto, por qué, qué riesgo tiene y cuál es
  el camino profesional pendiente. Nunca presentes un workaround como solución definitiva.
- Antes de afirmar "hecho": `pnpm typecheck` y `pnpm lint` reales, la prueba del camino afectado
  ejecutada, y la salida guardada. No escribas "pasa" si no lo viste pasar.

## Registro del trabajo (para saber quién hizo qué)

- Cada agente mantiene **su propio** archivo en `docs/agent-logs/terminalN.md` (numeración
  secuencial; el siguiente libre es `max + 1`).
- La autoría se prueba por memoria de esta conversación, no por el nombre en la cabecera. Si al
  abrir un `terminalN.md` ves sesiones que no recuerdas haber escrito, **no es tuyo**: crea el
  siguiente número libre.
- Cada entrada: 3–6 líneas con qué cambiaste y por qué. Sin código pegado ni secretos.
- Al responder al humano, cierra con una línea de firma: `— <agente> · terminalN · <tema>`.

## Versionado

- La versión de Auton vive en **`VERSION`** y se cuenta en **`CHANGELOG.md`**; el tag es `vX.Y.Z`.
  (El `package.json` de la raíz es el de ZCode, `3.16.2`: no es nuestra versión.)
- Feature nueva → sube MINOR; corrección → PATCH; cambio de contrato de datos → MAJOR.
- Antes de anunciar una versión, verifica el número **en el archivo**, no en el mensaje del commit.
- Con varias sesiones, lee `VERSION` antes de tocarlo: otra persona pudo haberlo subido.

## Documentación pública y privada

Hay dos documentaciones y no se mezclan. La pública da confianza y explica el producto; la privada
permite trabajar en él sin preguntar.

| | Público | Privado |
| --- | --- | --- |
| Dónde | `docs/public/*.md`, `README.md`, visión, arquitectura y contrato de notificaciones | `docs/private/*.md` y los documentos internos listados en `site/README.md` |
| Build | `site/dist/` | `site/private-dist/` |
| Contenido | qué es, cómo trabaja, cómo se gobierna la autonomía, dónde viven los datos, FAQ | rutas, símbolos, esquemas, códigos de fallo, invariantes, pruebas, deuda, riesgos, reparto y decisiones |
| Prohibido | rutas de implementación, nombres de archivos internos, códigos de error, deuda técnica, estrategia competitiva | — |

Reglas:

- Una página de producto va en `docs/public/` y se registra en `PUBLIC_PAGES` (`site/build.mjs`).
- Un detalle de implementación va en `docs/private/` y se registra en `PRIVATE_PAGES`.
- `node site/build.mjs` genera los dos árboles en una corrida. El build público **nunca** lee
  `docs/private/` ni los documentos internos.
- `site/private-dist/` no se sincroniza al bucket público. Su publicación exige un destino
  autenticado; el repositorio no lleva credenciales.
- La documentación privada lleva el detalle que un compañero necesita para continuar sin preguntar:
  rutas, contratos, invariantes, pruebas ejecutadas y lo que falta. "Con lujo de detalle" es el
  estándar, no la excepción.
- La documentación pública se escribe para alguien que no conoce el repo: sin jerga interna y sin
  prometer lo que no está verificado.
- Se actualiza cuando cambia el comportamiento, no en cada commit de estilo.
- `AUTON-VISION.md` manda en producto; si una página pública lo contradice, se corrige la página.
- Lo que solo vive en el chat no existe: un acuerdo o un detalle relevante se escribe en uno de los
  dos árboles el mismo día.

- `README.md` es la cara pública; `docs/` es el trabajo interno.
- El sitio se publica en S3; nunca lleva credenciales.

## Deber de verificación de esta guía

Todo lo que dice este bloque se verificó al escribirlo, pero el código cambia: cualquier agente que
actúe basándose en una afirmación de aquí debe re-verificarla (grep del símbolo, `git log` del
archivo) antes de confiar. Si encuentras una regla que ya no es cierta, corrígela en el mismo commit
que tu cambio.

## 核心原则

- 新增或修改行为前，先更新对应 spec；目录不存在时按需创建。先明确产品规则、状态所有者、接口和验收场景，再实现代码。
- 以当前检出的源码、`package.json` 和架构策略为准。说明中只保留当前仓库提供的功能、命令和文件；删除功能时同步清理指令和技能中的引用。
- 定位问题时，未明确要求修改代码就先调查原因。结合源码、日志和运行时证据，区分已确认原因与待验证假设。
- 保留与任务无关的本地改动，不自行恢复已移除的模块或内部依赖。

## 命令与仓库结构

开工前运行 `node scripts/check-workspace-freshness.mjs` 检查基线。Node 版本以 `mise.toml` 为准。

以下命令从仓库根目录执行：

| 用途             | 命令                                                 |
| ---------------- | ---------------------------------------------------- |
| 类型检查         | `pnpm typecheck`                                     |
| Lint             | `pnpm lint` / `pnpm lint:fix`                        |
| 格式检查         | `pnpm fmt:check`                                     |
| 桌面开发         | `pnpm dev:desktop`                                   |
| Web 开发         | `pnpm dev:web`                                       |
| 提交前检查       | `pnpm verify:pre-push`（Lint、架构检查与受影响单测） |
| 架构检查         | `pnpm architecture:check --changed`                  |
| 模块阅读包       | `pnpm architecture:context <module-id>`              |
| 未使用依赖与导出 | `pnpm knip`                                          |
| 导出引用查询     | `pnpm dep:refs --list-exports <file>`                |

affected 使用 Vitest 官方选择，只运行选中的根 UT；选中整个套件时说明并跳过 UT，成功退出，不因此阻止 Push；不替代 CLI 测试或桌面 E2E。全量使用 `pnpm test` / `pnpm test:unit`，仅在用户明确要求时调用。范围与输出合同见 [pre-push 说明](docs/testing/pre-push-hook.md)。

测试入口以目标包当前的 `package.json` 和实际测试文件为准，不假定存在统一的单测或 E2E 命令。

- `packages/desktop`：Electron main、host、renderer。
- `packages/web`、`packages/server`：Web 客户端与服务端。
- `packages/ui`：共享 React 组件、hooks 与 Zustand store。
- `packages/services`：业务服务；`packages/rpc`：RPC 框架。
- `packages/shared`：共享协议与类型；`packages/client`：Agent 客户端 SDK。
- `apps/zcode-cli`：Agent CLI 与运行时。
- `CONTEXT.md`：插件商店领域词汇；修改相关 UI 前阅读。
- `DESIGN.md`：UI 设计规范；修改 UI 前阅读。

## 实现与验证

- 代码改动使用 `.agents/skills/architecture-governance/SKILL.md`，先运行架构检查，再读取目标模块的受控上下文。
- 避免重复状态和多条写入路径。明确唯一所有者、接口、依赖方向、事件顺序与幂等边界，不能用超时掩盖同步问题。
- 有行为改动时先补充对应测试；交互改动需要 E2E 场景。检查测试与实现是否一致，并实际执行可用的验证。未执行或环境受限时如实说明。
- 修复 bug 时用中文注释说明原因和修复依据。发现设计缺陷时先与用户对齐，不不断增加兜底分支。
- PR 描述须说明背景、设计意图与修改前后行为；包含 bugfix 时逐项说明触发场景、根因证据、修复机制及回归验证，并尽量关联已有工单链接。未确认的根因或引入提交如实标注，不根据模块或时间接近推断归因。
- 涉及状态、时序、远端或异步同步的方案，用图展示所有者及事件顺序。
- 必须执行 `pnpm typecheck` 和 `pnpm lint`，报告真实结果，不将已有失败写成通过。
- 使用异步文件和网络 IO；跨包导入使用公开入口，遵守现有路径别名。
- 禁止 UI 直接调用 Repo、Service 引用 Runtime 具体实现、跨域导入实现细节及循环依赖。

## UI 与平台边界

- 遵守 `DESIGN.md`，复用已有组件，兼顾桌面与手机 Web 的布局、交互、主题和国际化。
- 组件通过 `packages/ui/src/hooks/` 访问服务；平台操作通过 `IPlatformService`（`packages/shared/src/platform.ts`），不直接调用 `window.zcode`。
- 通过依赖注入处理 Desktop、Web、本地和远程环境的差异，并兼顾 Windows、macOS 和 Linux。
- Zustand 状态位于 `packages/ui/src/store/`。广播同步的主题、语言等字段需要防止回环；UI 局部状态不应被误当作服务端事实。
- hooks 中含 JSX 的文件使用 `.tsx`。

## 进程、协议与远程控制

- Desktop app 通过 stdio 与 Agent 通信。协议改动同步更新 `packages/shared/src/zcode-protocol/index.ts`，提供严格类型与运行时校验。
- Main 负责窗口、原生操作、进程调度和消息转发，不承载 task/session 业务状态。
- 每个窗口使用一个 window-scoped Local Host；本地 workspace 共享该 Host。远程 workspace 由窗口内的连接注册表管理，不另建 Desktop Remote Host。
- 手机远控连接桌面已有 Host attachment，复用会话运行时；不为手机另起 Agent、Local Host 或远程会话。
- Desktop 的 `desktop-continuous` 实时链路与手机的 `web-remote-replayable` 恢复链路必须明确区分。修改 stream、snapshot、queue 或重连时，同时验证两种语义。
- 外部 relay 与 Main 只做鉴权、配对、心跳、转发及 attachment 调度，不保存任务队列、快照等业务状态。
- 已接受的 busy/running 输入由 CLI/runtime `CommandInbox` 串行 admission；Renderer 只保留未提交草稿与 pending optimistic overlay，Host owner/lease 负责路由。
- 保留 owner/lease、跨 Host 路由和 stale run 防护，不能仅根据单一路径删除边界判断。

## Workspace Identity

- `workspaceIdentity` 用于身份隔离，`workspacePath` 用于文件操作、命令 cwd、Git 和路径展示。
- 身份 key 统一为 `workspaceIdentity?.trim() || workspacePath`，适用于去重、绑定、缓存、队列、持久化和请求关联。
- 远程链路贯穿传递 `workspaceIdentity` 与 `remoteSessionId`，不得仅按路径匹配。
- 新接口保留本地路径 fallback；远程 identity 复用现有构造和解析工具，不在业务代码中手写格式。

## 日志

- UI 使用 `packages/ui/src/logger.ts`，不直接使用 `console.log` 或 `window.zcode?.log`。
- Agent/session/runtime 相关服务日志使用 `createServiceLogger(scope)`（`packages/services/src/logger/serviceLogger.ts`）。
- `debug` 用于协议原始数据、流式 chunk 和逐条工具更新等高频诊断，生产环境不落盘。
- `info` 用于进程和会话生命周期、权限结果、一次性初始化等生产可用事件。
- `warn` 用于可恢复异常；`error` 用于崩溃、握手失败、鉴权丢失等不可恢复错误。
- 不在日志、示例或提交中写入凭据、真实用户数据和内部服务地址。
