# terminal6 — Grok (grok-build)

Tema en curso: panel de workers del proyecto, un solo chat y conexión con la sesión viva.

## 2026-11-03 — workers por defecto y orquestador separado

Qué: la vista `Workers` es la entrada del panel del proyecto; el orquestador (la sesión activa
del humano) se excluye por `taskId` y el detalle del worker se abre en el mismo panel, sin
compositor. Los canales se agrupan en Agentes ZCode, Subagentes y Muse Code (reservado). Los
subagentes salen de las filas reales de la sesión viva (`projectAutonWorkers`) y los agentes de
las sesiones completas del proyecto (`projectProjectAgentWorkers`).
Por qué: el sidebar listaba un chat por tarea y podía pintar el chat activo como worker; el panel
anterior de workers se reutiliza con sus componentes y tokens, sin una superficie nueva.
Verificado con: `autonWorkersSidebar.test.tsx` (3), `autonAgentProjection.test.ts` (4),
`autonSpaceProjection.test.ts` (6), `autonSpaceLive.test.tsx` (2), `autonThreadChannels.test.tsx`
(5), `projectSidebarViewPreference.test.ts` (2) y `projectSidebarNavigation.test.ts` (4); tsc y
lint de `@zcode/ui` sin errores. La app del fork se arranca y se inspecciona con el panel por
defecto.

## 2026-11-03 — filas nativas y un solo chat por proyecto

Qué: las filas de worker usan la estructura del panel de subagentes (icono de estado neutro,
nombre, estado y tiempo) en vez de la llave y el badge verde; el proyecto se muestra con su logo y
su nombre en la cabecera del panel, y la lista de proyectos deja un solo chat (el orquestador) por
proyecto. El panel arranca en Workers.
Por qué: el verde y la llave no pertenecían al lenguaje visual de ZCode y la lista de proyectos
mostraba varios chats.
Verificado con: `autonWorkersSidebar.test.tsx` (3), `projectSidebarNavigation.test.ts` (5),
`autonSpaceLive.test.tsx` (2); tsc y lint de `@zcode/ui` sin errores; app del fork con el panel
neutral.

## 2026-11-03 — una conversación por proyecto y resumen del worker

Qué: cada proyecto tiene una sola conversación de orquestador persistida; al abrir la app se abre
directo ese chat (sin bienvenida con input en el centro), los chats anteriores quedan como legado y
no se listan como workers. Al hacer clic en un worker, el área del orquestador muestra su resumen
(estado, recap y últimas señales), desde donde se abre su chat completo de solo lectura y se puede
parar. Los subagentes también tienen parada.
Por qué: los chats viejos se mostraban como workers y el chat activo no tenía una identidad de
orquestador; el detalle del worker no era la conversación real.
Verificado con: `projectConversation.test.ts` (4), `projectSidebarHomeOnlyWorkspaces.test.ts` (11),
`autonWorkersSidebar.test.tsx` (4), `autonWorkerFocusPane.test.tsx` (2), `autonWorkerPanel.test.tsx`
(8); tsc y lint de `@zcode/ui`.

- Proyecto sin conversación: al crearlo se envía un prompt inicial para que el orquestador se presente y pregunte qué hacer; el chat principal queda abierto en el mismo hilo.

## 2026-11-03 — worker real en vivo, resumen y parada

Qué: con el chat del orquestador abierto, un prompt real lanzó los subagentes Explore 1 y Explore 2;
el panel mostró Workers 2 con estado, reloj, última señal y parada, sin listar el chat del
orquestador. Al clicar un worker, el área del orquestador muestra su resumen; "Ver chat completo"
abre la conversación real de solo lectura sin compositor; parar interrumpe el turno del orquestador
y el worker pasa a Bloqueado con el motivo real.
Por qué: el panel anterior no distinguía el chat activo y el detalle no era la sesión real.
Verificado con: `autonWorkerPanel.test.tsx` (8), `autonWorkerFocusPane.test.tsx` (2),
`autonWorkersSidebar.test.tsx` (4), `projectSidebarHomeOnlyWorkspaces.test.ts` (11);
capturas `launch-1.png`, `launch-2.png`, `worker-summary.png`, `worker-chat.png`, `worker-stopped.png`.
Nota: el orquestador vivo crea subagentes como canales worker; los agentes completos de ZCode se
muestran en su grupo cuando la fila viva es `auton-worker`.

- Worker completo de ZCode probado en vivo: el orquestador lanzó `Agent` con `subagent_type
  auton-worker`; la sesión real (`sess_auton_*`) apareció en `Agentes ZCode 1` como `worker 4`,
  Trabajando 00:23, con el hilo del orquestador abierto y fuera de la lista. El resumen y
  "Ver chat completo" usaron su conversación real sin compositor; parar interrumpió el turno del
  orquestador y la dejó Bloqueada.
  Capturas: `launch-full-worker.png`, `launch-full-worker-summary.png`,
  `launch-full-worker-chat.png`, `full-worker-stopped2.png`.

- Segunda corrida completa: `Agentes ZCode 2` (un `auton-worker` terminado y otro trabajando) con el
  hilo del orquestador abierto y fuera de la lista; captura `launch-full-worker-2.png`. La parada
  de cualquier worker interrumpe el turno del orquestador, que es quien lo controla.

## 2026-11-03 — paridad visual y decisión aprobada por el usuario

Se restauró la estructura del panel anterior: encabezado `WORKERS` en mayúsculas, badge de estado con
punto, nombre + reloj, última línea, densidad y tipografía de la referencia. El usuario pidió
explícitamente quitar el verde y la llave: "ese color verde y ese icono en los agentes NO VA CON DL
DISEÑO, trata de reciclar lo más q puedas copia.pega y modifica". Por eso el badge es neutro y el
icono es de estado; el logo/nombre del proyecto y los grupos Agentes ZCode/Subagentes/Muse Code son
la UI nueva. Comparación lado a lado: `style-compare.png`.

Comparación lado a lado: `style-compare.png`. Se restauró la estructura y densidad de la referencia
(encabezado, badge con punto, nombre+reloj, última línea, parada) con badge neutro e icono de estado
por decisión explícita del usuario; el panel actual muestra `Agentes ZCode 3` con un worker completo
Trabajando y el hilo del orquestador abierto/fuera de la lista (`final-running-style.png`).

## 2026-11-03 — correcciones de verificación

- Orquestador: `ensureProjectConversation` usa la sesión activa y, si no hay, la conversación persistida o la más antigua; ya no ordena por `updatedAt`. La auto-apertura solo cambia de sesión si la activa es legado o no hay activa (`shouldOpenProjectOrchestrator`).
- Workers: se retiró la rama muerta de tareas de proyecto (`workerTaskIds`, `markWorkerTask`, `projectProjectAgentWorkers`). Los agentes completos y subagentes salen de la proyección viva `auton-worker`/subagente; los tests usan esa ruta.
- Foco del worker: el store guarda id/scope y el sidebar publica `setLiveWorkers`; el resumen deriva el worker vivo y `useAutonClock`. Parar un worker interrumpe el turno del orquestador; la prueba en vivo pasó de Trabajando a Bloqueado en el resumen (`focus-blocked-summary2.png`).
- Creación por proyecto: `claimProjectConversationCreation` reclama una vez por clave, no un booleano global; test de p1/p2/p1.
- Foco al cambiar de workspace: `closeWorkerFocusForWorkspace` se ejecuta en `WorkspaceShellLayout`; test de cierre en workspace distinto.

Verificación final: `projectConversation` 6/6, `projectSidebarHomeOnlyWorkspaces` 11/11,
`autonWorkersSidebar` 4/4, `autonWorkerFocusPane` 3/3, `workerFocusStore` 2/2,
`autonWorkerPanel` 8/8, `autonAgentProjection` 3/3, `autonSpaceProjection` 7/7; tsc y lint limpios.
El foco vivo pasó de Trabajando a Bloqueado tras parar (resumen derivado de `liveWorkers`), y la app
quedó en el chat único del proyecto con `Agentes ZCode` de sesiones `auton-worker` reales.

## 2026-11-03 - clasificación tras reinicio y etiqueta de rol

Qué: la hidratación en frío del transcript ahora lee `subagent_type` del tool `Agent` para recuperar
`agentType`; antes de eso, al reiniciar la app los `auton-worker` volvían al estado `subagent` y el
grupo `Agentes ZCode` quedaba vacío. El hilo central muestra la etiqueta `Orquestador` junto al
título, para distinguirlo de un worker.

Por qué: el worker completo de ZCode debe seguir siendo agente después de cerrar y abrir la app, y
la spec exige distinguir de un vistazo el orquestador del worker.

Verificado con: `transcript-hydration.test.ts` 80/80, `workspaceHeaderTitleSection.test.ts` 9/9 y la
suite Auton de UI 56/56. Dos arranques limpios de `pnpm dev:desktop` (`launch-1.*`, `launch-2.*`)
mostraron el mismo proyecto, un solo chat, `WORKERS` por defecto, `Agentes ZCode` 6,
`Subagentes` 3, `Muse Code` 0 y cero excepciones de renderer. La interacción por CDP
(`launch-1-state.json`, `launch-2-state.json`) abrió un worker, comprobó el resumen sin compositor,
el chat completo sin `textarea` y la vuelta al orquestador con compositor.

## 2026-11-03 - vistas de tareas, promoción y rol

Qué: `hiddenProjectTaskIds` excluye de las vistas de tareas los chats legados de cada proyecto, las
sesiones `sess_auton_*`/`sess_subagent_*` y las tareas sin proyecto; `resolveProjectTaskSelection`
impide que un legado o un worker se convierta en orquestador y `ensureProjectConversation` ya no
admite sesiones hijas como candidatas. La etiqueta `Orquestador` solo aparece cuando el chat activo es
el orquestador publicado por el sidebar. Si una sesión de worker queda como tarea activa, el shell
monta `AutonWorkerSessionPane` con el resumen de solo lectura y vuelve al orquestador publicado.

Por qué: las vistas timeline/agrupado seguían siendo un segundo listado de chats y podían promover un
legado; la etiqueta se pintaba sobre cualquier tarea.

Verificado con: `projectConversation.test.ts` (12), `projectConversationStore.test.ts` (1),
`projectSidebarTaskVisibility.test.tsx` (2, montando el `ProjectSidebar` real y capturando las tareas
de Timeline y agrupado), `workspaceHeaderTitleSection.test.ts` (10),
`autonWorkerSessionPane.test.tsx` (3) y la suite de UI 69/69. En vivo: la vista `Recently updated`
mostró solo `Pregunta sobre identidad y funcionamiento` (`timeline-filtered.png`); elegir el chat
legado `bro...` desde el buscador volvió al orquestador con su etiqueta; `worker 9` Bloqueado se
muestra sin `Parar` (`focus-live-blocked.png`). Typecheck raíz 0 con 8 GB de heap y lint 0 errores.
- Arranque limpio final con todo ensamblado (`launch-final.png`, `launch-final.log`): `Orquestador` junto al título, `WORKERS 9`, sin foco abierto y compositor del orquestador. La vista `Recently updated` mostró solo `Pregunta sobre identidad y funcionamiento`; cero excepciones de renderer. Lint raíz 0 errores/105 avisos y typecheck raíz 0.
