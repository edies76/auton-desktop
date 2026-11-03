# Contrato de notificaciones del orquestador

> Regla que ordena todo lo demás: **el orquestador casi nunca está "ocupado"**.
> Mientras los programadores trabajan, él sigue disponible, cuenta lo que hace por
> debajo y abre canales de ejecución sin cerrar la conversación.

## 1. El problema con el modelo de dos canales

ZCode trabaja con dos canales: **una respuesta final** y **un loop de ejecución**
que corre desde que empieza la tarea hasta que termina. Cuando el loop cierra, se
emite la respuesta final y el turno acaba. Ese modelo asume que el humano espera.

Para Auton es al revés: el humano escribe, el orquestador reparte y **el turno no
se cierra**. Si el turno se cierra, el humano pierde la presencia de ingeniero que
delegó: no sabe qué se está haciendo, ni cuándo preguntar, ni qué pasó por debajo.

Por eso el loop de ejecución del orquestador es **variable**: puede emitir texto,
lanzar trabajo, recibir un reporte, lanzar otro trabajo y volver a hablar, todo
dentro de la misma conversación y sin un "final" que lo clausure.

## 2. Los cuatro tipos de salida

Toda salida del orquestador cae en uno de estos cuatro, y cada uno tiene su forma:

| Tipo | Cuándo | Forma | Dónde se ve |
| --- | --- | --- | --- |
| **Narración** | al empezar algo y al terminarlo | 1–3 líneas: qué hace, con quién, qué espera | hilo del chat |
| **Pregunta** | cuando una decisión es del humano | una pregunta, con opciones y la recomendada | chat + Decision Inbox |
| **Evidencia** | al cerrar un item o un sprint | veredicto + prueba citable (comando, archivo, URL) | chat + tarjeta del plan |
| **Alerta** | fallo repetido, conflicto, riesgo | qué se rompió, qué hizo, qué necesita | chat + panel de programadores |

Nada de esto es un log. Un log cuenta pasos; esto cuenta **estado y decisiones**.

## 3. Cadencia: cuándo se habla y cuándo se calla

El error simétrico es narrar cada tool call. La regla:

- **Siempre** al despachar (qué lanzó y qué queda en marcha).
- **Siempre** al recibir un reporte (qué volvió y qué decide).
- **Siempre** al cambiar el plan o el veredicto.
- **Nunca** por cada lectura de archivo o comando intermedio: eso vive en los
  canales de ejecución, no en la voz del orquestador.
- Si pasan más de **90 segundos** sin noticia y hay trabajo en curso, una línea de
  estado ("sigue X, faltan Y"). Es un latido, no un resumen.

## 4. Canales de ejecución dentro del hilo

Un "canal" es una unidad de trabajo con su propia vida, visible mientras corre:

- **Se abre** con un despacho: el orquestador crea el canal y sigue hablando.
- **Vive** en paralelo a la conversación: el humano puede escribir y el canal sigue.
- **Reporta** al orquestador, no al humano; el orquestador decide si eso se cuenta.
- **Se cierra** con evidencia o con un estado (`DONE`, `DONE_WITH_CONCERNS`,
  `NEEDS_CONTEXT`, `BLOCKED`).

Varios canales pueden estar abiertos a la vez y **abrirse en medio de una
respuesta**: el orquestador escribe dos líneas, lanza un programador, sigue
escribiendo y lanza otro. La conversación no se bloquea esperando a ninguno.

## 5. Prioridad cuando llegan varios eventos

Si dos cosas compiten por la voz del orquestador:

1. Una pregunta del humano.
2. Un fallo que necesita decisión.
3. Un reporte que cierra trabajo.
4. Un latido de estado.

Los eventos rutinarios (progreso, reintentos permitidos) **no interrumpen**: se
acumulan y salen en el siguiente turno del orquestador. Esto evita que el chat se
convierta en una consola.

## 6. Qué implica en el runtime (para implementar)

- El turno del orquestador **no termina cuando termina su loop**: queda a la
  escucha de los eventos de sus canales, igual que hoy queda a la escucha del
  humano.
- Los reportes de los programadores entran como **eventos**, no como mensajes
  nuevos de usuario.
- El estado de cada canal se persiste fuera del proceso del modelo: si la app se
  cierra, al volver se sabe qué estaba corriendo y en qué quedó.
- La UI necesita dos superficies separadas: el **hilo** (voz del orquestador) y el
  **panel de canales** (lo que corre por debajo). El mismo evento puede aparecer
  en ambos con distinto nivel de detalle.

## 7. Cómo se mide que funciona

- **Intervenciones humanas por entrega verificada**: debe bajar.
- **Tiempo sin noticia con trabajo en curso**: nunca más de 90 s.
- **Preguntas con opciones**: proporción de preguntas que el humano puede
  responder sin escribir texto libre.
- **Cierres con evidencia**: porcentaje de items cerrados con prueba citable.

Si el humano tiene que preguntar "¿qué pasó?", el contrato falló.

## 8. Estado de implementación

- **Hecho — decisión del bucle**: `apps/zcode-cli/packages/core/src/auton/loop.ts`
  (eventos, prioridades, latido `LOOP_HEARTBEAT_MS = 90_000`, fases).
  Prueba: `core/tests/auton-loop.test.ts`.
- **Hecho — doctrina**: `core/src/context/sections/auton.ts`, sección "El bucle
  vivo" (narración por sprints, prohibido cerrar en silencio).
  Prueba: `core/tests/auton-orchestrator-section.test.ts`.
- **Hecho — superficie del canal**: `packages/ui/src/auton/subagentChannel.ts`
  traduce la fila real del subagente a estado, reloj y evento de cierre; el canal
  se pinta en `v4/ConversationAgentToolCallRow.tsx` con su reloj mientras corre.
  Prueba: `ui/test/autonSubagentChannel.test.ts`.
- **Hecho — fila de evento despertador (los tres tipos salen del mapeo real del hilo)**:
  `buildAssistantWorkRenderItems` llama a `deriveWakeEvents` con cada fila real de
  subagente y emite un ítem `wakeEvent`; `v4/ConversationTurnGroup.tsx` lo pinta
  con `auton/WakeEventItem.tsx`. No hay un segundo camino:
  - **pregunta**: la proyección marca `waitingForAnswer: true` en la fila del
    subagente cuando el `SendMessage` del orquestador salió con
    `requires_answer: true`; `onSubagentMessage` (respuesta del worker),
    `onSubagentStopped` y un nuevo spawn la bajan a `false`.
    Prueba de proyección: `bootstrap/tests/auton-thread-question-projection.test.ts`.
  - **cierre**: `wakeEventForSubagent` con el estado final del canal.
  - **latido**: `heartbeatEventForSubagent` cuando el canal sigue en marcha y lleva
    más de 90 s sin señal; `ConversationTurnGroup` mantiene un reloj de 1 s
    mientras hay un subagente en marcha para que la fila aparezca durante el
    silencio, no solo cuando llega otro evento.
  Pruebas: `ui/test/autonThreadChannels.test.tsx` (las tres por
  `buildAssistantWorkRenderItems` + `WakeEventItem`, sin instanciar
  `WakeEventRow`) y `ui/test/autonWakeEventRow.test.tsx` (pieza visual).
- **Hecho — la fila de pregunta responde desde el hilo**: el ítem `wakeEvent` de
  tipo pregunta recibe `createQuestionRespondHandler` en
  `v4/ConversationTurnGroup.tsx`, que lleva el foco al compositor del hilo.
  Probado con el evento derivado y el handler real en
  `ui/test/autonQuestionRespond.test.tsx` (clic en Responder → foco en el
  compositor; sin callback no hay botón).
- **Hecho — el latido mide silencio real y es visible**: la proyección marca
  `lastActivityAt` al nacer el worker y en cada mensaje suyo (`onSubagentMessage`
  hace upsert); el mapeo del hilo lee ese instante de la fila visible y 90 s sin
  señal producen la fila de latido. La persistencia de la notificación del
  runtime sigue siendo `model-only`: despierta al orquestador, no pinta la fila;
  la fila sale de la fila del subagente.
- **Bloqueado — prueba 17 con modelo real**: pedir "deshaz el sprint 2" y comprobar
  que el orquestador **llama** a `AutonRevert` requiere un proveedor real, que no
  existe en este entorno. La comprobación estructural
  (`core/tests/auton-four-pieces.test.ts`) demuestra registro y ensamblado, no la
  elección del modelo.
- **Bloqueado — preguntas con opciones y "el humano escribe mientras pregunto"**:
  quedan fuera de esta etapa por los Non-goals del plan. La fila de pregunta
  actual responde enfocando el compositor (texto libre), sin opciones
  estructuradas ni reenganche del turno cuando el humano escribe. No se declara
  hecho.
- **Hecho — latido enganchado al runtime**: `core/src/auton/live-loop.ts` mantiene
  un reloj por sesión del orquestador, y el port de subagentes lo alimenta al
  despachar un worker en background y al cerrarlo (completado o fallido). A los
  90 s de silencio con trabajo vivo publica una línea de estado por la misma cola
  que el aviso de cierre, así que despierta al orquestador sin abrir un mensaje
  del humano. Pruebas: `core/tests/auton-live-loop.test.ts` (9) y
  `core/tests/auton-live-loop-wiring.test.ts` (4).
- **Hecho — canal rápido bidireccional**: el worker publica a mitad de encargo por
  el port de coordinación y el orquestador lo recibe como `<subagent-message>`
  (nunca como mensaje del humano); el orquestador instruye al worker en curso con
  el sink real y la instrucción entra en la siguiente petición del worker. Prueba:
  `core/tests/auton-fast-channel-runtime.test.ts`.
- **Hecho — turno que no se cierra**: `runtime/methods/turn-loop.ts` espera con
  `waitForAutonIdle` antes de cerrar (30 min, abortable), y cualquier notificación
  de worker reinicia el reloj (`background-notifications.ts` → `activity()`).
  Prueba sobre sesión real: `core/tests/auton-live-turn-runtime.test.ts` y
  `core/tests/auton-real-dispatch-runtime.test.ts` (despacho real: el turno espera
  al worker lanzado por la herramienta Agent y se libera al cerrar).

| Capacidad | Archivo | Prueba | Commit |
| --- | --- | --- | --- |
| Decisión del bucle | `core/src/auton/live-loop.ts` | `auton-live-loop.test.ts` | `9d6b4151` |
| Turno que no cierra | `runtime/methods/turn-loop.ts` | `auton-live-turn-runtime.test.ts`, `auton-real-dispatch-runtime.test.ts` | `4714c3a3`, `5e03d9ca` |
| Noticias del worker | `runtime/methods/background-notifications.ts` | `auton-real-dispatch-runtime.test.ts` | `07219f97` |
| Canal con reloj | `ui/src/auton/subagentChannel.ts` | `autonSubagentChannel.test.ts` | `3491a3ca` |
| Fila despertadora (3 tipos) | `ui/src/auton/subagentChannel.ts` (`deriveWakeEvents`), `ui/src/auton/WakeEventItem.tsx`, `v4/conversationAssistantWorkItems.ts` | `autonThreadChannels.test.tsx`, `autonWakeEventRow.test.tsx`, `auton-thread-question-projection.test.ts` | `b75b7042`, `3491a3ca`, `b60d66a6` |
| Canal rápido bidireccional | `subagent/coordinator-response.ts`, `message-steering.ts` | `auton-fast-channel-runtime.test.ts` | `b38bcbfa` |
| Cuatro piezas y ensamblado | `auton/contextAuton.ts`, `context/builder.ts` | `auton-four-pieces.test.ts` | `a373592a` |

## 9. Relación con los otros documentos

- [`ARQUITECTURA-ORQUESTADOR.md`](./ARQUITECTURA-ORQUESTADOR.md): el cambio de
  fondo, los tres relojes y el orden de construcción.
- [`SCORECARD.md`](./SCORECARD.md): el juicio que el orquestador emite al cerrar,
  que es una de las cuatro salidas de este contrato.
- [`DECISIONES.md`](./DECISIONES.md): D5 fija esta regla como decisión de producto.
