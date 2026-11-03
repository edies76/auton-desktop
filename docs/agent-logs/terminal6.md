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
