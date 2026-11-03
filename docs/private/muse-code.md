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
- Headless: `muse exec --json --prompt-file <archivo> --workspace <carpeta>`.
- `--json` emite **JSONL**: eventos de sesión, tareas y el cierre `run.terminal.completed` (o `failed`).
  El texto final viene en `payload.text`; el estado, en `payload.terminal`.
- Sandbox y aprobaciones vienen encendidos. Para trabajo autónomo el adaptador usa
  `--approval-mode never` y `--disable-request-user-input`.
- Autenticación: el proveedor Meta ya está configurado en este equipo; la corrida real devolvió texto.
- Canal a mitad de corrida: `muse session-message` **no está soportado en Windows**. `exec` es one-shot.

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

- **Lanzar**: crea la carpeta propia del worker, escribe `.auton/muse-prompt.txt`, arranca `muse exec`
  con `cwd` y `--workspace` en esa carpeta.
- **Leer**: el adaptador lee el JSONL y guarda todas las líneas en `.auton/muse-progress.jsonl`. El
  texto final se devuelve al puerto del worker, que lo escribe como salida de la tarea.
- **Detener**: mata el árbol de procesos (`taskkill /T /F` en Windows). Si el turno cierra después de
  la parada, el estado no se convierte en “completado”.
- **Cerrar**: `run.terminal.completed` → respuesta; `failed` o `cancelled` → error explícito con el
  motivo; sin terminal → error con el stderr y el código de salida.
- **Mensajes a mitad de corrida**: no soportados. `steer` falla con un mensaje claro en vez de fingir el
  canal. Para conversar en caliente, el worker va en `zcode`.

## Variables de entorno

| Variable | Efecto |
| --- | --- |
| `AUTON_MUSE_BIN` | Ruta o nombre del binario (por defecto `muse`) |
| `AUTON_MUSE_PROVIDER` | Proveedor para la corrida (`meta`, `echo`) |
| `AUTON_MUSE_MODEL` | Modelo concreto |
| `AUTON_MUSE_MAX_STEPS` | Tope de pasos del modelo |

## Verificación

- `auton-worker-engine.test.ts`: resolución, sonda, flags de modo, argumentos y parser del REPORTE.
- `auton-muse-engine.test.ts`: adaptador contra un proceso hijo real (fixture) y, con
  `AUTON_MUSE_E2E=1`, contra el Muse real: `echo` dos veces y `meta` una, con resultado consistente.
- `auton-engine-dispatch.test.ts`: selección de motor, ausencia de fallback silencioso y paso de
  `engine` por la herramienta.
- `auton-worker-task-mode.test.ts`: el prompt ensamblado del orquestador menciona Muse y su límite.

## Límites

- Muse es one-shot: sin `steer` a mitad de corrida en este entorno.
- La autenticación desatendida depende de la configuración del equipo; si falla, la sonda lo dice.
- No se replica su sistema de aprobaciones ni su interfaz.
- El coste de una corrida real con Meta es del orden de decenas de miles de tokens de entrada.
