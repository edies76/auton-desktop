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

## 2026-11-03 — poda pequeña de conversation share

Qué: se retiraron los paquetes `packages/web-share` y `packages/share-ui`, el script
`scripts/dev-web-share-env.mjs` y el doc `docs/conversation-share-v1.md`. También se quitó el caso
de test que dependía del script retirado y los scripts raíz `dev:web-share:*` / `build:web-share`.
Por qué: compartir un chat no es parte del MVP; era la superficie de publicación pública de share.
Verificado con: 0 importaciones de `@zcode/web-share`/`@zcode/share-ui` desde el código que se
queda; lockfile actualizado; `git diff --check` limpio. No se tocó runtime del desktop ni UI.

## 2026-11-03 — poda pequeña de stream-animate

Qué: se retiró `packages/stream-animate`, paquete experimental independiente de animación, y sus
referencias de build/bootstrap, política de arquitectura, `.gitignore` e inventario.
Por qué: no es runtime del desktop ni infra de Auton; era una superficie de demo aislada.
Verificado con: 0 imports de `@zcode/stream-animate`; `node --check` del bootstrap; lockfile
actualizado; `git diff --check` limpio. No se tocó UI ni runtime.

## 2026-11-03 — poda media-pequeña de dev-docs

Qué: se retiró `apps/dev-docs` (visor interno del mapa de capacidades y del grafo de features),
sus docs `docs/product-capability-map*`, `docs/zcode-stdio-tap-proxy.md` y los scripts raíz
`dev:docs`/`build:docs`. También se quitó `apps/dev-docs` del workspace/typecheck y `elkjs` de la
revisión de licencias.
Por qué: es herramienta de desarrollo del upstream, no runtime ni UI de Auton.
Verificado con: `pnpm typecheck` completo; lockfile actualizado; `git diff --check` limpio.
No se tocó UI ni runtime del desktop.

## 2026-11-03 — poda de zcode-server-cli

Qué: se retiró `packages/zcode-server-cli` (CLI y daemon de servidor remoto) y sus referencias de
typecheck, vitest, política de arquitectura y scripts raíz `prepare:remote-assets*`. El bootstrap
`--with-remote` deja de invocar el staging de server-cli.
Por qué: el servidor remoto/standalone está fuera del MVP; el desktop no depende del paquete.
Verificado con: `pnpm typecheck` completo; lockfile actualizado; `git diff --check` limpio.
No se tocó UI ni runtime del desktop.

## 2026-11-03 — primera mitad de la poda media de UI y módulos

Qué: se ocultaron Automations y Plugin Marketplace del sidebar; se sacaron de Ajustes
Remote devices, Memory, Usage/billing y Computer use; se quitó el plan/usage y Rewards del
menú de perfil; se apagaron la conexión remota y el web remote control; se ocultó el botón de
compartir conversación; y los providers de marketing/rewards dejaron de montarse. Las rutas de
Automations y Plugin Store ya no abren aunque otro punto emita la intención.
Por qué: es la Fase 1 de `docs/PODA-MVP.md`; reduce superficie visible y llamadas de red sin
borrar código que todavía no se pudo verificar con la app abierta.
Cómo: bandera única `AUTON_MVP` en `packages/ui/src/lib/autonMvp.ts`; el resto son guards y
listas de secciones ocultas.
Verificado con: `pnpm typecheck` completo; pruebas de `settingsNavigation`, `settingsPageConfig`,
`workspaceHeaderActionSection`, `workspaceSidebarWebRemoteMobileLayout` y
`projectSidebarNavigation` ajustadas y en verde. No se tocó el motor de edición, sesiones,
proveedores, navegador interno, plan ni el trabajo de A.
Pendiente: la app sigue sin abrir por el error de versión `0.0`; la segunda mitad (defaults de
módulos pesados, telemetría, off-peak y borrado real) queda para la siguiente orden.
