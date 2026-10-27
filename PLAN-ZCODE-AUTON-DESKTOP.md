# Plan: convertir ZCode en Auton Desktop

## Goal

Tener `C:\Nueva-carpeta\auton-desktop-muse` como clon completo y limpio de ZCode,
convertido en la app de escritorio de Auton: un solo cerebro (orquestador) que
parte el trabajo en sprints con DoD, programmers que ejecutan en background con
scope aislado, tester que verifica con evidencia, y un tablero en vivo. La
disciplina es el producto; la app es donde esa disciplina se ve y se toca.

## Success Criteria

1. `auton-desktop-muse` existe como clon completo de `https://github.com/zai-org/ZCode`
   (rama `main`), en su propia carpeta, sin tocar `zcode-ref`.
2. La app de escritorio arranca en Windows y abre una ventana con: chat del
   orquestador, tablero de sprints en vivo y panel por programmer.
3. El snake de referencia corre de punta a punta desde la app: contrato →
   sprints → dispatch → done con evidencia, cero `failed` mudos, en el orden de
   ~1 minuto que ya se midió en el prototipo web (44,8s, 5 llamadas).
4. `pnpm typecheck` y `vitest run` (unit, sin e2e) en verde en los paquetes
   tocados. E2E de escritorio corriendo al menos el flujo conversación-sesión.
5. Nada de telemetría ni modelo se mueve en silencio: cada cambio de proveedor
   o modelo se anuncia en el hilo donde el humano está mirando.

## Context And Current Facts

- Origen verificado: `C:\Nueva-carpeta\zcode-ref\.git\config` trae
  `url = https://github.com/zai-org/ZCode`, rama `main`. Versión del checkout:
  `3.15.1` (`zcode-ref/package.json`). Es repo público (confirmado por el usuario).
- ZCode es monorepo `pnpm` con paquetes `rpc, provider, provider-node, shared,
  services, client, server, ui, web, desktop`, más `apps/zcode-cli`
  (CLI TypeScript con TUI y empaquetado SEA, v0.16.9) y `packages/e2e-report`.
- El desktop es **Electron**: `packages/desktop` tiene `main` en
  `out/main/index.js`, renderer con Vite, build con `tsup`, empaquetado con
  `scripts/bundle.mjs`, e2e con wdio + sharding en Windows
  (`run-windows-e2e-shards.mjs`) y smoke tests del instalador NSH. Esto ya
  existe y funciona: es la cáscara que se reutiliza.
- Auton lado prototipo (`auton cat jam zcode`, pkg `auton-grok-cat-jam`
  v0.2.0): orquestador con system prompt de 9.454 chars
  (`src/orch/prompt.ts`: contrato → partir → despachar → dirigir → cerrar;
  explorar es verificar, no un paso previo), `runtime.ts` con 39 tools,
  board/sprints/instancias con scope leases y worktrees, robustez "nunca
  failed" (el coder sintetiza REPORTE al agotar turnos; instancias/sprints
  quedan `done` o `blocked`, jamás `failed` mudo), rotación
  `beam-free → longcat-2.5-preview-free` (únicos free usables por API; el resto
  del catálogo da 403 fuera del cliente oficial), fallback que avisa en el hilo
  en vez de cambiar de modelo en silencio, UI web React (chat + tarjetas de
  tools + tablero). Propósito completo en `Desktop/AUTON-VISION.md`
  (12 principios, §6 foso, §10 norte, Lunar Móvil de 100 sprints como caso de
  prueba).
- Lo que ZCode ya resolvió y Auton debe adoptar (práctica 12 de la visión:
  comparar con productos maduros): manejo de subagentes/instancias aisladas,
  admisión por proveedor+modelo, abort/watchdog de turnos, edición atómica con
  reintento en Windows, y su infra de e2e de sesiones. Detalle exacto por
  verificar en F1 dentro del clon (no se infiere nada del checkout viejo).

## Constraints And Non-goals

- `zcode-ref` no se toca: es la referencia intacta. Todo el trabajo pasa en
  `auton-desktop-muse`, en rama propia desde el día 1.
- Windows primero (el humano vive en Windows/pwsh, Bun 1.3.13, Node v24).
  macOS/Linux quedan para después del primer instalador verde.
- Las keys van en config privada por instancia (`.env` / store del host),
  nunca en el repo ni en logs. Sin excepción.
- No-go en este plan: backend en la nube propio, auto-update público, firma de
  instaladores para distribución, multi-workspace remoto, y el caso Lunar Móvil
  completo (ese es el dogfood pesado posterior, no el gate de este plan).
- El clon es completo (`git clone` normal, con historial): "con todo su
  código" lo pidió el usuario así.

## Key Decisions

- **D1 — Clon completo del público a carpeta nueva.** Recomendado porque el
  usuario quiere todo el código. Ojo verificado: el historial público está
  aplastado (~2 commits, sin historia de desarrollo), así que el valor del clon
  completo está en el código y los tags (como `3.15.1`), no en el blame.
  Rechazado: shallow/copia de archivos (se pierden incluso esos tags y la
  rama `main` como base).
- **D2 — La cáscara Electron se queda, el cerebro se reemplaza.** El desktop de
  ZCode (main/Vite empaquetado/e2e/instalador) es lo más caro de reconstruir y
  no tiene nada que ver con la tesis. Lo que se tira es su loop de agente
  ("el coder directo", justo lo que Auton existe para reemplazar) y se pone el
  orquestador de Auton. Rechazado: reescribir el desktop desde cero (meses por
  el mismo instalador) y también: mantener el agente de ZCode con "un prompt
  de Auton encima" (sería el parche que el usuario ya vetó: causa raíz, no
  parches).
- **D3 — El cerebro entra como paquete nuevo `@auton/brain` (TS) dentro del
  monorepo**, portado del prototipo, hablando con el resto por el `rpc`
  existente donde calce. Rechazado: microservicio aparte (doble runtime,
  doble instalador) y copiar-pegar los `.ts` del prototipo sueltos (se pierde
  el grafo de dependencias de pnpm y el typecheck unificado).
- **D4 — Programmers = backends ya probados.** grok CLI → opencode → builtin,
  con worktrees + scope leases + reportes sintetizados. Si ZCode trae
  aislamiento de subagentes superior (worktrees/fencing), se adopta tras
  comparar en F1; si no, se porta lo del prototipo. Nada se decide sin leer el
  código del clon.
- **D5 — UI del renderer reescrita al estilo Auton** (chat orquestador +
  tarjetas de tools concatenadas + tablero + panel por programmer + toggle de
  thinking), reutilizando el kit `ui` de ZCode solo como componentes
  primitivos. La UI web del prototipo (React 19) es la maqueta funcional.
- **D6 — Gates duros por fase.** Ninguna fase empieza con la anterior en rojo.
  El gate final es el snake cronometrado desde la app instalada, no desde dev.

## Recommended Approach

Clonar completo, ramificar, inventariar qué vive y qué muere, portar el cerebro
como paquete, enchufar programmers + disciplina (tester/evidencia/wake),
reescribir el renderer alrededor del tablero, y cerrar con instalador + snake
cronometrado. En ese orden; cada fase entrega algo que se puede abrir y probar.

## Work Plan

### F0 — Carpeta + clon + rama (lo ejecuta el humano: el agente no puede
escribir fuera de su home ni correr shell aquí)

1. En pwsh normal (no sandbox):
   `mkdir "C:\Nueva-carpeta\auton-desktop-muse"; cd "C:\Nueva-carpeta\auton-desktop-muse"; git clone https://github.com/zai-org/ZCode .`
2. `git checkout -b auton-desktop; git log --oneline -3` (debe mostrar el mismo
   `main` que `zcode-ref`, v3.15.1 o posterior).
3. `pnpm install` (versión de pnpm: la que pida `packageManager` del repo).
4. Mover a la raíz del clon: este plan, `docs/VISION-AUTON.md` (desde
   `Desktop/AUTON-VISION.md`) y `APORTES-HACKATON-META.md` (desde
   `auton-consolidacion/`).
5. Gate F0: `git status` limpio + `pnpm --filter @zcode/desktop exec tsc --noEmit -p tsconfig.host.json` sin errores nuevos vs `zcode-ref`.

### F1 — Inventario: qué vive, qué muere (solo lectura + notas)

1. Mapa por paquete: `desktop` (vive: shell/build/bundle/e2e), `rpc/shared/ui`
   (viven como infra), `provider/provider-node` (candidato a vivir: ¿qué
   endpoints/modelos exponen? ¿hay quota/rotación?), `services/server/client`
   (auditar: ¿dónde vive el loop del agente? eso muere), `web` (muere como
   producto; sus pantallas útiles se rescatan como referencia), `apps/zcode-cli`
   (vive como herramienta dev, no como producto).
2. Cazar lo adoptable de ZCode: aislamiento de subagentes (worktrees/scopes),
   admisión por proveedor+modelo, abort registry + watchdog, edición atómica
   con reintento EPERM/EBUSY, persistencia de sesiones, e2e de ciclo de sesión.
   Cada hallazgo se anota con ruta:línea exacta.
3. Lista de muerte explícita: archivos del loop agente-a-usuario directo,
   pantallas que asumen "el coder eres tú", telemetría que no aporte al gate.
4. Gate F1: documento `INVENTARIO.md` en el clon con vive/muere/adoptar por
   paquete, sin haber borrado ni una línea.

### F2 — El cerebro como paquete `@auton/brain`

1. Crear `packages/auton-brain` con: `prompt.ts` (el de 9.454 chars, tal cual),
   loop de turnos (hop cap 12, agrupación de tools, narración antes/después de
   cada tarjeta), registro de las 39 tools (arrancar/dirigir/verificar/cerrar/
   deshacer), tipos `Goal/Sprint/Board/Lease/Instance` y store atómico en disco
   por proyecto (`.auton-desktop/`).
2. Exponerlo por el `rpc` existente: `brain.status`, `orch.text`,
   `orch.thinking`, `goal.update`, `board.update`, `session.*` (los eventos que
   ya emite el prototipo; si el rpc trae otros nombres, se mapea, no se duplica).
3. Regla de oro portada: sin `failed` mudos en ningún estado (done / blocked
   con motivo). `blocked` entra al union de status del desktop desde el día 1.
4. Gate F2: `pnpm --filter @auton/brain typecheck` + test unitario del loop con
   un modelo fake: un goal de 1 archivo produce `set_goal → decompose →
   dispatch` en ese orden, sin lecturas previas.

### F3 — Programmers que no mueren

1. Portar `agent/run.ts`: cadena grok CLI → opencode → builtin, brief corto
   (no dump del chat), scope por archivos, REPORTE sintetizado al agotar turnos
   (`DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED`), reintento único
   ante error del modelo, `audit.tail()` como fuente del reporte.
2. Aislamiento: worktree por programmer (rama `auton/<id>`) o workspace
   compartido + scope leases si el repo no es git; scopes solapados se
   rechazan. Adoptar lo de ZCode si F1 lo encontró mejor; si no, portar.
3. Concurrencia: default 1, 2-4 solo en frentes sin archivos compartidos;
   `set_parallel` según el trabajo; reviewer siempre en serie con `dependsOn`.
4. Gate F3: test con coder fake que agota turnos y otro que lanza excepción:
   ambos cierran `done`/`blocked` con reporte, cero `failed`; scopes solapados
   rechazados en test.

### F4 — La disciplina (tester, evidencia, wake, proveedores)

1. Ciclo por sprint: work → `spec-review` (mismo worktree, contra DoD) →
   `quality-review` → corrección con el mismo implementador si hay PROBLEMAS.
   `run_check` obligatorio en el worktree antes de `close_goal`.
2. Evidencia por sprint cerrado: qué comando corrió, qué archivos, con qué
   resultado. Sin evidencia no hay `done`.
3. Wake: al cerrar un sprint con siguientes listos, el siguiente se despacha
   sin turno del humano; el humano solo aprueba dirección o es escalado
   (3 intentos quemados, `NEEDS_CONTEXT`, `BLOCKED`, o acción destructiva).
4. Proveedores: rotación con preferencia explícita (`beam-free` primero),
   cooldowns + backoff con jitter, y la regla ya ganada: **ningún cambio de
   modelo/proveedor en silencio**, aviso en el hilo activo. Keys solo en config
   privada.
5. Gate F4: suite que simula `429 Go usage limit exceeded` a mitad de turno:
   el turno falla con aviso visible y sin cambiar el modelo configurado.

### F5 — Renderer Auton sobre la cáscara Electron

1. Layout: columna orquestador (chat + thinking colapsable + tarjetas de tools
   concatenadas en orden narrativo) + tablero (sprints con reloj y estados) +
   rail de programmers (uno por chat, cada chat independiente con los suyos).
2. Composer limpio: sin pills muertos; toggle de thinking (orquestador y por
   programmer, con tool para que el orquestador lo cambie); botón Detener que
   corta el turno en curso sin matar tablero ni flota.
3. Preguntas al humano solo cuando decide de verdad (destructivo, ambigüedad
   real, plan agotado); si no, default sensato y sigue.
4. Reutilizar primitivos del kit `ui` de ZCode; nada de la estética actual si
   pelea con el tema oscuro gris + verde pastel del prototipo.
5. Gate F5: recorrido manual en dev (chat nuevo → snake → tarjetas en orden →
   detener a mitad → reanudar) más captura de las tarjetas de pregunta
   rediseñadas (las livianas: punto verde + filas con filete, sin cajas
   anidadas).

### F6 — Corte, limpieza y empaquetado

1. Borrar lo de la lista de muerte de F1 (ya validado por fases que nada lo
   importa), quitar deps huérfanas del lockfile, `oxfmt` + `oxlint` del repo.
2. `pnpm typecheck` completo del repo y `vitest run` unitario en verde;
   e2e de escritorio al menos en `conversation-session-verified`.
3. `bundle` + instalador NSH smoke en Windows (`test:installer-nsh-smoke`).
4. Gate F6: instalador que abre la ventana sin consola dev y sin credenciales
   dentro del paquete (auditar bundle: buscar `sk-`, `oc_sk_`, `xai-`).

### F7 — Dogfood y cierre hackatón

1. Snake cronometrado desde la app instalada: primera tool <10s, plan <15s,
   primer archivo <25s, tablero completo <90s, cero `failed`.
2. Demo de 2 minutos lista: el número, el orden de 5 tarjetas, el tablero.
3. Registrar en el clon `EVIDENCIA-SNAKE.md` con tiempos, tokens y llamadas.
4. Gate F7 (y del plan): los 5 Success Criteria en verde.

## Validation Plan

- Por fase: el comando exacto está en cada gate (typecheck por paquete,
  vitest con fakes de modelo/coder, simulación de 429, recorrido manual,
  instalador smoke). Ningún gate se salta "porque es UI": lo no automatizable
  se verifica manual con checklist y captura.
- Validación cruzada final: los gates F2–F4 se re-corren contra el binario
  instalado (no solo dev), porque el empaquetado Electron es donde suelen
  romperse rutas, PTY y variables de entorno.
- Evidencia: cada gate deja artefacto en el repo (log, captura o md). Un gate
  sin artefacto no cuenta.
- Paso de mayor riesgo: **F5+F6** (renderer nuevo sobre main empaquetado +
  primer instalador). Si algo va a romper, es rutas de assets y el preload del
  rpc en producción. Mitigación: F5 se prueba en dev contra el binario del main
  ya empaquetado antes del instalador.

## Risks / Rollback

- **El clon público trae más de lo que se usa** (telemetría, CDN, cuentas):
  se audita en F1 y se corta en F6; lo sensible nunca entra al instalador.
  Rollback: `zcode-ref` intacto + rama `auton-desktop` permite `git reset`
  por fase.
- **Providers free inestables** (cuota semanal, 403 fuera del cliente
  oficial): el producto no depende de un solo modelo; la rotación + aviso
  visible ya existen y se portan en F4.
- **Divergencia con `main` de ZCode**: no se hace merge de vuelta; si un fix
  urgente de upstream hace falta, se cherry-pickea puntual. Se documenta en
  `UPSTREAM.md`.
- **Scope creep (Lunar Móvil)**: explícitamente fuera del gate; entra como
  dogfood después de F7.
- Rollback global: borrar `auton-desktop-muse` no pierde nada (el origen
  público + `zcode-ref` + el prototipo siguen existiendo).

## Open Questions

Ninguna bloqueante. Verificaciones diferidas a su fase (no son preguntas al
usuario): nombres exactos del rpc de sesiones en el clon (F2), qué aislamiento
de subagentes trae ZCode vs el port (F1/F3), y si `provider/` expone rotación
propia reutilizable (F1/F4). Defaults reversibles ya fijados en Key Decisions.

## Sources

- `https://github.com/zai-org/ZCode` — origen del clon. Verificado en local:
  `zcode-ref/.git/config` (`remote origin`, rama `main`) + checkout v3.15.1,
  y confirmado público por el usuario. Cobertura pública que lo corrobora:
  [ZCode Goes Open Source](https://medium.com/@georgehes/zcode-goes-open-source-what-changed-why-it-matters-and-how-it-stacks-up-against-claude-code-9a769421a0c2)
  (incluye Electron desktop app, web client, backend services, Agent CLI) y
  [reporte de historial aplastado](https://ai.dosa.dev/blog/open-source-coding-agents-chinese-ai-labs)
  (repo creado 2026-09-20 con dos commits: code drop sin historia de desarrollo).
- Resto de nombres (Electron, pnpm, Vite, tsup, wdio, NSH, Beam, Longcat):
  redeclaran hechos del workspace ya inspeccionados (`package.json` raíz y de
  `packages/desktop`, `apps/zcode-cli`, y el prototipo `auton cat jam zcode`).
