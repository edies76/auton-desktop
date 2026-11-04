# Conversación y sesiones de los workers

> Documento privado. Última verificación: 2026-11-03, rama `feat/grok/worker-sesion-completa`.
> Cubre el transporte MSP de Muse, la reanudación de ZCode, el índice durable y la transcripción.

## Muse conversacional: `muse serve` (MSP)

`exec` era una pasada. Para seguir hablando con la misma instancia se usa **MSP sobre stdio**, con
JSON-RPC 2.0 **una línea por frame**:

1. `initialize` con `clientInfo`.
2. Notificación `initialized`.
3. `session/start` con `{ commandId, workspaceRoot, approvalMode: "allowAll" }`.
4. `turn/start` con `{ commandId, sessionId, ifBusy: "steer", input: [{ type: "text", text }] }`.
5. Para una segunda entrada mientras el turno corre: `turn/steer` con `expectedTurnId`.
6. Para parar: `turn/interrupt`.

Eventos que se consumen: `turn/started`, `item/started`, `item/delta` (`delta` + `field`), `item/completed`,
`turn/completed` (`terminal`, `reason`) y `session/tokenUsage`. Los `commandId` son UUIDv7 porque el host
valida el formato.

El transporte es seleccionable: `serve` es el camino por defecto y `exec` queda como alternativa
(`AUTON_MUSE_TRANSPORT=exec`). El adaptador implementa la misma interfaz de worker para los dos.

## Reanudación de ZCode

Un worker de sesión terminado se puede reanudar en **la misma sesión y la misma carpeta**. El puerto
guarda el request y la colocación al lanzar; al recibir un mensaje de un worker terminado, recrea el
runtime con el mismo `sessionId`, `resume: true` (no vuelve a persistir la sesión) y ejecuta el nuevo
turno. Dos reanudaciones seguidas conservan el id y el contexto.

## Índice durable de sesiones

Archivo: `<workspace>/.auton/workers/index.json`. Escritura atómica (temporal + rename) y serializada.

```json
{
  "workerId": "agent_…",
  "taskId": "agent_…",
  "engine": "zcode | muse",
  "engineSessionId": "sess_auton_… | 01a1a… (Muse)",
  "workspace": "<proyecto>/.auton/workers/<sesión>",
  "status": "running | completed | failed | stopped | waiting",
  "startedAt": "ISO",
  "endedAt": "ISO",
  "outputFile": "…",
  "transcriptFile": "…",
  "description": "…",
  "mode": "build | read | research | debug | refactor",
  "effort": "minimal | standard | thorough"
}
```

`listWorkerSessions(workspaceRoot, { engine })` devuelve las entradas ordenadas por `startedAt` y
filtradas por motor. El id de Muse se captura de `session/start` y se publica en el task
(`engineSessionId`).

## Transcripción

El contrato es el que ya consume el panel: `message | tool | question | close`, con rol
`orchestrator | worker`.

- **Muse**: `item/started` + `item/delta` + `item/completed`; los `userMessage` son del orquestador, los
  `agentMessage` del worker y los `toolCall` filas de herramienta. Cada turno termina con una fila
  `close` (`Turno completado.` o el motivo de fallo/cancelación).
- **ZCode**: eventos de su sesión (`model_request` con el último mensaje del orquestador,
  `model_complete` con el texto del worker, `tool_call_*`, `turn_error`), con los mensajes de la sesión
  como respaldo.
- Se escribe en `<workspace>/.auton/worker-transcript.json` y se proyecta con
  `projectSessionWorkerView`; el detalle del worker lo pinta tal cual.
- La superficie lee el índice y las transcripciones con el servicio de archivos del host
  (`useSessionWorkerConversations` en `AutonSpaceLive`), reemplaza la fila del agente cuando el id de
  sesión coincide y conserva el nombre del agente. No hay datos de demostración en ese camino.

## Pruebas

- `auton-muse-msp.test.ts`: conversación real con `echo` (dos entradas, ambas respuestas en orden),
  segunda entrada por el puerto tras el primer turno, cierre de transcripción y steer en caliente con
  `meta` (la respuesta del asistente contiene las dos respuestas en orden); además, el puerto real
  lanzando Muse una vez, con índice y parada.
- `auton-worker-transcript.test.ts`: la proyección de Muse produce mensajes, herramientas y una fila
  de cierre por turno, con el motivo en fallo/cancelación.
- `auton-worker-conversation.test.ts`: reanudación de ZCode dos veces (misma sesión, misma carpeta,
  contexto) y transcripción desde eventos reales; índice ordenado y filtrado.
- `auton-worker-port-conversation.test.ts`: puerto con host conversacional simulado (keepAlive,
  segunda entrada, salida, índice y transcripción), sin depender de Muse.
- UI: `autonSpaceWorkersLive.test.tsx` lee el índice y la transcripción con el servicio de archivos y
  abre el detalle con las filas reales; `autonWorkerPanel.test.tsx` proyecta la salida de
  `transcriptFromMuseTurns`; `autonSessionWorkerConversations.test.ts` cubre el parser y la instantánea.

## Límites

- MSP exige el handshake `initialize → initialized`; sin la notificación, `session/start` responde
  `notInitialized`.
- `approvalMode` de MSP usa `allowAll | promptUnmatched | onRequest | denyUnmatched`; el adaptador usa
  `allowAll` y no replica la interfaz de aprobaciones.
- `session-message` no está soportado en Windows; la conversación va por stdio de `serve`.
- No hay paridad herramienta por herramienta con ZCode.
- Las corridas reales con Meta cuestan tokens; la iteración va con `echo`.
