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
muestran en su grupo cuando el runtime los marca en `workerTaskIds`.

- Worker completo de ZCode probado en vivo: el orquestador lanzó `Agent` con `subagent_type
  auton-worker`; la sesión real (`sess_auton_*`) apareció en `Agentes ZCode 1` como `worker 4`,
  Trabajando 00:23, con el hilo del orquestador abierto y fuera de la lista. El resumen y
  "Ver chat completo" usaron su conversación real sin compositor; parar la dejó Terminado.
  Capturas: `launch-full-worker.png`, `launch-full-worker-summary.png`,
  `launch-full-worker-chat.png`, `full-worker-stopped2.png`.

- Segunda corrida completa: `Agentes ZCode 2` (un `auton-worker` terminado y otro trabajando) con el
  hilo del orquestador abierto y fuera de la lista; captura `launch-full-worker-2.png`. La parada
  del worker completo usa su propia sesión (worker 4 pasó a Terminado 01:25).

## 2026-11-03 — paridad visual y decisión aprobada por el usuario

Se restauró la estructura del panel anterior: encabezado `WORKERS` en mayúsculas, badge de estado con
punto, nombre + reloj, última línea, densidad y tipografía de la referencia. El usuario pidió
explícitamente quitar el verde y la llave: "ese color verde y ese icono en los agentes NO VA CON DL
DISEÑO, trata de reciclar lo más q puedas copia.pega y modifica". Por eso el badge es neutro y el
icono es de estado; el logo/nombre del proyecto y los grupos Agentes ZCode/Subagentes/Muse Code son
la UI nueva. Comparación lado a lado: `style-compare.png`.
