# Cómo trabaja Auton

Esta página recorre el camino de un objetivo, desde que lo escribes hasta que el trabajo se cierra con evidencia.

## 1. Defines el objetivo

Escribes lo que quieres construir, en tus palabras, y las restricciones que importan: qué tecnología, qué no se puede tocar, qué queda fuera, cuándo consideras que está bien.

## 2. Auton propone la dirección

Antes de mover una línea de código, Auton convierte el objetivo en un plan:

- piezas de trabajo con un resultado comprobable;
- dependencias entre ellas;
- alcance permitido para cada pieza;
- qué evidencia demuestra que está hecha.

Si el objetivo es grande, el plan es grande. Auton no encoge el problema para que parezca fácil.

Cuando la dirección del producto importa, el plan se te presenta para que lo apruebes. Tú decides si el camino es el correcto.

## 3. Reparte el trabajo

Cada pieza lista se entrega a un programador con un encargo acotado: objetivo, criterio de hecho, archivos permitidos, restricciones y evidencia esperada.

Los programadores no hablan contigo. Le reportan al orquestador. Lo que tú ves es lo que el orquestador decide contarte.

## 4. Cuenta lo que pasa

Mientras el trabajo corre, Auton mantiene una crónica en el mismo hilo:

- qué lanzó y qué queda en marcha;
- qué volvió y qué decide con eso;
- si cambia el plan y por qué;
- si hay una espera larga, una línea de estado.

El detalle técnico vive en el canal de cada pieza. El hilo conserva la historia que necesitas para dirigir.

## 4.1. Los programadores hablan mientras trabajan

Cada programador puede hablar con el orquestador a mitad del encargo, en texto libre: contar lo que encontró, pedir un dato, proponer otro enfoque, avisar un bloqueo o responder algo que el orquestador le preguntó.

Ese mensaje llega al orquestador como una interrupción de alta prioridad, por encima de los avisos de estado y por debajo de lo que escribes tú. El orquestador contesta por el mismo canal: da el dato, corrige el rumbo, pide evidencia o detiene la pieza y la relanza con un encargo mejor.

La conversación se ve en el mismo hilo, dentro del bloque de esa pieza. No hace falta abrir nada ni cambiar de pestaña para seguirla.

Cuando el orquestador necesita una decisión que el programador no puede tomar, marca el mensaje como **decisión requerida**: esa pieza se detiene antes de continuar y contesta. Las demás siguen su curso. Si la decisión es tuya, el orquestador te la trae y deja la pieza esperando mientras adelanta otro frente.

## 4.2. Cada encargo tiene un modo

Además de cuánto esfuerzo pone, un encargo lleva un modo: construir, leer, investigar, depurar o refactorizar. El orquestador lo elige y lo dice.

Un encargo de lectura explora y devuelve contexto con rutas, sin tocar un solo archivo. Uno de investigación compara alternativas y termina en una recomendación con razones, no en una lista de enlaces. Uno de depuración trae el comando que reproduce el fallo y la causa señalada, y deja el arreglo para un encargo de construcción. Uno de refactor cambia la forma manteniendo los tests en verde.

Pedir contexto es barato y no ensucia el proyecto. Por eso el orquestador lee para decidir y manda leer para tener contexto, en vez de explorarlo todo a ciegas.

## 5. Comprueba antes de cerrar

Una pieza terminada pasa por una revisión independiente. Se comprueba el criterio de hecho, no la seguridad con la que el modelo cuenta que lo hizo.

- Si cumple, se cierra con su evidencia.
- Si no cumple, vuelve con el fallo concreto.
- Si no se puede juzgar, escala: la duda no se convierte en un aprobado.

## 6. Decide y continúa

Con el resultado en la mano, Auton elige: cerrar, corregir, replantear o preguntarte. Tú puedes intervenir en cualquier momento: cambiar prioridades, pedir una corrección, detener una pieza o introducir una decisión nueva.

La conversación no se bloquea mientras el trabajo avanza.

## Lo que ves en pantalla

- **El plan**, con el estado de cada pieza y su criterio de hecho.
- **La crónica**, con lo que Auton decidió y por qué.
- **Las piezas en marcha**, con su tiempo y su último avance.
- **Las decisiones pendientes**, cuando una pregunta necesita tu respuesta.
- **La evidencia**, cuando algo se cierra.

## Qué puedes pedirle

- "Haz esto, con estas restricciones."
- "¿Por qué se cambió esto?"
- "Para esa pieza y explícame."
- "Cambia la prioridad: primero esto."
- "No me convences; vuelve a intentarlo con este diagnóstico."

Auton traduce tus objetivos de producto a trabajo técnico. Tú no tienes que repartir tareas ni recordar cada restricción: eso queda escrito en el plan.

## Siguiente lectura

- [Límites y autonomía](./limites-y-autonomia.md): la parte que decide cuándo te consulta.
- [Preguntas frecuentes](./preguntas-frecuentes.md): dudas concretas.
