# terminal4 ÔÇö grok-build (Grok)

Tema: l├¡mites que gobiernan el despacho y superficie del espacio del proyecto.
Inicio: 2026-11-03.

## 2026-11-03 ÔÇö l├¡mites: intentos, no evaluable y reportes

Qu├®: AutonPlan cuenta los intentos, rechaza el despacho sin l├¡mites o sin intentos, admite el estado
`not_evaluable` con pregunta obligatoria y registra los reportes de calibraci├│n de los workers.
Las cuatro piezas: handler en `core/src/auton/plan-handler.ts`; registro en `builtInTools` con schema de
`attempts`/`needsApproval`/`limitReports` y status `not_evaluable`; l├¡nea en
`core/src/auton/contextAuton.ts` (cu├índo usarlos) ensamblada por `context/builder.ts`; pruebas 8 y 9 de
`context/PRUEBAS-QUE-PROMETEMOS.md`.
Verificado con: `auton-four-pieces.test.ts` (5), `auton-limits-governance.test.ts` (15),
`auton-plan-tool.test.ts` (10) y `auton-limits-guard.test.ts` (3); 33 en verde.
Prueba de la regla: el test four-pieces comprueba registro, prompt ensamblado y cat├ílogo. La elecci├│n
del modelo (prueba 17) necesita una sesi├│n real y no se ejecut├│ aqu├¡.

## 2026-11-03 ÔÇö UI del espacio del proyecto (otro checkout)

Qu├®: pantalla de proyectos, espacio con un compositor, workers en vivo con parada y bloques
Trabajo/Plan/Evidencia en `C:\nueva-carpeta\auton-desktop`. No a├▒ade herramienta al orquestador: es
superficie humana; la parada y el env├¡o usan el `answer` existente.

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
