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

## 2026-11-04 — tablero desplegable desde el sidebar

Qué: al pulsar Plan, el tablero se despliega desde el borde derecho del
sidebar como panel animado (portal con transición de ancho hasta
1480px) y Hilo lo repliega; el hilo del centro no se mueve. Se trajo el
trabajo de B desde origin (relojes, cierre honesto, espejos y su fix de
arranque por manifest, que convive con el bootstrap de versión) y el
manifest del desktop quedó en 0.16.1 como VERSION.
Por qué: a 264px el tablero quedaba cortado; el humano pidió que se
deslizara hasta verse bien sin perder el hilo de vista.
Verificado con: 10 tests de autonWorkersSidebar, oxlint y
architecture:check en verde; por CDP el panel crece a 1480px con
columnas e inspector visibles y se repliega al cerrar.
Pendiente: probar el hilo del orquestador con modelo (River ya quedó
configurado en el entorno dev local, fuera del repo).

## 2026-11-04 — tablero legible, workers de sesión en el sidebar y poda propuesta

Qué: las 7 columnas del tablero entran en una fila (minmax 180px), la línea
de dueño/esfuerzo ya no se corta, el detalle del objetivo empieza plegado y
el inspector va debajo. El sidebar de workers ahora lee también
`.auton/workers/index.json` (con el hook que ya usaba el espacio del
proyecto): los workers en modo sesión no producen filas de subagente y el
panel decía 0 con 15 workers reales en Feria. Propuesta de poda tanda 1 en
docs/private con los datos de la corrida (38 ofrecidas, 7 usadas).
Por qué: el humano no entendía el tablero ni por qué Workers decía 0; ambas
eran la misma deuda de lectura, no de motor.
Verificado con: 37 tests de UI (sidebar + tablero), 10 de proyección de
workers, `tsc` de UI, `oxlint` y `architecture:check` en verde; por CDP las
7 columnas quedan en una fila en el proyecto Feria real. La causa del
cuelgue al probar fue un mock con identidad nueva por render, no la app:
en producción los servicios salen de un contexto estable.
Pendiente: terminar Feria (parada manual del research y recall de cierre)
y ejecutar la tanda 1 de la poda cuando esa corrida cierre.

## 2026-11-04 — marca Auton y poda de precios (0.17.0)

Qué: la marca visible pasa a la A en círculo que ya existía como logo del
proveedor Auton (componente AutonLogo, asset auton-logo.svg e ícono de
escritorio generado en PNG/ICO; el .icns de mac queda pendiente por no
poder generarse en Linux). ZCode→Auton en los locales en/zh y en los
textos fijos visibles (ventana, bienvenida, diálogos del sistema).
Precios fuera: banners de compra, acción de suscripción y de mejora de
plan ocultos en ajustes de proveedores tras AUTON_MVP.
Por qué: el humano pidió que lo que se ve sea Auton y que no se vendan
planes de Z.ai dentro de Auton. El proveedor Z.ai conserva su nombre
donde es el servicio real (como OpenAI); sus ids internos no se tocaron.
Verificado con: tsc de UI, oxlint, 188 tests de coding plan (con la
bandera mockeada a false para no perder la cobertura del upstream),
57 de ajustes/composer/arranque y 125 de chat/permisos/skills.
Pendiente: el archivo de logo que el humano quiere usar (llegó una
captura, no el archivo), el .icns, y las entradas de compra secundarias
(banner de error de cuota y composer) que aún pueden abrir el diálogo.

## 2026-11-04 — columnas plegables del tablero (0.18.0)

Qué: cada columna del tablero de sprints tiene su propio botón expandir/
reducir a la derecha del contador; arranca reducida y se despliega con
deslizamiento (grid-rows 0fr→1fr, 500ms, mismo patrón que
ModelEditorAdvanced). Primero se hizo un botón global arriba y el humano
corrigió: era por columna, y el global se quitó.
Por qué: una columna larga (Terminados con 15) alargaba todo el tablero;
ahora se abre solo la columna que se quiere ver.
Verificado con: 38 tests del tablero (incluido uno nuevo de despliegue
por columna), tsc y oxlint, y en la app real por CDP con clic de mouse:
Terminados pasó de 0 a 2120px con altura intermedia en plena animación,
sin mover las demás columnas.

## 2026-11-04 — umbral de columnas, sin plan Z.ai, sin login, sin Z (0.18.1)

Qué: columnas con 5 o menos quedan expandidas y al pasar de 5 se recogen
solas; todo el encabezado es el botón. Fuera la tarjeta de plan de
Z.ai/BigModel del detalle de proveedor (queda la configuración por API
key) y fuera el login forzado al arrancar: se entra directo. El splash
de escritorio y web, About y los logos heredados dibujan la A de Auton.
En el núcleo, el puerto de workers de sesión ahora entrega el modelo
activo y el override del despacho a la fábrica, con la precedencia de
un subagente; antes los descartaba.
Por qué: el humano pidió tablero corto sin cazar la flechita, que el
plan de Z.ai no exista en la app, entrar sin loguearse con ZCode, y que
el worker corra sí o sí con lo seleccionado en el orquestador. En Feria
los 15 workers ya usaban el modelo del orquestador; el hueco era el
override explícito, que ningún worker de sesión recibía.
Verificado con: 39 tests del tablero, 227 de UI (plan del proveedor,
compuerta de arranque, login), 29 del núcleo (puerto y selección), tsc
de UI y del núcleo, y en la app real: splash con la A, detalle de Z.ai
sin tarjetas de plan y columnas con el umbral correcto. Los dos errores
de tsc de desktop (arms y setVersion) existen igual en el árbol limpio.
