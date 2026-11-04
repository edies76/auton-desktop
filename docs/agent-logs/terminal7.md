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

## 2026-11-03 — segunda mitad de la poda media

Qué: se integró `origin/auton-desktop` (`7815c2a3`, con el chat único/vivo de Edi) en la rama de
poda. Se borró el módulo de Rewards de la UI completo (`RewardsProvider`, `RewardsWebview`), su
prueba unitaria, su E2E, el doc `docs/rewards-embedded.md` y las referencias de credenciales,
wdio y snapshot de arquitectura. Off-peak quedó apagado por defecto en el scheduler; cron sigue
vivo y se puede recuperar con `AUTON_OFF_PEAK=1`.
Por qué: cierra la segunda mitad sin tocar el motor ni el trabajo de A. Rewards era una superficie
aislada; off-peak no aporta a la demo. La telemetría ya estaba apagada por defecto sin
`config/private/build-defaults.json`, y los defaults pesados (emuladores, CUA, ofimática) ya
estaban en `false`.
Verificado con: `pnpm typecheck` completo; pruebas de `desktopCronScheduler`,
`offPeakHostDispatch`, `marketingTouchProvider` y `e2eStartupCredentials` en verde.
No se tocó el motor de edición, sesiones, proveedores, navegador interno, plan ni el trabajo de A.
La app sigue sin abrir por el error de versión `0.0`; no se borraron rutas que dependan de
verificación visual.

## 2026-11-03 — poda final de UI muerta

Qué: se borró la UI de Bots completa (`BotsDialog`, tarjetas, `botsUi`) y su panel de canales
dentro del control remoto; también sus dos E2E de interfaz. Se borraron restos sin uso:
`ConversationShareLinkRow`, helpers de plan manual, `officeSuggestedPrompts`,
`V4ComposerCuaEntry`, la paridad E2E de telemetría y utilidades de conexión remota.
Por qué: Bots era la última superficie grande que el plan marcaba como muerta y todavía tenía
UI compilada. Los demás archivos ya no tenían importadores; quitarlos reduce ruido sin tocar
el motor.
Cómo: se eliminó el panel de Bots del diálogo remoto y se ajustaron sus pruebas; se limpiaron
mocks y el snapshot de arquitectura.
Verificado con: `pnpm typecheck`, 7 archivos de pruebas de UI/remoto (75 en verde) y
`pnpm test:architecture` (36 en verde).
No se tocó el chat único/vivo, el espacio de proyecto, el motor de edición, sesiones,
proveedores, navegador interno, terminal ni el trabajo de A.

## 2026-11-03 — poda mediana de marketing

Qué: se borró la capa visible de marketing: provider, banner, popups, controlador, poller,
recursos, navegación de campañas y contrato del módulo. También sus pruebas UI y los tres
E2E de marketing más el caso de manual review.
Por qué: marketing no sostiene la promesa de Auton (dirigir trabajo y ver evidencia) y era
la última superficie de UI grande fuera del producto. Se dejó el servicio de backend y el
mock de coding plan para no romper pruebas de planes.
Cómo: se simplificaron `Root`, `App`, `SettingsPage`, `ModelProviderSection`,
`PluginStorePage` y `SidebarBottomActivity`; se limpió la política y el snapshot de
arquitectura.
Verificado con: `pnpm typecheck`, pruebas de sidebar/root/credenciales/mock de plan y
`pnpm test:architecture` (36 en verde).
No se tocó el chat único/vivo, el espacio de proyecto, el motor de edición, sesiones,
proveedores, navegador interno, terminal ni el trabajo de A.
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

## 2026-11-04 — tablero de sprints e inspector de evidencia (etapa 3 de A)

Qué: entrada Plan en el espacio del proyecto, tablero que lee `.auton/plan.json`
en vivo con siete columnas por estado, e inspector de evidencia por sprint con
aviso cuando un sprint terminado no tiene evidencia. Diseño minimalista casi
monocromo con los tokens de la app.
Por qué: el registro durable ya existía, pero el humano no tenía pantalla para
ver el plan ni la prueba de que un sprint cerró; solo el orquestador lo leía.
Verificado con: constructores separados para tablero e inspector, verificador
independiente con tests propios (PASS), 57 tests de UI y 58 del registro en el
árbol mergeado, `oxlint` sin hallazgos. Merge a `auton-desktop` en 98666a2d.
Pendiente: la prueba visual en la app real, bloqueada aquí por el entorno
(Node 22 sin pnpm ni herramientas nativas).

## 2026-11-04 — arranque dev y entrada al tablero (0.16.1)

Qué: fix del arranque en dev (el main fija `app.setVersion(ZCODE_VERSION)`
antes de cargar `electron-updater`, que rechazaba la versión `0.0` y moría
sin ventana), espacio Auton sin sesión para proyectos sin hilo, y botón
Plan en el panel de workers del shell que conmuta al tablero en el sidebar.
Por qué: la prueba visual destapó que el tablero existía pero no era
alcanzable: sin sesión la lista saltaba al shell de ZCode y el panel
embebido no recibía `onOpenPlan`.
Verificado con: 5 tests del bootstrap del desktop, 18 tests de UI
(lista y sidebar), `tsc` de UI y del desktop, `oxlint` y
`architecture:check` en verde; por CDP en la app real, proyecto-prueba
sin sesiones abre el tablero (Total 4, Activos 1, Bloqueados 1,
Terminados 2), s1 muestra su evidencia, s4 se marca no demostrado,
s3 muestra su pregunta, y editar `plan.json` mueve s2 a Terminados sin
recargar. Merge a `auton-desktop` en 9462caee.
Pendiente: elegir modelo en el entorno dev para probar el hilo del
orquestador, y un panel ancho para el tablero dentro del shell.
