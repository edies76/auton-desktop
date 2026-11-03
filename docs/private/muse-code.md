# Muse Code como motor del worker

> Documento privado. Última verificación: 2026-11-03, rama `feat/grok/worker-sesion-completa`.
> Sonda real: Muse Code 1.4.14 (1.4.14-R7309.1), autenticado con el proveedor Meta.

## Qué se integra y qué no

Muse Code entra como **motor del worker**, no como cerebro. El orquestador sigue siendo Auton y
conserva el plan, los límites, los modos y la revisión. Muse es un **programa externo**: no se vendoriza
ni se mete su código en el repo.

## El contrato real (sonda)

- Binario: `muse` en el PATH, o `AUTON_MUSE_BIN` con una ruta.
- Versión: `muse --version` → `Muse Code 1.4.14 (1.4.14-R7309.1)`.
- Headless de una pasada: `muse exec --json --prompt-file <archivo> --workspace <carpeta>`.
- Conversacional: `muse serve` habla **MSP** (JSON-RPC 2.0 sobre stdio), que es el transporte por
  defecto del worker. Ver `conversacion-y-sesiones.md` para el handshake completo.
- `--json` emite **JSONL**: eventos de sesión, tareas y el cierre `run.terminal.completed` (o `failed`).
  El texto final viene en `payload.text`; el estado, en `payload.terminal`.
- Sandbox y aprobaciones vienen encendidos. Para trabajo autónomo el adaptador usa
  `--approval-mode never` con `exec` y `approvalMode: "allowAll"` con `serve`, más
  `--disable-request-user-input`.
- Autenticación: el proveedor Meta ya está configurado en este equipo; la corrida real devolvió texto.
- El canal a mitad de corrida va por `turn/steer` sobre `serve`. `muse session-message` **no está
  soportado en Windows** y no se usa.

## Cómo se elige

El orquestador despacha con la herramienta Agent:

```
engine: "zcode" | "muse"   (ausente = zcode)
```

- La elección viaja en el encargo y en el item del plan (`engine`), y el plan la imprime.
- Un motor inventado lo rechaza el esquema; uno no disponible (binario o auth) falla con el motivo de
  la sonda. **Nunca se ejecuta otro motor en silencio.**
- `engine: "muse"` fuerza la ruta de sesión: Muse no corre por el runner de subagentes.
- El motor por defecto sigue siendo `zcode`; Muse es una elección por sprint.

## La capa de Auton y el modo

Muse no separa un system prompt del turno: la capa de Auton **abre el prompt**. El adaptador compone:

1. identidad de worker, rol, modo, esfuerzo, canal y REPORTE (`buildAutonWorkerPromptForRequest`);
2. `## ENCARGO` con el brief del orquestador;
3. `## INSTRUCCIONES DEL PROYECTO` con AGENTS.md resuelto, si existe.

La política del modo se impone con flags reales del motor:

| Modo | Flags |
| --- | --- |
| `read`, `research` | `--disable-write --disable-shell` |
| `debug` | `--disable-write` (la shell queda para reproducir) |
| `build`, `refactor` | sin flags extra |

No hay paridad herramienta por herramienta entre ZCode y Muse; se garantiza **el contrato**: mismo
brief, mismo modo, mismo REPORTE de cuatro estados, misma exigencia de evidencia y misma revisión.

## Ciclo de vida

El transporte por defecto es `serve` (conversacional); `AUTON_MUSE_TRANSPORT=exec` conserva la pasada
única.

- **Lanzar (`serve`)**: crea la carpeta propia del worker, arranca `muse serve` con `cwd`, hace
  `initialize → initialized → session/start`, captura el `sessionId` del motor y manda el prompt con
  `turn/start`.
- **Lanzar (`exec`)**: escribe `.auton/muse-prompt.txt` y arranca `muse exec` con `--workspace`.
- **Leer (`serve`)**: consume `turn/started`, `item/started|delta|completed`, `turn/completed` y
  `session/tokenUsage`; acumula la conversación y guarda el cierre como salida.
- **Leer (`exec`)**: lee el JSONL y guarda todas las líneas en `.auton/muse-progress.jsonl`; el texto
  final se devuelve al puerto.
- **Detener**: `turn/interrupt` y cierre del cliente; en `exec`, mata el árbol de procesos
  (`taskkill /T /F` en Windows). Si el turno cierra después de la parada, el estado no se convierte en
  “completado”.
- **Cerrar (`serve`)**: mantiene la sesión viva (`keepAlive`) hasta que el puerto la para; la
  conversación queda disponible para otra entrada.
- **Cerrar (`exec`)**: `run.terminal.completed` → respuesta; `failed` o `cancelled` → error explícito
  con el motivo; sin terminal → error con el stderr y el código de salida.
- **Mensajes**: con `serve`, un mensaje nuevo en el mismo turno se entrega como `turn/steer` con
  `expectedTurnId`, y uno posterior abre otro turno de la misma sesión. Con `exec`, `steer` falla con
  un mensaje claro en vez de fingir el canal.

## Variables de entorno

| Variable | Efecto |
| --- | --- |
| `AUTON_MUSE_BIN` | Ruta o nombre del binario (por defecto `muse`) |
| `AUTON_MUSE_TRANSPORT` | `serve` (por defecto, conversacional) o `exec` (una pasada) |
| `AUTON_MUSE_PROVIDER` | Proveedor para la corrida (`meta`, `echo`) |
| `AUTON_MUSE_MODEL` | Modelo concreto |
| `AUTON_MUSE_MAX_STEPS` | Tope de pasos del modelo |

## Verificación

- `auton-muse-engine.test.ts`: resolución, sonda, flags de modo, argumentos y parser del REPORTE.
- `auton-muse-engine.test.ts`: adaptador `exec` contra un proceso hijo real (fixture) y, con
  `AUTON_MUSE_E2E=1`, contra el Muse real: `echo` dos veces y `meta` una.
- `auton-muse-msp.test.ts`: handshake MSP y conversación real, con `echo` y `meta`, y el puerto real
  lanzando Muse una vez.
- `auton-worker-conversation.test.ts` y `auton-worker-port-conversation.test.ts`: reanudación,
  conversación, índice y transcripción.
- `auton-engine-dispatch.test.ts`: selección de motor, ausencia de fallback silencioso y paso de
  `engine` por la herramienta.
- `auton-worker-task-mode.test.ts`: el prompt ensamblado del orquestador describe el motor y su sesión.

## Límites

- Un `steer` exige `expectedTurnId`; fuera de un turno activo, el mensaje abre un turno nuevo.
- La autenticación desatendida depende de la configuración del equipo; si falla, la sonda lo dice.
- No se replica su sistema de aprobaciones ni su interfaz.
- El coste de una corrida real con Meta es del orden de decenas de miles de tokens de entrada.

