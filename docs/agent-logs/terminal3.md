# terminal3 — grok-build (Grok)

Tema: gobierno de límites y documentación pública/privada.
Inicio: 2026-11-02.

## 2026-11-02 — los límites gobiernan el despacho

Qué: `evaluateAttempt`, `evaluateApproval` y `evaluateDispatch` en `contracts/src/auton/limits.ts`; el
handler del plan cuenta intentos, rechaza cambios sin versión ni historial, exige pregunta en
`not_evaluable` y registra reportes de calibración de los workers.
Por qué: los límites estaban declarados en el esquema y no gobernaban nada; el fallo silencioso seguía
siendo que nadie mira.
Verificado con: `auton-limits-governance.test.ts` (14), `auton-plan-tool.test.ts` (6) y
`auton-limits-guard.test.ts` (3); typecheck de contracts y core.

## 2026-11-02 — control del despacho: thinking_level hasta la identidad del worker

Qué: `thinking_level` en la tool Agent viaja por `SubagentPort` y `ExploreSubagentRuntimeRequest` hasta
el prompt de identidad de `auton-worker`; la doctrina fija brief, scope, effort y thinking_level al
despachar. Rama `feat/edi/limites`, commit `cfff5f4a`.
Por qué: esfuerzo y thinking son cosas distintas — el esfuerzo limita el alcance, el thinking fija lo
fuerte que razona antes de actuar.
Verificado con: `canal-tests.log` (59 en 9 archivos), `limits-tests.log` (10),
`ui-channel-tests.log` (7), `typecheck.log` y `ui-typecheck.log` en cero, lint limpio. Los trabajos
paralelos fuera del alcance (live-loop en el runner, ZCode base, docs ajenas) se revirtieron o se
dejaron fuera de este commit.

## 2026-11-02 — documentación en dos árboles

Qué: `docs/public/` (producto), `docs/private/` (implementación), y `site/build.mjs` genera `site/dist`
y `site/private-dist` por separado. Regla escrita en `AGENTS.md`.
Por qué: la pública da confianza sin revelar implementación; la privada permite continuar sin preguntar.
Verificado con: build de ambos árboles, navegación real en Chrome y capturas a 1366 y 390 px.
