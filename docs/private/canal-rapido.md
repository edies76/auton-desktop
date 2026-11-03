# Canal rápido orquestador ↔ programador

> Documento privado. Última verificación: 2026-11-03, rama `feat/edi/limites`.
> Describe cómo funciona hoy, no el código línea por línea.

## Qué resuelve

El programador deja de ser una caja que solo habla al final. Mientras trabaja puede contar lo que encuentra, pedir un dato, proponer otro enfoque o responder una pregunta, y el orquestador puede dirigirlo en caliente sin esperar a que termine.

## Los dos sentidos

| Dirección | Herramienta | Qué hace |
| --- | --- | --- |
| Orquestador → programador | `SendMessage` | Entrega una guía, un dato, una corrección o una decisión requerida |
| Programador → orquestador | `RespondToCoordinator` | Publica un avance, una duda, un bloqueo o la respuesta a una pregunta |

Los dos mensajes viajan por la misma cola interna, así que conservan orden y quedan registrados en la sesión.

## Cuándo le llega el mensaje al programador

El mensaje **no abre un turno nuevo** y no corta lo que el programador está haciendo. Entra como guía del turno que ya corre y se entrega en el **siguiente punto de decisión del modelo**: termina la tanda de herramientas que ya tenía en marcha y, antes de elegir su próxima acción, lo lee.

Ese punto es lo que en la práctica se siente como "pausa": el programador no pierde contexto, no reinicia y no repite trabajo. Si el turno ya cerró o está detenido, el mensaje pasa a la cola y se convierte en su siguiente entrada. Si el programador ya había terminado, se le reanuda en segundo plano con ese mensaje y conserva su sesión.

## El candado: lo pone el orquestador

Hay dos formas de mandar un mensaje, y la diferencia es del orquestador:

- **Guía normal.** Para un dato, una corrección o un cambio de enfoque. El programador la incorpora y sigue sin detenerse.
- **Decisión requerida** (`requires_answer`). Para una pregunta que ese frente no puede resolver solo. El mensaje llega con un encabezado explícito —"DECISIÓN REQUERIDA POR EL ORQUESTADOR"— y la instrucción de contestar con `RespondToCoordinator` antes de seguir.

Cuando una decisión requerida sale, la pieza queda marcada como esperando respuesta. La marca se levanta sola en cuanto llega la respuesta del programador. La pregunta que el orquestador no puede resolver se convierte en una decisión tuya: la pieza pasa a `waiting` en el plan con la pregunta escrita, y el orquestador adelanta otro frente.

## Prioridad de los eventos

1. Mensaje del humano.
2. Pregunta de un programador.
3. Cierre, fallo o bloqueo.
4. Latido de estado.

El orquestador atiende en ese orden. Si estás escribiendo mientras hay una pregunta abierta de un programador, tu mensaje gana y la pregunta se replantea con esa información.

## Qué ve el humano

- El bloque del programador en el hilo, con su reloj y su estado.
- La conversación dentro de ese bloque: lo que preguntó, lo que se le respondió y cuándo.
- Una fila de evento cuando un frente se cierra, falla o necesita una decisión.
- El plan, donde la pieza en espera aparece como `waiting` con la pregunta.

## Lo que el sistema garantiza y lo que no

**Garantiza**: que el mensaje llegue al programador en su siguiente punto de decisión; que una decisión requerida quede marcada como pendiente hasta que responda; que la respuesta despierte al orquestador; y que nada se pierda si un turno se corta.

**No garantiza**: que el modelo obedezca al pie de la letra. El cumplimiento del "contesta antes de seguir" es una instrucción fuerte, no un bloqueo del runtime. Es una decisión de diseño: bloquear el turno hasta la respuesta cuesta autonomía y puede dejar un frente muerto si el modelo nunca contesta.

## Cuándo se rompe

| Síntoma | Causa probable |
| --- | --- |
| El programador sigue sin haber visto el mensaje | Está a mitad de una herramienta larga; se entrega en el siguiente punto de decisión |
| La pieza quedó en esperando y nadie la levantó | El programador no llamó a `RespondToCoordinator`; el orquestador puede reenviar o cerrar la pieza |
| El mensaje no llegó | El programador ya había terminado y no había sesión que reanudar; revisar el estado del task |
| Dos preguntas cruzadas | El orquestador atiende por prioridad; la segunda espera a que se resuelva la primera |

## Dónde vive en el código

Búsquedas útiles para quien continúe:

- `SendMessage` y su descripción para el modelo: la herramienta del orquestador.
- `RespondToCoordinator`: la herramienta del programador, con sus instrucciones de uso.
- La entrega como guía y el formato del encabezado: el módulo de mensajería del subagente.
- El candado (marcar, levantar, encabezado): `subagent/answer-lock.ts`.
- La sesión real del programador: el runner del subagente decide su prompt de identidad.

## Pruebas que lo cubren

- `auton-answer-lock.test.ts`: marcar, no marcar sin candado, levantar una sola vez, guía normal sin encabezado y decisión requerida con encabezado y destino correcto.
- `auton-loop.test.ts`: prioridades y latido.
- `auton-worker-policy.test.ts`: identidad del programador, política de esfuerzo y thinking.
- `auton-plan-tool.test.ts` y `auton-limits-governance.test.ts`: gobierno del plan, intentos y aprobaciones.
