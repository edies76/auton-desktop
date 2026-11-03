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
