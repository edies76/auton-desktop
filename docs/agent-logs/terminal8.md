# terminal8 — Jarvis Ken (OpenCode)

Tema: espejos de tool-contracts (Compañero B).
Inicio: 2026-11-04.

## 2026-11-04 — espejos sincronizados en la punta

Qué: `AutonRecall` en el orden esperado + párrafo `requires_answer` en el espejo de SendMessage (rama `feat/b/espejos`, 2 commits). Queda 1 rojo: el `anyOf` de recall, intencional según `recall.ts:97-101`; decide Edi (allowlist, reestructurar schema o relajar regla).
Por qué: la suite de contratos es el canario; 2 espejos estaban stale tras `2a5c53da` y `07219f97`.
Verificado con: `vitest run tests/tool-contracts.test.ts` (39/40, solo anyOf); lint 0 errors; arch 0 violations.

— Jarvis Ken · terminal8 · espejos

## 2026-11-04 — anyOf resuelto con allowlist documentada

Qué: `PROVIDER_INTERNAL_KEY_ALLOWLIST = { AutonRecall: ["anyOf"] }` + test pin que garantiza que no traga otros keys/tools. Suite 41/41. Decisión tomada sin Edi por orden explícita: no tocar el schema (su test de aceptación lo exige), no relajar la regla global.
Por qué: el canario quedaba en rojo por un diseño intencional, no por un bug; bloquear el merge por eso era peor que documentar la excepción reversible en una línea.
Verificado con: `vitest run tests/tool-contracts.test.ts` (41/41); vecinos + recall acceptance en verde; lint/typecheck/arch limpios.

— Jarvis Ken · terminal8 · anyof

## 2026-11-04 — Botón Meta con login API key

Qué: opción Meta en el login usando el template builtin `auton-meta` existente (baseUrl https://api.meta.ai/v1, modelos Muse). Sin OAuth: Meta no tiene ese flujo aquí, su vía documentada es la API key. Sin tocar backend.
Por qué: el usuario pedía el botón de Meta y el template ya existía sin UI que lo expusiera.
Verificado con: `vitest run test/loginApiKeyForm*.test.ts` (10 passed); oxlint 0 errores; tsc sin errores nuevos (3 preexistentes ajenos).

— Jarvis Ken · terminal8 · meta-login

## 2026-11-04 — Merge final Meta a auton-desktop

Qué: `fix/meta-login` integrado en `auton-desktop` (ff sobre `ab510f93`, 4 commits: helpers + UI + i18n + constancia). El allowlist del `anyOf` ya venía en el remoto (`b0666271`), sin cambios: suite 41/41 en fresco.
Por qué: cerrar el botón Meta pedido, sin reescribir schema ni relajar la regla global.
Verificado con: login 10/10 + contratos 41/41 en fresco tras el merge; oxlint 0; tsc 0 nuevos; arch 0 violations.

— Jarvis Ken · terminal8 · meta-merge
