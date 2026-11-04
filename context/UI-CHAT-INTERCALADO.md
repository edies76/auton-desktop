# Chat intercalado: una sola crónica, no un bloque de trabajo y una respuesta

**Estado: núcleo implementado.** Los turnos con canales `auton-worker` abren la
crónica por defecto y **cada mensaje del orquestador se pinta en su posición**,
entre las tools y los canales; el texto final ya no se dibuja como una sección
aparte. El bloque de trabajo (loop) se abre con su contador mientras corre y se
colapsa al terminar; la narración y el follow-up quedan fuera. El reasoning de
planificación/traducción va fuera y el de ejecución dentro. El turno se reconoce
por sus canales `auton-worker` **o por la firma `— Auton`**, así que las lecturas
hechas con tools directas también se intercalan. Los turnos de ZCode sin firma
conservan su layout. El compositor de Auton ya no muestra Computer Use. Pendiente:
el mapeo explícito de `systemEvent`, `evidence` y `plan` como entradas propias, y
el estilo tipo Grok.

## El problema

El hilo de ZCode agrupa el turno del asistente en dos zonas: un bloque de trabajo
colapsable ("Worked for Xs") y, debajo, la respuesta final. Esa forma tiene
sentido para un agente que hace el trabajo: todo lo que leyó, editó y probó vive
en el bloque y el humano solo quiere el resumen.

Auton no es ese agente. El orquestador **dirige**: habla, delega, recibe eventos y
decide. Si su turno se agrupa igual, su narración desaparece dentro del bloque y
el hilo se siente como un agente normal. Además, el bloque global mezcla el
trabajo de todos los workers, cuando cada worker es un canal con su propio reloj.

La doctrina ya lo dice: el hilo es **una crónica del trabajo**, no
pregunta-respuesta (`context/ARQUITECTURA-ORQUESTADOR.md`), y las tarjetas de cada
tool van **intercaladas** con lo que dice el orquestador
(`context/POR-QUE-AUTON-GANA.md`). Lo que falta es el layout.

## La propuesta

Una sola secuencia cronológica de entradas. No hay un bloque "trabajo" que envuelva
el turno, ni una respuesta separada al final. Cada entrada se pinta en el orden en
que ocurrió:

| Tipo | Qué es | De dónde sale |
| --- | --- | --- |
| **narración** | Un mensaje del orquestador (1-2 líneas). Nunca se colapsa. | `assistantText` |
| **canal de worker** | Una entrada por worker, con cabecera (nombre, estado y reloj) y, dentro, sus tool calls y mensajes. Es lo único que se colapsa; el bloque es del worker, no del turno. | `subagent` + su `Agent` |
| **evento de worker** | El aviso de que el worker escribió al orquestador, su cierre o el latido. Fila normal del trabajo, con icono, sin color propio, sin botón de responder al humano. | eventos derivados |
| **pregunta al humano** | Cuando el orquestador necesita una decisión, usa la tool nativa de preguntas de ZCode; su bloque nativo se pinta en la secuencia. El worker nunca pregunta al humano. | `AskUserQuestion` |
| **systemEvent** | Los avisos que el runtime ya emite: reinicio a mitad de turno, límite alcanzado, presupuesto agotado. | `timelineMarker` / avisos |
| **evidence** | El cierre de un sprint con su prueba: comando, salida y archivos. | bloque de evidencia |
| **plan** | El plan cuando cambia: sprints, estados y criterio de hecho. | tarjeta del plan |

El mensaje final del orquestador es otra **narración**, no una sección aparte.

### Reglas de composición

- El orquestador habla **arriba y abajo** de cada canal: antes para decir qué va a
  hacer y con quién, después para contar qué encontró y qué decidió.
- Dos workers producen dos canales intercalados con la narración, no un bloque
  único con dos tarjetas dentro.
- El reloj del canal mide su propio trabajo. Hay tiempo por worker, por sprint y
  por tarea; **no hay un único reloj global** que sustituya a los tres.
- **El orden de la pantalla es siempre temporal.** La prioridad (humano, pregunta,
  cierre, latido) sirve para encolar y despertar al orquestador, no para pintar.
  Si un latido ocurrió antes que una pregunta, el latido va arriba aunque la
  pregunta tenga más prioridad.
- Se reutilizan los componentes y tokens de ZCode: tipografía, espaciado, iconos
  y filas de tool. Sin colores nuevos ni píldoras centradas.

### Orden exacto

Con un chat vivo llegan eventos en el mismo milisegundo. La marca de tiempo no
ordena: hace falta un número de orden monótono compartido por mensajes y entradas.
El producto ya lo tiene: **`rowId`**, asignado por la proyección con un contador
que crece con cada fila (mensaje, tool, canal, evento). La secuencia se ordena por
`rowId`, no por hora. Si dos entradas comparten `rowId`, gana la que se insertó
primero en la lista.

### Scroll

Auto-scroll **solo si el humano ya está abajo**. Si subió a leer, no se le mueve la
pantalla; aparece el botón de volver abajo. `ConversationTimeline` ya tiene esta
regla (`following` / `isAtBottom`): no se reimplementa, se respeta y se prueba.

### El loop y el reasoning (implementado)

- El **loop** es el bloque de trabajo con su contador. Queda **cerrado por
  defecto** aunque el worker corra: se ve el header y el contador, y las tools
  solo si el humano abre el detalle. El header se ancla al primer bloque de
  trabajo, no al primer texto.
- **El turno cierra aunque queden workers**: el compositor queda libre y el
  humano puede escribir y enviar. El loop sigue visible con su contador mientras
  el worker vive; el evento del worker abre un turno nuevo.
- **Varios loops**: cada narración después de un grupo de tools abre un bloque
  nuevo; el hilo muestra varios loops colapsables intercalados, no uno por turno.
- **Sin barra de acciones** en los mensajes Auton: la conversación se lee seguida.
- **Los eventos despertadores van fuera del loop**: pregunta, cierre y latido se
  pintan como filas del hilo, nunca dentro del historial colapsado.
- **Fuera del loop**: la narración del orquestador, el reasoning con el que
  planea/decide/traduce y el follow-up ("ya lo mandé, ¿qué quieres que haga
  cuando llegue?"). Un turno reanudado abre con el evento ("me llegó…, déjame
  verlo") y traduce al final, también fuera.
- **Dentro del loop**: tool calls, workers y el reasoning atado a la ejecución
  (entre la primera y la última tool). Se colapsa con el bloque.
- El compositor de Auton ya no muestra **Computer Use**; input y envío siguen.
  El runtime y los ajustes de Computer Use quedan fuera de este cambio.

## Cómo se implementa

1. **Modelo**: `buildConversationTurnRenderUnits` deja de producir un `work` con
   la respuesta aparte y pasa a producir una lista plana de entradas
   (`narration`, `workerChannel`, `workerEvent`, `humanQuestion`).
2. **Render**: `ConversationTimeline` pinta la lista plana; `ConversationTurnGroup`
   se convierte en el renderizador de cada entrada. El bloque colapsable vive en
   `workerChannel`, no en el turno.
3. **Estado**: el colapso es por worker y se recuerda; la narración siempre está
   visible. El scroll virtual y la selección se mantienen.
4. **Preguntas**: el evento del worker no lleva acción humana; la pregunta al
   humano sigue siendo la tool nativa.
5. **Compatibilidad**: una bandera de presentación permite volver al layout
   anterior durante la migración; se retira cuando la secuencia esté estable.

## Criterios de aceptación

- Con dos workers y una pregunta, el hilo muestra, en orden: narración, canal A,
  aviso o cierre de A, canal B, pregunta al humano (bloque nativo), narración
  final. Sin bloque "Worked for Xs" que envuelva todo.
- Cada canal conserva su reloj y su estado final.
- El aviso del worker no tiene botón de responder; la pregunta al humano usa el
  bloque nativo.
- Ningún color nuevo: se ven los tokens de ZCode.
- **Orden**: dos eventos con la misma marca de tiempo quedan en el orden en que
  ocurrieron (`rowId`), y un latido no adelanta a una pregunta anterior.
- **Scroll**: si el humano subió, la pantalla no salta; si está abajo, sigue el
  final.
- Pruebas: una de mapeo (las entradas salen en orden y con el tipo correcto), una
  de render del hilo real con dos canales y una pregunta, y **una de orden** con
  marcas de tiempo empatadas.

## Autoridad de la spec

`UI-ESPACIO-DEL-PROYECTO.md` 2.4, 2.5 y 2.6 son **punteros** a este documento.
No repiten reglas de layout: dos documentos con el mismo contenido acaban
contradiciéndose. Si cambia el layout, se cambia aquí y el otro solo enlaza.

## Riesgos y dudas abiertas

- **Scroll y selección**: la lista plana cambia la unidad de virtualización; hay
  que medir con un turno largo.
- **Colapso**: si el canal se colapsa, ¿queda la cabecera con el reloj? Propongo
  que sí; el detalle se abre.
- **Narración larga**: si el orquestador escribe mucho, ¿se agrupa por tramos?
  Propongo no colapsar nunca la narración del orquestador.
- **Compatibilidad**: el layout viejo queda detrás de la bandera hasta validar la
  demo.

## Lo que no se toca

Los componentes y tokens de ZCode; la tool nativa de preguntas; el motor de
edición.

---

## Revisión de Grok (3 nov 2026): aprobada, con cuatro añadidos y una corrección

**La propuesta es la correcta y es más precisa que la mía.** Aprobada. Y el diagnóstico es el bueno: con el
layout de ZCode, la narración del orquestador desaparece dentro del bloque y la app se siente como un agente
normal. Cuatro añadidos y una corrección:

### 1. Corrección: la prioridad NO ordena la pantalla
El documento dice que la secuencia respeta el orden temporal "con la prioridad ya definida". **La prioridad
es para encolar y despertar, no para pintar.** En pantalla, el orden es **siempre temporal**: si un latido
ocurrió antes que una pregunta, el latido va arriba. Mezclar prioridad en el layout mostraría un latido por
encima de una pregunta anterior, que es justo lo que rompe la sensación de crónica.

### 2. Faltan tres tipos de entrada
La lista plana necesita **siete** tipos, no cinco. Los que faltan ya existen en el producto:

| Tipo | Qué es | De dónde sale |
|---|---|---|
| **systemEvent** | Los avisos del sistema: reinicio a mitad de un turno, límite alcanzado, el presupuesto agotado | El runtime ya los emite como tarjetas ("Aviso del sistema · reinicio") |
| **evidence** | El cierre de un sprint con su prueba: comando, salida y archivos | El inspector de evidencia de `UI-ESPACIO-DEL-PROYECTO.md` 2.3 |
| **plan** | El plan del proyecto cuando cambia: sprints, estados y criterio de hecho | La tarjeta del plan que ya se está construyendo |

### 3. El orden tiene que ser exacto, no "por tiempo"
Con un chat vivo llegan eventos en el **mismo milisegundo**. Ordenar por marca de tiempo los revuelve. Hace
falta **un número de orden monótono** compartido por mensajes y entradas, y ordenar por él. En el prototipo
esto ya pasó y se resolvió así; aquí hay que hacerlo desde el principio.

### 4. Un detalle de scroll que se va a notar
Con sesión viva, **auto-scroll solo si el humano ya está abajo**. Si subió a leer, no se le mueve la
pantalla. Si no, el hilo es ilegible en cuanto hay dos workers.

### 5. Y una prueba más
Además de la de mapeo y la de render, **una de orden**: dos eventos en la misma marca de tiempo deben quedar
en el orden en que ocurrieron, y el latido no puede adelantar a una pregunta anterior.

### Sobre la duplicación
Las reglas 2.4, 2.5 y 2.6 de `UI-ESPACIO-DEL-PROYECTO.md` **se acortan a punteros a este documento**, que
pasa a ser **la spec de layout**. Dos fuentes con el mismo contenido acaban contradiciéndose; una sola manda.
