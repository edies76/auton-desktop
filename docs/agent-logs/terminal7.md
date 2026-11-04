# terminal7 — A (DeepSeek V4.1 Flash)

Tema en curso: poda de documentación upstream de ZCode sin tocar el producto ni el trabajo de A.
Inicio: 2026-11-03

## 2026-11-03 — primera poda segura de docs

Qué: se borraron 227 documentos de `docs/` que son del upstream de ZCode y no sostienen Auton:
automatizaciones, bots, plugins/marketplace, coding plan/facturación, remoto/móvil, feedback,
marketing, whiteboard y planes/auditorías antiguas. Se conservaron `context/`, `docs/private`,
`docs/public`, `docs/agent-logs`, los docs de UI, chat, escritorio, arquitectura, git, pruebas,
proveedores y motor.
Por qué: es la parte de la poda que no exige abrir la app ni cambia runtime; reduce ruido y deja
el mapa de `docs/` alineado con lo que Auton sí usa.
Verificado con: `git diff --cached --check` limpio; 0 referencias a archivos borrados desde los
archivos que quedan; `git status` confirma que solo se tocó `docs/` (más este log).
Pendiente: la poda de UI y módulos (ocultar tienda, automatizaciones, facturación y remoto) queda
para cuando el entorno tenga Node 24 + pnpm y la app abra, como manda `context/PODA-DE-ZCODE.md`.

## 2026-11-03 — segunda poda segura de docs

Qué: se borraron 129 documentos más que ya no tenían ninguna referencia desde los archivos que se
quedan. Son restos de CUA, remoto/móvil, coding plan/facturación, plugins/marketplace, feedback,
WSL/SSH, telemetría interna y planes históricos de `docs/superpowers`. También se quitaron docs
sueltos de stats, onboarding externo y herramientas internas.
Por qué: siguen el mismo criterio de la primera tanda: documentación upstream que no sostiene Auton
y que ya no es enlazada por código ni por los docs que conservamos.
Verificado con: lista construida por referencias reales; 0 referencias desde archivos conservados;
`git diff --cached --check` limpio; solo se tocó `docs/` (más este log).
Pendiente: la poda de UI y módulos sigue bloqueada por Node 24 + pnpm + apertura real de la app.
No se borró código en esta tanda.

## 2026-11-03 — poda pequeña de código no conectado

Qué: se borró `packages/android` (44 archivos), la app Android de control remoto. Es un proyecto
Gradle independiente, no pertenece al workspace pnpm ni lo referencia el desktop.
Por qué: remoto/móvil está fuera del MVP; no es UI compartida, ni motor, ni sesiones/protocolo.
Verificado con: 0 referencias a `packages/android` desde código/configuración que se queda;
`git diff --cached --check` limpio; solo se tocó `packages/android` y este log.
No se tocó runtime del desktop ni se borró código de la app.

## 2026-11-04 — registro durable de Auton (niveles 0 a 1C)

Qué: se construyó la memoria durable del proyecto en cuatro capas verificadas por separado: lector
de plan/diario/reversiones; contrato de evento y almacén append-only con redacción, topes e
idempotencia; fusión con el registro y tool `AutonRecall`; e índice persistente con hooks de plan y
reversión. También se añadieron las líneas de prompt que hacen que el orquestador sepa que el
registro existe y cuándo consultarlo.
Por qué: el contexto del bucle no puede depender del hilo; lo que pasó tiene que quedar en disco,
con identificador y referencias, para responder sin inventar y sin filtrar contenido de archivos.
Verificado con: 128 tests en las 14 suites afectadas (registro, recall, índice, hooks, plan, límites,
reversión y cuatro piezas), `typecheck` limpio y `oxlint` sin hallazgos en los archivos de la unidad.
Cada nivel tuvo constructor y verificador independiente en worktrees separados; los tres veredictos
fueron PASS.
Pendiente: merge a `auton-desktop` tras revisión final; la verificación visual del desktop sigue
bloqueada por el entorno nativo.
