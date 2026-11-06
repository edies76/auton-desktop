# Terminal 13 — app nativa Auton

- Añadí `native/auton-desktop`, un shell Rust con eframe/egui y render Glow. Arranca el `@zcode/cli app-server --stdio` real como proceso hijo; no simula al agente ni sustituye el runtime.
- La sesión normal recibe la doctrina y el procedimiento del orquestador Auton desde el `ContextBuilder` actual. El cliente abre workspace, envía objetivos, muestra el stream, herramientas/workers, plan y estados.
- Agregué selector de modelos disponibles y cambio por `session/setModel`; los secretos siguen en el storage local actual.
- La UI responde a `interaction/requestPermission` (permitir una vez/denegar) y `interaction/requestUserInput` (preguntas, opciones múltiples y aprobación de plan). Requests desconocidos fallan cerrados.
- Añadí scripts Linux/macOS y PowerShell que construyen el CLI y lanzan la app en modo release, junto con requisitos y límites en el README.
- Verificación de entorno: `bash -n native/auton-desktop/scripts/run-dev.sh` pasa. Este entorno no tiene `cargo`, `rustc` ni `rustfmt`; el worktree tampoco tiene `node_modules`, así que aquí no pude compilar Rust ni el app-server. No hay mediciones de RAM/arranque ni afirmación de que el shell ya compile.
- Límites actuales: no restaura historial de conversación; configuración/credenciales de providers aún usa la UI existente; no incluye adjuntos, terminal/editor integrados ni respuestas a RPCs de auth de MCP.
