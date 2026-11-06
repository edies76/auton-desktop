# terminal11 — Codex

Tema: shell nativo Rust/GPUI y extracción inicial de `auton-core`.
Fecha: 2026-11-06.

## Entrega experimental

Qué: worktree `feat/codex/auton-gpui` con ventana GPUI, puente JSONL hacia `IZCodeAgentService`, plan/evidencia y estado de workers leídos del runtime; worktree separada `feat/codex/auton-rust-core` con API Rust del contrato Auton v1 y matriz de extracción.

Por qué: evaluar una ruta nativa ligera y conservar el motor de agente útil sin portar Electron ni la UI React.

Verificado: `cargo check --workspace` Linux; `cargo test -p auton-core` (4 pasaron); typecheck del puente; `session.create` con HOME temporal devolvió el error de proveedor no configurado y stdout tuvo solo JSONL válido.

Pendiente: proveedor real, smoke visual, medir RAM/arranque contra Electron, soporte Windows. No se afirma rendimiento superior ni aceptación del flujo completo.
