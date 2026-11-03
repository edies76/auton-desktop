# Núcleo en vivo: implementación

Detalle de lo construido en la etapa 2 del núcleo (bucle vivo, canales anidados y
canal rápido), con los archivos, las invariantes, lo que se probó y lo que falta.

## 1. Decisión del bucle

`core/src/auton/live-loop.ts` — lógica pura con reloj inyectable.

- `AutonLiveLoop.dispatch()` sube el contador de canales y reinicia el silencio.
- `close()` lo baja y, al llegar a cero, libera a quien espere.
- `activity()` reinicia el silencio (lo llama el runtime cuando llega un mensaje
  de worker).
- `waitForIdle({ timeoutMs, signal })` resuelve `true` si queda ocioso, `false` si
  vence el tiempo o se aborta. Nunca cuelga.
- `formatHeartbeatMessage` produce la línea de estado: número de workers y reloj.
- Registro por sesión: `registerAutonLiveLoop`, `getAutonLiveLoop`,
  `waitForAutonIdle`.

**Invariante**: el latido solo habla con `running > 0` y ≥ 90 s de silencio
(`LIVE_HEARTBEAT_MS`).

## 2. Enganche en el runtime

- **Despacho y cierre**: `subagent/runner.ts` — `dispatch()` al arrancar un worker
  en background (`start`), `close()` en `finalizeBackgroundCompletion` y
  `finalizeBackgroundFailure`.
- **Latido**: el mensaje entra por `options.enqueueParentTaskNotification`, la
  misma cola que el aviso de cierre. Llega como notificación de sistema, no como
  mensaje del usuario.
- **Noticias de worker**: `runtime/methods/background-notifications.ts` llama a
  `activity()` en cada notificación al orquestador, así el latido no habla encima
  de una noticia recién llegada.
- **Turno que no cierra**: `runtime/methods/turn-loop.ts` espera
  `waitForAutonIdle(sessionId, { timeoutMs: 30 min, signal: turnAbortSignal })`
  antes del `break` que cierra el turno.

**Invariante**: con un canal vivo, el turno no emite su cierre; al cerrar el
último canal, sí.

## 3. Superficie del hilo

- `packages/ui/src/auton/subagentChannel.ts` — traduce la fila real del subagente:
  estado (`en marcha`, `terminó`, `falló`, `detenido`), reloj y props del evento.
- `packages/ui/src/auton/WakeEventRow.tsx` — fila centrada para los eventos que no
  son del humano: pregunta (ámbar), cierre (verde), latido (neutro), con acción.
- `packages/ui/src/v4/ConversationAgentToolCallRow.tsx` — pinta el canal: reloj
  mientras corre y fila de cierre al terminar, con acción de abrir.

**Invariante**: el evento de cierre conserva el estado final y el reloj; la fila
sale centrada y con `data-kind`.

## 4. Canal rápido

- Worker → orquestador: `createCoordinatorResponsePort` →
  `runtime.enqueueSubagentMessage` → comando de runtime → mensaje
  `<subagent-message>` en el contexto del orquestador (visibilidad `model-only`).
- Orquestador → worker: `createSubagentMessageSink` → `runtime.steerTurn` con
  `inputPresentation: "coordinator_steer"` y `delivery: "guide"`. Si el worker no
  tiene turno activo, el envío se rechaza (`no_active_turn`) y no se pierde: el
  candado de respuesta (`answerLock`) decide cuándo se espera.

## 5. Pruebas

| Archivo | Qué ejerce |
| --- | --- |
| `core/tests/auton-live-loop.test.ts` (9) | Reloj, latido, reinicio, cierre, `waitForIdle` por cierre/tiempo/aborto |
| `core/tests/auton-live-loop-wiring.test.ts` (4) | Enganche en el runner y espera en el turno |
| `core/tests/auton-live-turn-runtime.test.ts` (1) | Sesión real: turno abierto, noticia, latido, cierre |
| `core/tests/auton-fast-channel-runtime.test.ts` (2) | Canal rápido en los dos sentidos |
| `ui/test/autonThreadChannels.test.tsx` (2) | Mapeo real del hilo: dos canales, relojes, cierre, acción |
| `ui/test/autonSubagentChannel.test.ts` (5) | Estado, reloj y props del evento |
| `ui/test/autonWakeEventRow.test.tsx` (2) | Render de la fila y callback |
| `core/tests/auton-revert*.test.ts` (8) | Reversión byte a byte, conflictos, idempotencia |
| `core/tests/auton-limits-guard.test.ts` (3) | Un worker no cambia límites |

## 6. Lo que falta y lo que se decidió no tocar

- El turno espera como máximo 30 minutos: si un worker se cuelga sin cerrar, el
  turno se libera y el canal queda huérfano; falta una política de rescate.
- No se tocó la interfaz base de ZCode ni su motor de edición.
- La prueba de que el **modelo elige** la herramienta (no solo que existe) es la
  prueba 17 de `context/PRUEBAS-QUE-PROMETEMOS.md`; requiere un modelo real.

## 7. Commits

`9d6b4151` (núcleo del bucle), `4714c3a3` (espera y registro), `76541b78` (sesión
real), `b38bcbfa` (canal rápido), `3491a3ca` (hilo), `67f644fe` (superficie del
canal).
