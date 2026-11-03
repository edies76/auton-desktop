# Límites y autonomía

Un sistema autónomo es útil cuando sabes hasta dónde puede llegar sin ti. En Auton esa frontera no se deja a la intuición del modelo: se escribe antes de empezar y queda registrada.

## La idea

Antes de repartir trabajo, el plan guarda un conjunto de límites:

- cuántos intentos puede consumir una pieza antes de detenerse;
- qué acciones necesitan tu aprobación;
- qué hace el sistema cuando no puede decidir.

Ese conjunto tiene una versión. Si alguien lo cambia, el cambio queda anotado con la fecha, el valor anterior, el nuevo, el motivo y quién lo aprobó.

## Qué significa "versionado"

Una regla sin versión es una costumbre. Una regla versionada es un contrato:

- se puede leer qué regía en el momento en que se tomó una decisión;
- se puede reconstruir por qué cambió;
- un cambio no se puede reescribir en silencio.

Los planes creados antes de esta regla quedan marcados como "sin versión". El sistema no inventa un pasado que no existía.

## Cuándo te consulta

Auton te consulta en tres situaciones:

1. **La decisión es tuya.** Cambios de alcance, permisos, acciones irreversibles, riesgo alto.
2. **Se agotó una ruta.** Una pieza consumió sus intentos y no hay un camino claro dentro de lo acordado.
3. **No puede evaluar.** Falta el dato para juzgar si algo está bien. Es el caso más importante: el sistema escala en vez de seguir a ciegas.

El tercer caso es una decisión de diseño, no un fallo. Un sistema que sigue cuando no sabe es más peligroso que uno que pregunta.

## Qué pasa cuando preguntas tú

Puedes escribir en cualquier momento, incluso mientras el trabajo corre. Tu mensaje tiene prioridad: no espera detrás de un formulario.

Si había una pregunta abierta y tu mensaje la responde, la pregunta se retira. Si aporta información nueva, se reformula. Nunca tienes que "responder el cuestionario" para que te hagan caso.

## Qué no puede hacer un trabajador

Un programador puede **reportar** que un límite está mal calibrado: por ejemplo, que tres intentos no alcanzan para una pieza concreta.

Lo que no puede es **cambiarlo**. Los límites son el acuerdo entre tú y el orquestador; un trabajador los informa, no los edita.

## Por qué esto importa

La autonomía sin gobierno es una promesa vacía. Lo que hace defendible a un sistema autónomo no es que nunca se equivoque, sino que:

- sus reglas estén escritas antes de actuar;
- sus cambios se puedan auditar;
- sus dudas lleguen a una persona;
- su silencio no oculte un problema.

Eso es lo que Auton llama autonomía gobernada.

## Siguiente lectura

- [Cómo trabaja Auton](./como-trabaja.md): el recorrido completo.
- [Preguntas frecuentes](./preguntas-frecuentes.md): casos concretos.
