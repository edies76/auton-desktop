# Shell nativo Auton: estado de implementación

## Decisión

La rama `feat/codex/auton-gpui` prueba una app GPUI sobre `gpui = 0.2.2`. Es un cambio deliberado frente a la guía anterior que reutilizaba la UI Electron; responde a la instrucción del creador de comparar una app nativa Rust. La app no porta el motor de edición: conserva el `IZCodeAgentService` existente detrás de un proceso TypeScript acotado.

## Frontera

Rust controla la ventana, el plan lateral, la proyección de eventos y el ciclo de vida del proceso auxiliar. El auxiliar acepta JSONL por stdin/stdout: `session.create`, `session.resume`, `session.send`, `session.events` y `runtime.shutdown`. Los logs de Node heredan stderr; stdout es protocolo.

El agente sigue usando `context/builder.ts`, con la sección Auton, sus herramientas registradas, workers y el prompt de dirección. El plan y evidencia que la app lee respetan el v1 estricto de `.auton/plan.json`. No se exponen credenciales en el protocolo. `AUTON_DATA_DIR_NAME=.auton` y `AUTON_STORAGE_DIR=~/.auton` aíslan el runtime; el helper existente migra solo los archivos permitidos de proveedor.

`auton-core` porta una primera API Rust para leer/escribir plan v1, registrar eventos JSONL, asociar workers/evidencia y exigir evidencia antes de cerrar. El escritor real del tool `AutonPlan` aún vive en TypeScript y ambos lados comparten archivos; por tanto, la autoridad operativa todavía está en el tool TypeScript. La extracción Rust debe sustituirlo mediante una frontera explícita antes de declararse dueño único del dominio.

## Interfaz actual

- Chat principal conectado a la sesión AgentRuntime real.
- Panel con objetivo, estados y primeras cuatro filas del plan.
- Evidencia reciente leída desde los items del plan.
- Workers mostrados a partir de `tool.updated` real, sin inventar actividad.
- Reanudación del último `sessionId` por proyecto.

Todavía faltan canales anidados con transcript propio, detener worker, relojes worker/sprint/goal, respuestas estructuradas a preguntas/permisos y composer completo con IME. `context/PRUEBAS-QUE-PROMETEMOS.md` sigue siendo el criterio, no se marca como aprobado.

## Verificación y riesgos

- `cargo check --workspace`: Linux, GPUI 0.2.2, correcto.
- `cargo test -p auton-core`: 4 pruebas correctas, incluida compatibilidad de lectura v1 sin reescritura.
- `tsc --project packages/auton-bridge/tsconfig.json`: correcto.
- Puente: `session.create` inicializó servicios en HOME temporal, devolvió el error real de proveedor no configurado y mantuvo stdout como una línea JSON válida. No hubo llamada a proveedor.
- Sin display: no se hizo smoke visual ni medición frente a Electron.
- Windows: GPUI upstream documenta macOS/Linux; no hay soporte prometido.
- `patches/xattr-0.2.3`: parche mínimo por incompatibilidad upstream en Linux (`ENOATTR` no existe en libc Linux; el equivalente es `ENODATA`), con avisos MIT/Apache conservados.
