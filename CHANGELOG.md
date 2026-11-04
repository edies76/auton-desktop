# Changelog

Todo lo relevante de Auton Desktop. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado
[SemVer](https://semver.org/lang/es/) mientras no haya releases p├║blicas.

## [0.17.0] — 2026-11-04

La app se presenta como Auton: marca, nombre y sin tienda de planes.

### Cambiado

- **Marca Auton**: el logo pasa a ser la A en círculo (arranque, título,
  bienvenida, onboarding y pantalla vacía) y el ícono de la app se genera
  con la misma marca. Los textos visibles que decían ZCode ahora dicen
  Auton: bienvenida, inicio de sesión, título de ventana, diálogos del
  sistema y mensajes de arranque.
- **Poda de precios**: en los ajustes de proveedores ya no se muestran los
  banners de compra con precios, ni la acción de suscripción, ni la de
  mejora de plan de Z.ai/BigModel. Conectar un proveedor y ver su uso sigue
  igual; lo que desaparece es la venta, detrás de la misma bandera de poda
  de siempre.

## [0.16.2] — 2026-11-04

El tablero se lee de un vistazo y el panel de workers cuenta la verdad.

### Corregido

- **Tablero legible**: las siete columnas entran en una fila, los datos de
  cada tarjeta ya no se cortan con puntos suspensivos, el detalle del
  objetivo empieza plegado y el inspector de evidencia va debajo, a lo ancho.
- **Workers que no aparecían**: el panel del sidebar solo leía los subagentes
  de la conversación, así que un worker en modo sesión (el modo por defecto)
  no salía nunca y el contador decía 0 con trabajo en curso. Ahora el panel
  también lee el índice durable de workers del proyecto, la misma fuente que
  ya usaba el espacio del proyecto.

## [0.16.1] — 2026-11-04

El tablero ya se alcanza: con sesión, sin sesión y desde el hilo.

### Corregido

- **Arranque en desarrollo**: `mise run dev` moría sin abrir ventana
  (`electron-updater` rechazaba la versión `0.0` del entorno dev). El main
  ahora fija la versión de la app al inicio, la misma que lleva el paquete.

### Cambiado

- **Proyectos sin sesiones**: abrir un proyecto sin hilo ya no salta al shell
  de ZCode; entra al espacio de Auton y el Plan lee `.auton/plan.json`.
- **Plan en el shell**: el panel de workers del hilo muestra el botón Plan y
  despliega el tablero desde el borde del sidebar con una animación de
  ancho, sin salir de la conversación; Hilo lo repliega.

## [0.16.0] — 2026-11-04

El plan del proyecto se ve como tablero, con su evidencia al lado.

### Añadido

- **Tablero de sprints**: entrada Plan en el espacio del proyecto; lee
  `.auton/plan.json` en vivo y agrupa los sprints en siete columnas por estado
  (pendientes, activos, esperando, bloqueados, no evaluables, terminados y
  descartados), con el objetivo y el resumen arriba.
- **Inspector de evidencia**: al elegir un sprint muestra su requisito, los
  archivos declarados, la evidencia declarada, los intentos y las preguntas
  abiertas. Un sprint terminado sin evidencia se marca como no demostrado.
- Diseño minimalista casi monocromo, con los tokens y componentes de la app.

## [0.15.0] ÔÇö 2026-11-04

Un loop colapsable por worker.

### Cambiado

- Cada despacho de `Agent` abre su propio bloque de loop con su contador; dos
  workers en el mismo turno se ven como dos bloques intercalados con la
  narraci├│n, no como uno solo.

# Changelog

Todo lo relevante de Auton Desktop. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado
[SemVer](https://semver.org/lang/es/) mientras no haya releases p├║blicas.

## [0.14.0] ÔÇö 2026-11-04

La memoria del proyecto deja de depender del hilo: lo que pas├│ queda escrito y se puede consultar.

### A├▒adido

- **Registro durable**: cada cambio del plan (objetivo, piezas, l├¡mites y reportes) y cada
  reversi├│n se anota como un evento con identificador, fecha, fuente y referencias. El
  registro es append-only y repetir la misma acci├│n no duplica la historia.
- **Memoria consultable**: `AutonRecall` busca en el registro por texto, identificador,
  referencia o tipo y devuelve como m├íximo cinco l├¡neas con su fuente. Si no hay memoria,
  lo dice.
- **├ìndice persistente**: una cach├® derivada del registro acelera la consulta. Si el
  registro cambia, el ├¡ndice se descarta y se reconstruye; el registro sigue siendo la
  fuente de verdad.

### Seguridad

- El registro redacta credenciales y limita el tama├▒o de t├¡tulos, res├║menes y listas.
- Nunca guarda el contenido anterior o posterior de un archivo: anota ruta, tama├▒o y
  huella, no el texto del cambio.

## [0.13.0] ÔÇö 2026-11-03

El turno cierra para dejar escribir; el loop sigue vivo y se parte en varios.

### Cambiado

- **El turno termina aunque queden workers**: el compositor queda libre y el
  humano puede enviar otro mensaje sin inyectarlo. El evento del worker abre un
  turno nuevo por la cola de comandos.
- **El loop sigue abierto con su contador** mientras haya un worker o una tool
  corriendo, aunque el turno haya cerrado.
- **Varios loops colapsables intercalados**: cada narraci├│n despu├®s de un grupo
  de tools abre un bloque nuevo, en vez de un ├║nico bloque por turno.

### A├▒adido

- **Worker de ZCode por defecto**: `Agent` con `subagent_type: "auton-worker"`;
  otro tipo solo si el humano lo pide. Se proh├¡be hacer la lectura con
  Bash/Terminal.
- **Profundidad ajustable**: velocidad pide `effort: "minimal"` y
  `thinking_level: "low"`; entender a fondo pide `thorough` y `high`.
- **Tono copiloto**: cuenta lo que ve, celebra el avance y propone el siguiente
  paso.

### Conocido

- El picker de proyectos vac├¡os sigue volviendo al proyecto anterior (UI de
  proyectos de otra sesi├│n).
- El estilo Grok (mensajes separados, menos botones) y los l├¡mites de los
  workers quedan pendientes.

## [0.12.1] ÔÇö 2026-11-03

La cr├│nica intercalada tambi├®n cubre los turnos que usan tools directas.

### Cambiado

- Un turno se reconoce como Auton por sus canales `auton-worker` **o por la firma
  `ÔÇö Auton` del cierre**. As├¡, una lectura hecha con Terminal/Bash tambi├®n deja la
  narraci├│n y el reasoning fuera del loop, y el loop se abre/colapsa igual.
- Los turnos de ZCode sin firma conservan su layout.

## [0.12.0] ÔÇö 2026-11-03

El loop del orquestador: se abre con su contador mientras trabaja y se colapsa al
terminar; lo que habla contigo queda fuera.

### A├▒adido

- **Loop colapsable**: el bloque de trabajo se abre mientras corre y se colapsa
  al terminar. El header y el contador se anclan al trabajo, no al primer texto.
- **Reasoning por contexto**: el de planificaci├│n, decisi├│n y traducci├│n se pinta
  fuera del loop; el atado a la ejecuci├│n se queda dentro.
- **Turno reanudado por evento**: apertura que nombra el evento fuera, trabajo en
  el loop con su contador y traducci├│n fuera.
- **Prompt**: anuncia el dispatch antes de mandar, pregunta al humano mientras
  corre y traduce al volver.

### Cambiado

- El compositor de Auton ya no muestra **Computer Use**; el input y el env├¡o
  siguen igual.

### Conocido

- `systemEvent`, `evidence` y `plan` siguen usando sus bloques actuales, sin
  mapeo propio en la secuencia.
- El estilo tipo Grok (mensajes separados, menos botones) queda para despu├®s.

## [0.11.0] ÔÇö 2026-11-03

La narraci├│n del orquestador se intercala con el trabajo.

### Cambiado

- En los turnos con canales `auton-worker`, **cada mensaje del orquestador se
  pinta en su posici├│n**, entre las tools y los canales; el texto final deja de
  dibujarse como una secci├│n aparte. Los turnos de ZCode conservan su layout.
- El turno Auton abre la cr├│nica por defecto; ZCode mantiene su colapso.

### Conocido

- El bloque colapsable por worker, el mapeo propio de `systemEvent`, `evidence` y
  `plan`, y el estilo tipo Grok siguen pendientes.

## [0.10.0] ÔÇö 2026-11-03

La cr├│nica del turno Auton se ve desde el principio y el orden es temporal.

### A├▒adido

- **Spec de layout completa** en `context/UI-CHAT-INTERCALADO.md`: siete tipos de
  entrada (narraci├│n, canal, evento, pregunta nativa, systemEvent, evidence y
  plan), orden por `rowId`, scroll solo si el humano est├í abajo y prueba de orden.
  `UI-ESPACIO-DEL-PROYECTO.md` 2.4-2.6 quedan como punteros a esa spec.

### Cambiado

- Los turnos con canales `auton-worker` abren la cr├│nica por defecto: el trabajo y
  la narraci├│n se ven sin pulsar "Worked for". Los turnos de ZCode conservan su
  regla de colapso.
- El orden de pantalla es siempre temporal por `rowId`; la prioridad solo encola y
  despierta al orquestador. Un latido anterior no se adelanta por prioridad.

### Conocido

- La lista plana de siete tipos y el bloque por worker siguen pendientes.
- El estilo tipo Grok (mensajes separados, menos botones) se deja para despu├®s.

## [0.9.0] ÔÇö 2026-11-03

El aviso del worker deja de ser una pregunta al humano y se pinta como una fila
de trabajo.

### A├▒adido

- **Propuesta de chat intercalado** en `context/UI-CHAT-INTERCALADO.md`: una sola
  secuencia con narraci├│n, canales y eventos en orden, sin bloque global de
  trabajo ni respuesta separada. Pendiente de aprobaci├│n.

### Cambiado

- **El worker no pregunta al humano**: su mensaje llega al orquestador como un
  evento del trabajo, sin bot├│n de responder. Si la decisi├│n es del humano, el
  orquestador usa la tool nativa de preguntas. La proyecci├│n marca el aviso y lo
  limpia cuando el orquestador responde.
- **Filas de evento sin p├¡ldora centrada**: mismo espaciado y tipograf├¡a que las
  filas de trabajo de ZCode; el tipo se distingue por el icono.
- **Terminolog├¡a**: "worker" en la interfaz, el prompt y la documentaci├│n p├║blica,
  en lugar de "programador".

### Conocido

- El layout sigue separando bloque de trabajo y respuesta; la cr├│nica intercalada
  est├í documentada y espera el visto bueno.

## [0.8.0] ÔÇö 2026-11-03

El hilo vuelve al estilo de ZCode y el orquestador toma la iniciativa.

### A├▒adido

- **Proactividad**: al abrir un proyecto saluda, dice qu├® worker de lectura
  mand├│, invita a contar la necesidad mientras tanto y ofrece dos o tres caminos
  con recomendaci├│n; si el proyecto ya est├í analizado, propone el siguiente paso.

### Cambiado

- Las filas despertadoras (pregunta, cierre y latido) dejan el ├ímbar y el verde y
  usan el lenguaje visual de ZCode: borde, fondo secundario y texto de la app. El
  tipo se distingue por el icono.
- La etiqueta `auton-worker` deja el color autom├ítico de la paleta de subagentes
  y se pinta en texto secundario; los dem├ís agentes conservan su color.

### Conocido

- El hilo sigue usando la agrupaci├│n de ZCode: bloque de trabajo colapsable y
  respuesta final. La cr├│nica intercalada (narraci├│n, canales y eventos en orden)
  est├í en la doctrina, no en el layout; es el siguiente cambio de UI.

## [0.7.0] ÔÇö 2026-11-03

El orquestador sabe de qu├® equipo es, con qu├® autonom├¡a decide y c├│mo habla.

### A├▒adido

- **Identidad de equipo**: es el ingeniero a cargo de un equipo real, con un
  humano que responde por el producto y workers que ejecutan; no un chatbot
  esperando instrucciones.
- **Autonom├¡a con validaci├│n**: el humano valida la direcci├│n (plan, alcance, lo
  que no entra y cambios de rumbo); dentro del plan aprobado el orquestador
  decide sin pedir permiso por cada paso; lo irreversible se pregunta siempre. Un
  plan nuevo es propuesta hasta el OK y no se presenta como aprobado.
- **Tono**: ingeniero senior, directo, en primera persona, frases cortas, sin
  relleno corporativo, con humor seco cuando encaja.
- **Cada delegaci├│n se narra**: qu├® manda a qui├®n y por qu├® antes de despachar, y
  qu├® volvi├│ despu├®s. No hay worker invisible.

### Conocido

- La aprobaci├│n del plan es conversacional: `AutonPlan` puede escribirlo antes
  del OK. El siguiente paso, si se quiere garant├¡a, es un estado `proposed` y que
  el despacho lo exija.
- Prueba 21 medida con modelo real: la versi├│n nueva presenta el plan como
  propuesta y no pide permiso por un cambio obvio; la anterior dudaba y no
  nombraba la aprobaci├│n.

## [0.6.0] ÔÇö 2026-11-03

El orquestador que sabe planear y conversar: cinco pasos, proporci├│n obligatoria
y un registro del proyecto que se llena sin modelo.

### A├▒adido

- **Los cinco pasos en el prompt**: entender la intenci├│n (con pregunta de
  producto y recomendaci├│n), proponer alternativas con ventajas y l├¡mites,
  conversar sobre producto, construir el plan con dependencias y "hecho cuando"
  observable, y mantenerlo vivo sin empezar de cero.
- **La proporci├│n**: un cambio de un bot├│n es un encargo; replantear el modo de
  estudio de una app merece conversaci├│n y plan profundo. Se justifica en una
  l├¡nea ("es un archivo, as├¡ que un encargo").
- **Compa├▒ero, no formulario**: pregunta una vez con recomendaci├│n, dice qu├® no
  entra, admite lo que no sabe y avisa antes de investigar.
- **Registro del proyecto**: escaneo determinista y sin modelo al crear el
  proyecto (stack, tama├▒o, archivos clave) guardado en `.auton/project.json`.
- **An├ílisis de solo lectura**: en la primera petici├│n real el orquestador avisa,
  manda un worker de lectura y guarda su resumen con rutas en
  `.auton/project-analysis.md`; la pr├│xima vez lo lee del registro.

### Cambiado

- El prompt del orquestador se ensambla con el registro del proyecto
  (`buildOrchestratorSection({ workingDirectory })`); una secci├│n que nadie
  incluye no llega al modelo.

### Conocido

- La escritura del an├ílisis depende del prompt; no hay enforcement en el runtime.
- La prueba 20 (el humano no rehace el plan) queda parcial: el corte se sostiene,
  el revisor pide precisar dos criterios.

## [0.5.0] ÔÇö 2026-11-03

El chat vivo: la conversaci├│n del orquestador se mantiene abierta mientras hay
trabajo y los eventos que lo despiertan se ven dentro del mismo hilo.

### A├▒adido

- **Turno que no se cierra con trabajo vivo**: al terminar de escribir, el turno
  del orquestador espera al ├║ltimo canal (30 minutos como m├íximo, abortable);
  nunca se queda colgado.
- **Latido de 90 segundos**: con trabajo en curso y sin noticias, aparece una
  fila centrada de estado; el reloj de la conversaci├│n la hace visible durante el
  silencio, no solo cuando llega otro evento.
- **Eventos despertadores centrados**: pregunta del programador (├ímbar, con
  Responder), cierre del canal (verde, con Abrir) y latido (neutro). Salen del
  mapeo real del hilo y se pintan dentro de la conversaci├│n normal, sin pantalla
  aparte.
- **Canales anidados con reloj**: cada programador muestra su estado y su tiempo
  mientras corre; al cerrar conserva su estado final y su reloj.
- **Canal r├ípido bidireccional**: lo que el programador publica llega al
  orquestador como evento del worker, no como mensaje del humano; la instrucci├│n
  del orquestador entra en el siguiente paso del worker sin reiniciar el encargo.
- **Modos de trabajo**: build, read, research, debug y refactor como eje aparte
  del esfuerzo, con criterio de hecho y su lugar en el prompt.

### Cambiado

- La pregunta pendiente se marca en la proyecci├│n cuando el orquestador env├¡a un
  `SendMessage` con `requires_answer`; la respuesta del programador, su cierre o
  un nuevo arranque la levantan.
- El latido se mide con la ├║ltima se├▒al de vida de la fila visible del worker.

### Eliminado

- `QuestionWakeBlock` y el paso de `onRespondToQuestion`: la pregunta sale del
  mismo mapeo que el cierre y el latido.

### Conocido

- La prueba 17 con modelo real (que el orquestador elija `AutonRevert` al pedir
  "deshaz el sprint 2") sigue bloqueada por falta de proveedor en este entorno.
- Preguntas con opciones y el caso "el humano escribe mientras pregunto" quedan
  fuera de esta etapa.

## [0.4.0] ÔÇö 2026-11-02

El primer cambio grande de interfaz: el espacio de trabajo de un proyecto.

### A├▒adido

- **Lista de proyectos**: ordenada por actividad, con nombre y ruta; crear exige
  las dos cosas y al entrar se puede volver a la lista.
- **El espacio del proyecto**: el hilo del orquestador como ├║nica conversaci├│n,
  con el panel izquierdo rehecho como lista de workers en vivo (estado, reloj,
  aviso de silencio y control de parada).
- **Detalle del worker**: su conversaci├│n y su actividad, en solo lectura.
- **Bloques anidados en el hilo**: trabajo, plan y evidencia.

## [0.3.0] ÔÇö 2026-11-02

Los l├¡mites dejan de ser texto en el prompt y pasan a gobernar el despacho. La
documentaci├│n se separa en un ├írbol p├║blico y otro privado.

### A├▒adido

- **Gobierno del despacho**: un item no arranca sin l├¡mites versionados, cada
  despacho consume un intento contado por el plan, y una aprobaci├│n pendiente
  detiene el trabajo sin gastar intento.
- **`not_evaluable` como estado de primera clase**: el sistema puede declarar que
  no sabe juzgar; exige la pregunta o la decisi├│n escrita y escala al humano.
- **Reportes de calibraci├│n**: un worker puede reportar que un l├¡mite est├í mal
  puesto; el orquestador lo registra y el worker sigue sin poder cambiarlo.
- **Documentaci├│n en dos niveles**: una gu├¡a de producto para cualquiera y una
  documentaci├│n interna con el detalle de implementaci├│n, con builds separados.

### Cambiado

- El handler del plan valida los cambios de l├¡mites: versi├│n nueva, historial
  append-only y una entrada por campo cambiado.
- La tarjeta del plan muestra intentos, aprobaciones, reportes y decisiones
  pendientes.

## [0.2.0] ÔÇö 2026-11-01

Segunda vuelta sobre la misma base: el panel de programadores se abre solo, el
plan se lee completo y el despacho vuelve a depender del prompt.

### A├▒adido

- **El panel de programadores se abre solo** la primera vez que arranca un
  programador en la sesi├│n, para que la flota est├® a la vista.
- **Tarjeta del plan m├ís rica**: enunciado del objetivo, restricciones, detalle de
  cada item y sus archivos, pruebas y preguntas abiertas.
- **Sitio p├║blico**: landing y `/docs` generados desde los markdown del repo y
  publicados en S3 (`auton-docs-027252078119`).
- **`docs/VERSIONADO.md`**, **`docs/SCORECARD.md`** y **`docs/PODA-MVP.md`**.

### Cambiado

- **El despacho en background vuelve a depender del prompt.** Se quita el forzado
  en c├│digo del handler `Agent`; la regla queda en la doctrina del orquestador.
- Los tres archivos de Auton se mueven a sus propios m├│dulos
  (`contracts/src/auton`, `core/src/auton`, `ui/src/auton`).

## [0.1.0] ÔÇö 2026-11-01

Primera versi├│n que se puede abrir, usar y ense├▒ar. Alpha privada de hackathon.

### A├▒adido

- **Orquestador con doctrina propia.** El agente principal se presenta como Auton
  y trabaja con el ciclo PLAN ┬À BUILD ┬À VERIFY ┬À LOOP ┬À EVIDENCE. Incluye reglas
  de despacho no bloqueante, verdad en disco y "no terminas el trabajo del
  programador".
- **Tool `AutonPlan`.** Lee y escribe `<proyecto>/.auton/plan.json` con objetivo,
  items, estado, esfuerzo, archivos, evidencia y preguntas abiertas.
- **Tarjeta del plan en el chat.** Render propio con badges de estado.
- **Programadores en background.** Un `auton-worker` corre siempre en background,
  aunque el modelo olvide pedirlo.
- **Pol├¡tica de esfuerzo por encargo.** `minimal | standard | thorough` en la
  primera l├¡nea del brief; el worker se construye con ese perfil.
- **Identidad de programador en la UI.** El worker se muestra como *Programador*
  y el panel lateral se llama *Programmers*, con filas al estilo del panel
  *New tab*.

### Cambiado

- **Datos separados de ZCode.** Sesiones, credenciales, ajustes y telemetr├¡a en
  `~/.auton`. Los proveedores se heredan una sola vez; el historial no.
- **Perfil de Electron propio.** `Auton Dev` en lugar de `ZCode Dev`: deja de
  compartir localStorage, cookies y el navegador embebido con el ZCode real.
- **Navegaci├│n m├ís simple.** Fuera Automations y Plugin Marketplace.

### Eliminado

- Plugin `restore-legacy-sessions` (importaba sesiones de ZCode).
- Plugins de ofim├ítica por defecto (`documents`, `pdf`, `presentations`,
  `spreadsheets`): cuatro hosts MCP menos, ~570 MB de RAM ahorrados.

### Corregido

- La configuraci├│n de la app se escrib├¡a en `~/.zcode/v2/setting.json` aunque los
  datos ya estuvieran separados.
- El primer arranque sin proveedores tras migrar el perfil.

### Conocido

- Un `auton-worker` no se reanuda solo tras cerrar la app; el plan s├¡ sobrevive.
- El panel de programadores no se abre autom├íticamente al despachar.
- El agente todav├¡a usa `~/.zcode/cli` para plugins, agentes y logs.
