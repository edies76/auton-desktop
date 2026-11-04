# INVENTARIO — ZCode 3.16.2 en `auton-desktop-muse` (F1, solo lectura)

Fecha: 2026-10-27. Rama: `auton-desktop`. No se borró ni una línea.

## Vive (cáscara e infra que se reutiliza)

- `packages/desktop` — shell Electron (main `out/main/index.js`, renderer Vite,
  build `tsup`, `scripts/bundle.mjs`, e2e wdio con sharding Windows,
  `test:installer-nsh-smoke`). Es lo más caro de reconstruir: se queda.
- `packages/rpc`, `packages/shared`, `packages/ui` — infra y primitivos de UI.
  El cerebro hablará por `rpc` donde calce.
- `packages/services/src/fs/atomicFileUtils.ts` — escritura atómica de
  archivos (verificado que existe; cuerpo por leer en F2/F3 antes de adoptar).
- `packages/services/src/git/` (`gitCheckpointRepo.ts`, `gitCliRepo.ts`,
  `gitCliHelpers.ts`, menciones a worktree) — checkpoints git y ayuda CLI;
  candidato a adoptar para aislamiento y revert de sprints (cuerpo por leer).
- `packages/services/src/subagents/` (`subagents.ts`, `subagentsService.ts`,
  `subagentStorage.ts`, `subagentConfigScope.ts`, `subagentModelSelection.ts`)
  — el manejo de subagentes que la visión manda adoptar. Cuerpos por leer en F3
  antes de decidir portar vs adoptar.
- `packages/services/src/zcode-session/` (`zcodeSession.ts`,
  `zcodeSessionService.ts`, `zcodeSessionDraftRegistry.ts`,
  `zcodeSessionApiRetry.ts`) + `packages/services/src/session/`
  (persistencia, títulos, `sessionMailbox.ts`, scopes MCP por workspace) —
  persistencia de sesiones ya resuelta; mapear contra `.auton-desktop/`.
- `apps/zcode-cli` (v0.16.9, CLI TS + TUI + SEA) — vive como herramienta dev,
  no como producto.
- `packages/e2e-report`, e2e `conversation-session-verified` — infra de
  verificación que el plan reutiliza en F6.

## Muere (el "coder directo" y lo que asume que el humano es el harness)

- El loop agente-a-usuario en `packages/services/src/zcode-agent/`
  (`zcodeAgent.ts` y piezas: admisión, telemetría, relay) — se reemplaza por el
  orquestador `@auton/brain`. Alcance exacto archivo por archivo cuando F2
  lea los cuerpos.
- `packages/web` como producto (pantallas útiles solo como referencia visual).
- Telemetría/marketing que no aporte a los gates (`conversation-telemetry`,
  `marketing-touch`, `telemetry`, `usage-stats`): candidatas al corte en F6,
  decisión final tras comprobar que nada las importa.

## Adoptar (comparar y quedarse con lo mejor, práctica 12 de la visión)

1. Aislamiento de subagentes (`subagents/` vs worktrees+leases del prototipo).
2. Selección/admisión de modelos (`provider/` + `model-provider/`:
   `effective-model-selection.ts`, `owned-order.ts`, `registry.ts` vs rotación
   con preferencia explícita del prototipo).
3. Cancelación de turnos (dónde vive el abort del loop agente; `AbortController`
   aparece en el codebase — punto exacto del agente por localizar en F2).
4. Edición atómica (`fs/atomicFileUtils.ts` vs temp+fsync+rename con reintento
   EPERM/EBUSY del prototipo).
5. E2E de ciclo de sesión ya existente como harness de los gates F2–F4.

## Notas de entorno (verificadas hoy)

- `pnpm install` OK (2m04s, pnpm 10.33.2; aviso no bloqueante: engine quiere
  node 24.14.0, hay 24.12.0).
- `pnpm typecheck` en verde SOLO con `NODE_OPTIONS=--max-old-space-size=8192`
  (sin eso, V8 OOM exit 134). Fijar esta variable en cada script de verificación.
- HEAD clonado más nuevo que `zcode-ref`: el público va en 3.16.2 con commits
  `chore: sync ZCode source` sobre el tag v3.15.1.
