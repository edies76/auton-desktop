# Qué es Auton

Auton es un director de ingeniería para tus proyectos de software. Tú decides **qué** construir y cuáles son los límites. Auton decide **cómo** abordarlo, reparte el trabajo, comprueba lo entregado y te pide una decisión solo cuando de verdad hace falta.

La diferencia con un asistente de código corriente está en quién lleva el oficio. En un asistente, el modelo escribe el código y tú sigues siendo el arquitecto, el revisor y el gestor de tareas. En Auton esa disciplina forma parte del producto.

## El problema que resuelve

Trabajar con agentes de código se parece menos a programar y más a dirigir:

- partes el trabajo en trozos que alguien pueda hacer;
- decides qué está suficientemente terminado;
- detectas lo que el agente omitió;
- reformulas cuando no entendió;
- compruebas que no rompió algo que ya funcionaba;
- decides cuándo insistir y cuándo cambiar de enfoque.

Con un frente abierto eso se aguanta. Con tres o cuatro, tu atención pasa a ser el límite del proyecto, aunque el modelo escriba la mayor parte del código.

Auton mueve ese trabajo de dirección al sistema. El humano se queda con las decisiones de producto: qué construir, qué restricciones hay, qué se aprueba y qué queda fuera.

## Los tres oficios

| Oficio | Qué hace |
| --- | --- |
| **Orquestador** | Entiende tu objetivo, lo convierte en un plan verificable, reparte el trabajo y decide qué se cierra. Es el único que habla contigo. |
| **Programadores** | Construyen piezas concretas del plan dentro de un alcance acordado. |
| **Revisor** | Comprueba lo construido con evidencia. No cierra nada por una declaración. |

Una pieza no se da por terminada porque un modelo diga "listo". Se cierra cuando hay una prueba o un artefacto que respalda el criterio de hecho.

## Lo que puedes esperar

- **Un plan visible antes de trabajar.** Auton propone los pasos, con su criterio de hecho, y espera tu aprobación cuando la dirección importa.
- **Trabajo en paralelo.** Varias piezas pueden avanzar a la vez sin que tengas que abrir una pestaña por cada una.
- **Crónica en el mismo hilo.** Mientras el trabajo ocurre, Auton cuenta qué lanzó, qué volvió y qué decidió. Si hay una espera, lo dice.
- **Decisiones puntuales.** Te pregunta por producto, riesgo, permisos y bloqueos reales. Lo demás lo resuelve él.
- **Trazabilidad.** Cada cierre deja la relación entre lo pedido, lo cambiado y la prueba que lo respalda.

## Lo que Auton no promete

- No sustituye tu criterio de producto.
- No convierte cualquier idea en software perfecto.
- No elimina la revisión humana en decisiones de alto impacto.
- No garantiza que un modelo barato rinda como uno potente; eso se mide, no se afirma.

La honestidad es parte del diseño: si algo no está probado, se dice. Si una decisión no se puede evaluar con la información disponible, el sistema pregunta en vez de seguir.

## Estado

Auton está en construcción activa. La documentación describe el comportamiento que el producto persigue y las piezas que ya están implementadas. Las páginas de esta sección evitan deliberadamente detalles internos; el equipo mantiene una documentación técnica separada.

## Siguiente lectura

- [Cómo trabaja Auton](./como-trabaja.md): el recorrido de un objetivo.
- [Límites y autonomía](./limites-y-autonomia.md): cuándo decide solo y cuándo te consulta.
- [Datos y privacidad](./datos-y-privacidad.md): dónde vive tu trabajo.
