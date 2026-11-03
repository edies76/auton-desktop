# Changelog

Todo lo relevante de Auton Desktop. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado
[SemVer](https://semver.org/lang/es/) mientras no haya releases públicas.

## [0.3.0] — 2026-11-02

Los límites dejan de ser texto en el prompt y pasan a gobernar el despacho. La
documentación se separa en un árbol público y otro privado.

### Añadido

- **Gobierno del despacho**: un item no arranca sin límites versionados, cada
  despacho consume un intento contado por el plan, y una aprobación pendiente
  detiene el trabajo sin gastar intento.
- **`not_evaluable` como estado de primera clase**: el sistema puede declarar que
  no sabe juzgar; exige la pregunta o la decisión escrita y escala al humano.
- **Reportes de calibración**: un worker puede reportar que un límite está mal
  puesto; el orquestador lo registra y el worker sigue sin poder cambiarlo.
- **Documentación en dos árboles**: `docs/public/` (producto) y `docs/private/`
  (implementación), con builds separados en `site/dist` y `site/private-dist`.

### Cambiado

- El handler del plan valida los cambios de límites: versión nueva, historial
  append-only y una entrada por campo cambiado.
- La tarjeta del plan muestra intentos, aprobaciones, reportes y decisiones
  pendientes.

## [0.2.0] — 2026-11-01

Segunda vuelta sobre la misma base: el panel de programadores se abre solo, el
plan se lee completo y el despacho vuelve a depender del prompt.

### Añadido

- **El panel de programadores se abre solo** la primera vez que arranca un
  programador en la sesión, para que la flota esté a la vista.
- **Tarjeta del plan más rica**: enunciado del objetivo, restricciones, detalle de
  cada item y sus archivos, pruebas y preguntas abiertas.
- **Sitio público**: landing y `/docs` generados desde los markdown del repo y
  publicados en S3 (`auton-docs-027252078119`).
- **`docs/VERSIONADO.md`**, **`docs/SCORECARD.md`** y **`docs/PODA-MVP.md`**.

### Cambiado

- **El despacho en background vuelve a depender del prompt.** Se quita el forzado
  en código del handler `Agent`; la regla queda en la doctrina del orquestador.
- Los tres archivos de Auton se mueven a sus propios módulos
  (`contracts/src/auton`, `core/src/auton`, `ui/src/auton`).

## [0.1.0] — 2026-11-01

Primera versión que se puede abrir, usar y enseñar. Alpha privada de hackathon.

### Añadido

- **Orquestador con doctrina propia.** El agente principal se presenta como Auton
  y trabaja con el ciclo PLAN · BUILD · VERIFY · LOOP · EVIDENCE. Incluye reglas
  de despacho no bloqueante, verdad en disco y "no terminas el trabajo del
  programador".
- **Tool `AutonPlan`.** Lee y escribe `<proyecto>/.auton/plan.json` con objetivo,
  items, estado, esfuerzo, archivos, evidencia y preguntas abiertas.
- **Tarjeta del plan en el chat.** Render propio con badges de estado.
- **Programadores en background.** Un `auton-worker` corre siempre en background,
  aunque el modelo olvide pedirlo.
- **Política de esfuerzo por encargo.** `minimal | standard | thorough` en la
  primera línea del brief; el worker se construye con ese perfil.
- **Identidad de programador en la UI.** El worker se muestra como *Programador*
  y el panel lateral se llama *Programmers*, con filas al estilo del panel
  *New tab*.

### Cambiado

- **Datos separados de ZCode.** Sesiones, credenciales, ajustes y telemetría en
  `~/.auton`. Los proveedores se heredan una sola vez; el historial no.
- **Perfil de Electron propio.** `Auton Dev` en lugar de `ZCode Dev`: deja de
  compartir localStorage, cookies y el navegador embebido con el ZCode real.
- **Navegación más simple.** Fuera Automations y Plugin Marketplace.

### Eliminado

- Plugin `restore-legacy-sessions` (importaba sesiones de ZCode).
- Plugins de ofimática por defecto (`documents`, `pdf`, `presentations`,
  `spreadsheets`): cuatro hosts MCP menos, ~570 MB de RAM ahorrados.

### Corregido

- La configuración de la app se escribía en `~/.zcode/v2/setting.json` aunque los
  datos ya estuvieran separados.
- El primer arranque sin proveedores tras migrar el perfil.

### Conocido

- Un `auton-worker` no se reanuda solo tras cerrar la app; el plan sí sobrevive.
- El panel de programadores no se abre automáticamente al despachar.
- El agente todavía usa `~/.zcode/cli` para plugins, agentes y logs.
