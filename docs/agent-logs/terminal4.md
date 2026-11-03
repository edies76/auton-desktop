# terminal4 — grok-build (Grok)

Tema: límites que gobiernan el despacho y superficie del espacio del proyecto.
Inicio: 2026-11-03.

## 2026-11-03 — límites: intentos, no evaluable y reportes

Qué: AutonPlan cuenta los intentos, rechaza el despacho sin límites o sin intentos, admite el estado
`not_evaluable` con pregunta obligatoria y registra los reportes de calibración de los workers.
Las cuatro piezas: handler en `core/src/auton/plan-handler.ts`; registro en `builtInTools` con schema de
`attempts`/`needsApproval`/`limitReports` y status `not_evaluable`; línea en
`core/src/auton/contextAuton.ts` (cuándo usarlos) ensamblada por `context/builder.ts`; pruebas 8 y 9 de
`context/PRUEBAS-QUE-PROMETEMOS.md`.
Verificado con: `auton-four-pieces.test.ts` (5), `auton-limits-governance.test.ts` (15),
`auton-plan-tool.test.ts` (10) y `auton-limits-guard.test.ts` (3); 33 en verde.
Prueba de la regla: el test four-pieces comprueba registro, prompt ensamblado y catálogo. La elección
del modelo (prueba 17) necesita una sesión real y no se ejecutó aquí.

## 2026-11-03 — UI del espacio del proyecto (otro checkout)

Qué: pantalla de proyectos, espacio con un compositor, workers en vivo con parada y bloques
Trabajo/Plan/Evidencia en `C:\nueva-carpeta\auton-desktop`. No añade herramienta al orquestador: es
superficie humana; la parada y el envío usan el `answer` existente.

## 2026-11-03 — worker como sesión, detrás de un interruptor

Qué: modo de worker resuelto en puro (`worker-mode`) con dos valores, `subagent` por defecto y
`session`; colocación propia (carpeta aislada, sin lista de herramientas, navegador del worker) y
puerto de ciclo de vida (`session-worker`) con crear, mandar, detener y leer. El despacho elige el
puerto según el interruptor y, sin él, cae al subagente. El canal del coordinador deja de depender de
la marca de subagente y el candado se mantiene. La proyección del espacio del proyecto traduce un
worker de sesión a la misma fila que ya consume el panel.
Cuatro piezas: handler (puerto y fábrica de runtime), registro (`worker_mode` en la herramienta
Agent), prompt (línea de cuándo usar sesión), prueba (nº 17 de `PRUEBAS-QUE-PROMETEMOS.md`).
Verificado con: `auton-worker-mode` (7), `auton-worker-dispatch` (6), `auton-worker-session-port`
(6), paridad de canal (43 en 7 archivos), typecheck de contratos, núcleo y UI, y lint.


## 2026-11-03 — lanzamiento real

Qué: dos intentos de `pnpm dev:desktop` con `AUTON_WORKER_MODE=session` (90 s y 240 s). El pipeline
compila shared-types, contracts, core, adapters, bootstrap y los plugins, y no llega a abrir ventana
en este entorno (`worker-launch-retry.log`).
Alternativa sin escritorio: `auton-worker-session-runtime` arranca el runtime real del núcleo, el
orquestador despacha por la herramienta Agent en modo sesión, el worker recibe el encargo, su juego de
herramientas es el del orquestador sin los controles de orquestación (`Agent`, `Task`, `SendMessage`) ni
el modo plan, y su salida vuelve al orquestador. Evidencia en `worker-launch.log`.
La fila del panel lleva además el identificador con el que se detiene, y el contrato coincide con el
panel real (`autonWorkerPanel`, 8 pruebas).


## 2026-11-03 — el cableado del ejecutor

Qué: `ToolExecutorImpl` y el constructor del contexto copian `autonSessionWorkerPort` y
`autonWorkerMode`; sin esas dos líneas el despacho caía en silencio al subagente y el canal no
encontraba al worker de sesión. `TaskStop` y `SendMessage` resuelven el puerto que conoce la tarea.
La prueba de runtime ahora exige el tipo de sesión, la carpeta aislada y la marca de aislamiento, y se
comprobó que **falla** si se revierte el cableado (`wiring-regression.log`).
Verificado con: 72 pruebas del núcleo en verde, typecheck de contratos y núcleo en cero, lint limpio.


## 2026-11-03 — candado en el worker de sesión y carpeta real

Qué: `RespondToCoordinator` dependía de `runtimeScope === "subagent"` y rechazaba al worker de sesión;
ahora depende del puerto, igual que el registro. La carpeta del worker se resuelve absoluta y se crea
antes de arrancar. El candado lo levanta el `enqueue` del padre, que ya era común.
Prueba nueva: un runtime con `taskType: "auton_worker_session"` llama a la herramienta por el ejecutor,
el orquestador recibe `<subagent-message>` y el `waitingForAnswer` pasa a falso. Otra prueba ejecuta
Bash dentro de la carpeta y comprueba el `cwd` y que el directorio existe.
Verificado con: 73 pruebas del núcleo en verde y la corrida del escritorio con timeout de 120 s,
PID, exit code n/a y stderr en `worker-launch-retry.log`. Esa corrida sí llegó a Electron: el log
muestra el host y la ventana registrados; el proceso seguía vivo y el arnés lo detuvo.
Se comprobó en negativo: con el guard viejo (runtimeScope === "subagent") la prueba de canal falla y el mensaje no llega al orquestador; restaurado el arreglo, pasa. Evidencia en channel-regression.log.

Cuarta ronda: el stop ya no lo pisa el cierre del turno (guarda isTerminalRuntimeTask), el puerto solo reclama las tareas que creó (SendMessage/TaskStop no tocan subagentes), el candado se prueba por el puerto real con requiresAnswer y la respuesta del ejecutor, y el panel para con agentId. Evidencia: channel-parity.log, channel-regression.log, worker-launch-retry.log con bloque de terminación.


## 2026-11-03 — verificación de los hallazgos del panel (HEAD f19e40dc)

Cada hallazgo quedó cerrado en el código actual, no en una nota:
1. stop pisado: session-worker.ts guarda con isTerminalRuntimeTask antes de actualizar y de notificar; prueba en auton-worker-session-port.test.ts que resuelve el turno tras el stop y exige estado stopped y cero avisos.
2. SendMessage/TaskStop: el puerto de sesión mantiene un set de tareas propias; getTask/stopTask devuelven undefined para lo ajeno. Pruebas: auton-worker-session-port.test.ts (tarea ajena intacta) y auton-worker-dispatch.test.ts (puerto real + subagente registrado).
3. Candado de punta a punta: auton-worker-session-runtime.test.ts lanza el worker real, llama sendMessage con requiresAnswer por el puerto real y el worker responde por su ejecutor.
4. Panel: WorkerPanel.tsx usa worker.agentId ?? worker.id; autonWorkerPanel.test.tsx lo prueba sobre el panel real.
5. Escritorio: worker-launch-retry.log termina con bloque de comando, timeout 120 s, PID, veredicto, exit code n/a, evidencia de ventana y stderr incrustado.
Evidencia de esta corrida: channel-parity.log (21 pruebas), typecheck.log (contratos), typecheck-core.log y ui-projection.log (13).

## 2026-11-03 — eje de modo de trabajo (build/read/research/debug/refactor)

Qué: el modo es un eje aparte del esfuerzo. El prompt del worker se compone con su criterio de hecho
y sus prohibiciones, y el runtime le retira las herramientas que puedan escribir cuando el modo es
read o research.
Cuatro piezas: (1) contrato `mode` en la herramienta Agent, el request del despacho y el item del
plan, con prompt compuesto desde el modo; (2) registro `mode` con sus cinco valores en la
herramienta; (3) línea en la doctrina del orquestador con el cuándo de cada modo; (4) pruebas 19 a 22
de `context/PRUEBAS-QUE-PROMETEMOS.md`.
Verificado con: `auton-worker-task-mode` (10), `auton-worker-mode-safety` (4) y
`auton-worker-dispatch` (10); capturado en mode-prompt.log, mode-safety.log y mode-dispatch.log.
Lanzamiento: `pnpm dev:desktop` con el modo sesión se quedó en el build a los 150 s; capturado en mode-launch.log con timeout, PID, veredicto y stderr. Typecheck UI: se ajustó el tipo local de la fila del canal al protocolo actual (lastActivityAt y waitingForAnswer son opcionales).

2026-11-03 — worker por defecto en sesión completa: DEFAULT_AUTON_WORKER_MODE pasa a session. `subagent` queda como vuelta atrás por despacho (`worker_mode`) o por `AUTON_WORKER_MODE=subagent`. Actualizados la tool, la doctrina, la doc privada/pública y las pruebas: sin parámetro, el despacho usa el puerto de sesión.

## 2026-11-03 — Muse Code como motor del worker

Qué: el orquestador puede elegir engine: "muse" y el worker corre con Muse Code 1.4.14 headless en su
carpeta, con la misma capa de Auton, modo, evidencia y REPORTE. Sin fallback silencioso: motor
desconocido lo rechaza el esquema; binario o auth ausentes fallan con el motivo de la sonda.
Cuatro piezas: (1) handler/adaptador (muse exec --json, prompt file, workspace, flags de modo, stop,
parser del REPORTE); (2) registro engine en la herramienta Agent y en el item del plan; (3) bloque
"Motor del worker" en la doctrina; (4) prueba 23 de PRUEBAS y pruebas de contrato/adaptador/despacho.
Límite declarado: exec es one-shot; session-message no está soportado en Windows, así que no hay
steer a mitad de corrida en Muse.
Verificado con: Muse real (echo x2, carpeta con espacio y &, puerto real de sesión y meta x1) a través
del adaptador; auton-muse-engine (12 sin e2e, 16 con e2e), auton-engine-dispatch (6), typecheck y lint.



Ajuste de cierre: el arranque de Muse en Windows pasa por cmd.exe con cada argumento citado (espacios y & en la ruta del workspace); el nombre pelado `muse` va sin citar porque su .cmd resuelve el launcher con %~dp0. Probado contra el Muse real en una carpeta con espacio y &.
La fábrica real del prompt (buildMuseWorkerPrompt) se prueba ahora con el hijo de contrato y afirma identidad, rol, modo, esfuerzo, canal, REPORTE, encargo e instrucciones del proyecto antes de que el motor lo reciba.

El puerto real de sesión se ejercita con Muse echo: `launch(engine: "muse")` en el runtime real, la tarea termina `completed` y su salida contiene la capa de Auton (`MODO DE TRABAJO: read`), `## ENCARGO` y el brief. Eso cierra el eslabón entre la fábrica real y el motor.

## 2026-11-03 - conversación en la misma sesión, reanudación, índice y transcripción

Qué: Muse deja de ser una pasada. El transporte por defecto es `muse serve` (MSP, JSON-RPC 2.0 con una línea por frame): `initialize → initialized → session/start → turn/start`, y una segunda entrada entra por `turn/steer` con `expectedTurnId` sobre la misma sesión. `exec` queda como alternativa con `AUTON_MUSE_TRANSPORT=exec`. Un worker ZCode terminado se reanuda en la misma sesión y carpeta; dos reanudaciones conservan el id. Cada worker deja su entrada en `.auton/workers/index.json` (motor, id de sesión del motor, carpeta, estado, tiempos, modo y esfuerzo) y su conversación en `.auton/worker-transcript.json`, y el detalle del worker pinta las filas reales.

Handshake real: `session/start` exige la notificación `initialized`, devuelve `result.session.sessionId` y acepta `approvalMode: "allowAll"`; `"never"` no es válido. Los `commandId` son UUIDv7. `session-message` sigue sin soporte en Windows.

Verificado con: Muse real y `AUTON_MUSE_E2E=1` — dos entradas con `echo` y respuestas en orden (16,1 s), puerto real de sesión con índice (8,5 s) y steer en caliente con `meta` (30,8 s), en `muse-msp.log`. Reanudación ZCode dos veces con el mismo `sessionId` y carpeta (2 pruebas, `zcode-resume.log`). Conversación, índice y transcripción con host simulado (`worker-index.log`). UI: proyección y panel, 15 pruebas (`worker-transcript.log`). Typecheck de contratos, núcleo y UI en cero; lint de los archivos tocados sin avisos (`typecheck*.log`, `lint.log`); sitio generado con 11 páginas públicas y 23 privadas (`docs.log`). La suite de Auton quedó en verde; la suite completa del núcleo conserva fallos previos de este entorno Windows (rutas de workflow y búsqueda de herramientas), ajenos a este cambio y capturados en `full-core.log`.

Intento de apertura de la app: `pnpm dev:desktop` compiló los paquetes y llegó al arranque, pero Vite no pudo abrir el puerto 5174 porque lo ocupa el worktree `C:\Nueva-carpeta\auton-desktop-muse` (PID 44136). El proceso ajeno sigue vivo; la corrida terminó con exit 1 a los 254 s. Evidencia y diagnóstico en `desktop-launch.log`. La verificación visual degrada a la prueba estructural y unitaria de la proyección y del panel.

Ronda de cierre de la revisión: la superficie del proyecto ahora lee de verdad `.auton/workers/index.json` y la transcripción de cada worker con el servicio de archivos (`useSessionWorkerConversations`), reemplaza la fila del agente cuando coincide el id de sesión y conserva su nombre. `transcriptFromMuseTurns` emite una fila `close` por turno completado y tiene prueba propia. El cliente MSP marca el turno activo al aceptar `turn/start`/`turn/steer` (sin esperar la notificación), `waitForIdle` cae al último turno no terminal y `lastResponse` lee la última respuesta de la conversación; el puerto real manda una segunda entrada tras el primer turno y comprueba salida, transcripción e índice. El steer con `meta` ahora exige que la respuesta del asistente contenga PRIMERO y SEGUNDO en ese orden, sobre la misma sesión.

Evidencia de esta ronda: `ui-wiring.log` (19 pruebas de UI, incluida la lectura real del índice/transcripción y la proyección de Muse), `transcript-tests.log` (16 pruebas de núcleo), `muse-msp.log` (3 pruebas reales: dos entradas, segunda entrada por el puerto y steer con meta), `typecheck-core.log` y `typecheck-ui.log` en cero.

Reintento visual con el puerto 5174 libre: `pnpm dev:desktop` compiló, creó la ventana y expuso CDP en 9229. Se abrió el proyecto Lunar y se capturó el detalle de un worker Muse echo creado con el cliente real sobre el workspace del proyecto: la pantalla muestra `Orquestador: Di hola desde Muse para la captura de UI`, `echo: Di hola desde Muse para la captura de UI` y `Turno completado.`, con el worker en estado Terminado. Captura en `desktop-muse-detail.png`; salida de la corrida en `ui-worker-capture.log`. Los artefactos inyectados en el proyecto se retiraron después de la captura.
