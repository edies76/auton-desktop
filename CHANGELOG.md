# Changelog

Todo lo relevante de Auton Desktop. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado
[SemVer](https://semver.org/lang/es/) mientras no haya releases públicas.

## [0.10.0] — 2026-11-03

La crónica del turno Auton se ve desde el principio y el orden es temporal.

### Añadido

- **Spec de layout completa** en `context/UI-CHAT-INTERCALADO.md`: siete tipos de
  entrada (narración, canal, evento, pregunta nativa, systemEvent, evidence y
  plan), orden por `rowId`, scroll solo si el humano está abajo y prueba de orden.
  `UI-ESPACIO-DEL-PROYECTO.md` 2.4-2.6 quedan como punteros a esa spec.

### Cambiado

- Los turnos con canales `auton-worker` abren la crónica por defecto: el trabajo y
  la narración se ven sin pulsar "Worked for". Los turnos de ZCode conservan su
  regla de colapso.
- El orden de pantalla es siempre temporal por `rowId`; la prioridad solo encola y
  despierta al orquestador. Un latido anterior no se adelanta por prioridad.

### Conocido

- La lista plana de siete tipos y el bloque por worker siguen pendientes.
- El estilo tipo Grok (mensajes separados, menos botones) se deja para después.

## [0.9.0] — 2026-11-03

El aviso del worker deja de ser una pregunta al humano y se pinta como una fila
de trabajo.

### Añadido

- **Propuesta de chat intercalado** en `context/UI-CHAT-INTERCALADO.md`: una sola
  secuencia con narración, canales y eventos en orden, sin bloque global de
  trabajo ni respuesta separada. Pendiente de aprobación.

### Cambiado

- **El worker no pregunta al humano**: su mensaje llega al orquestador como un
  evento del trabajo, sin botón de responder. Si la decisión es del humano, el
  orquestador usa la tool nativa de preguntas. La proyección marca el aviso y lo
  limpia cuando el orquestador responde.
- **Filas de evento sin píldora centrada**: mismo espaciado y tipografía que las
  filas de trabajo de ZCode; el tipo se distingue por el icono.
- **Terminología**: "worker" en la interfaz, el prompt y la documentación pública,
  en lugar de "programador".

### Conocido

- El layout sigue separando bloque de trabajo y respuesta; la crónica intercalada
  está documentada y espera el visto bueno.

## [0.8.0] — 2026-11-03

El hilo vuelve al estilo de ZCode y el orquestador toma la iniciativa.

### Añadido

- **Proactividad**: al abrir un proyecto saluda, dice qué worker de lectura
  mandó, invita a contar la necesidad mientras tanto y ofrece dos o tres caminos
  con recomendación; si el proyecto ya está analizado, propone el siguiente paso.

### Cambiado

- Las filas despertadoras (pregunta, cierre y latido) dejan el ámbar y el verde y
  usan el lenguaje visual de ZCode: borde, fondo secundario y texto de la app. El
  tipo se distingue por el icono.
- La etiqueta `auton-worker` deja el color automático de la paleta de subagentes
  y se pinta en texto secundario; los demás agentes conservan su color.

### Conocido

- El hilo sigue usando la agrupación de ZCode: bloque de trabajo colapsable y
  respuesta final. La crónica intercalada (narración, canales y eventos en orden)
  está en la doctrina, no en el layout; es el siguiente cambio de UI.

## [0.7.0] — 2026-11-03

El orquestador sabe de qué equipo es, con qué autonomía decide y cómo habla.

### Añadido

- **Identidad de equipo**: es el ingeniero a cargo de un equipo real, con un
  humano que responde por el producto y workers que ejecutan; no un chatbot
  esperando instrucciones.
- **Autonomía con validación**: el humano valida la dirección (plan, alcance, lo
  que no entra y cambios de rumbo); dentro del plan aprobado el orquestador
  decide sin pedir permiso por cada paso; lo irreversible se pregunta siempre. Un
  plan nuevo es propuesta hasta el OK y no se presenta como aprobado.
- **Tono**: ingeniero senior, directo, en primera persona, frases cortas, sin
  relleno corporativo, con humor seco cuando encaja.
- **Cada delegación se narra**: qué manda a quién y por qué antes de despachar, y
  qué volvió después. No hay worker invisible.

### Conocido

- La aprobación del plan es conversacional: `AutonPlan` puede escribirlo antes
  del OK. El siguiente paso, si se quiere garantía, es un estado `proposed` y que
  el despacho lo exija.
- Prueba 21 medida con modelo real: la versión nueva presenta el plan como
  propuesta y no pide permiso por un cambio obvio; la anterior dudaba y no
  nombraba la aprobación.

## [0.6.0] — 2026-11-03

El orquestador que sabe planear y conversar: cinco pasos, proporción obligatoria
y un registro del proyecto que se llena sin modelo.

### Añadido

- **Los cinco pasos en el prompt**: entender la intención (con pregunta de
  producto y recomendación), proponer alternativas con ventajas y límites,
  conversar sobre producto, construir el plan con dependencias y "hecho cuando"
  observable, y mantenerlo vivo sin empezar de cero.
- **La proporción**: un cambio de un botón es un encargo; replantear el modo de
  estudio de una app merece conversación y plan profundo. Se justifica en una
  línea ("es un archivo, así que un encargo").
- **Compañero, no formulario**: pregunta una vez con recomendación, dice qué no
  entra, admite lo que no sabe y avisa antes de investigar.
- **Registro del proyecto**: escaneo determinista y sin modelo al crear el
  proyecto (stack, tamaño, archivos clave) guardado en `.auton/project.json`.
- **Análisis de solo lectura**: en la primera petición real el orquestador avisa,
  manda un worker de lectura y guarda su resumen con rutas en
  `.auton/project-analysis.md`; la próxima vez lo lee del registro.

### Cambiado

- El prompt del orquestador se ensambla con el registro del proyecto
  (`buildOrchestratorSection({ workingDirectory })`); una sección que nadie
  incluye no llega al modelo.

### Conocido

- La escritura del análisis depende del prompt; no hay enforcement en el runtime.
- La prueba 20 (el humano no rehace el plan) queda parcial: el corte se sostiene,
  el revisor pide precisar dos criterios.

## [0.5.0] — 2026-11-03

El chat vivo: la conversación del orquestador se mantiene abierta mientras hay
trabajo y los eventos que lo despiertan se ven dentro del mismo hilo.

### Añadido

- **Turno que no se cierra con trabajo vivo**: al terminar de escribir, el turno
  del orquestador espera al último canal (30 minutos como máximo, abortable);
  nunca se queda colgado.
- **Latido de 90 segundos**: con trabajo en curso y sin noticias, aparece una
  fila centrada de estado; el reloj de la conversación la hace visible durante el
  silencio, no solo cuando llega otro evento.
- **Eventos despertadores centrados**: pregunta del programador (ámbar, con
  Responder), cierre del canal (verde, con Abrir) y latido (neutro). Salen del
  mapeo real del hilo y se pintan dentro de la conversación normal, sin pantalla
  aparte.
- **Canales anidados con reloj**: cada programador muestra su estado y su tiempo
  mientras corre; al cerrar conserva su estado final y su reloj.
- **Canal rápido bidireccional**: lo que el programador publica llega al
  orquestador como evento del worker, no como mensaje del humano; la instrucción
  del orquestador entra en el siguiente paso del worker sin reiniciar el encargo.
- **Modos de trabajo**: build, read, research, debug y refactor como eje aparte
  del esfuerzo, con criterio de hecho y su lugar en el prompt.

### Cambiado

- La pregunta pendiente se marca en la proyección cuando el orquestador envía un
  `SendMessage` con `requires_answer`; la respuesta del programador, su cierre o
  un nuevo arranque la levantan.
- El latido se mide con la última señal de vida de la fila visible del worker.

### Eliminado

- `QuestionWakeBlock` y el paso de `onRespondToQuestion`: la pregunta sale del
  mismo mapeo que el cierre y el latido.

### Conocido

- La prueba 17 con modelo real (que el orquestador elija `AutonRevert` al pedir
  "deshaz el sprint 2") sigue bloqueada por falta de proveedor en este entorno.
- Preguntas con opciones y el caso "el humano escribe mientras pregunto" quedan
  fuera de esta etapa.

## [0.4.0] — 2026-11-02

El primer cambio grande de interfaz: el espacio de trabajo de un proyecto.

### Añadido

- **Lista de proyectos**: ordenada por actividad, con nombre y ruta; crear exige
  las dos cosas y al entrar se puede volver a la lista.
- **El espacio del proyecto**: el hilo del orquestador como única conversación,
  con el panel izquierdo rehecho como lista de workers en vivo (estado, reloj,
  aviso de silencio y control de parada).
- **Detalle del worker**: su conversación y su actividad, en solo lectura.
- **Bloques anidados en el hilo**: trabajo, plan y evidencia.

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
- **Documentación en dos niveles**: una guía de producto para cualquiera y una
  documentación interna con el detalle de implementación, con builds separados.

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
