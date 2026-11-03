# Chat intercalado: una sola crónica, no un bloque de trabajo y una respuesta

**Estado: propuesta. Pendiente del visto bueno de Edi. No implementado.**

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

1. **Narración**: un mensaje normal del orquestador (1-2 líneas). Nunca se colapsa.
2. **Canal de worker**: una entrada por worker, con cabecera (nombre, estado y
   reloj) y, dentro, sus tool calls y sus mensajes. Es lo único que se colapsa;
   el bloque es del worker, no del turno.
3. **Evento de worker**: el aviso de que el worker escribió al orquestador, su
   cierre o el latido. Fila normal del trabajo, con icono, sin color propio, sin
   botón de responder al humano.
4. **Pregunta al humano**: cuando el orquestador necesita una decisión, usa la
   tool nativa de preguntas de ZCode; su bloque nativo se pinta en la secuencia.
   El worker nunca pregunta al humano.
5. **Cierre del turno**: el mensaje final del orquestador es otra narración, no
   una sección aparte.

### Reglas de composición

- El orquestador habla **arriba y abajo** de cada canal: antes para decir qué va a
  hacer y con quién, después para contar qué encontró y qué decidió.
- Dos workers producen dos canales intercalados con la narración, no un bloque
  único con dos tarjetas dentro.
- El reloj del canal mide su propio trabajo; el del turno desaparece como bloque.
- La secuencia respeta el orden temporal de los eventos, con la prioridad ya
  definida: humano, pregunta de worker, cierre/fallo, latido.
- Se reutilizan los componentes y tokens de ZCode: tipografía, espaciado, iconos
  y filas de tool. Sin colores nuevos ni píldoras centradas.

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
- Pruebas: una de mapeo (las entradas salen en orden y con el tipo correcto) y una
  de render del hilo real con dos canales y una pregunta.

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
