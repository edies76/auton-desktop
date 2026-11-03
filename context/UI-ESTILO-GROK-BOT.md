# El estilo de Grok Bot: para después (no ahora)

**Estado: dirección de diseño anotada. NO se implementa ahora.** Edi lo pidió explícito: *"me encanta, así
quiero que se vea el orquestador… pero no me da el tiempo para coordinar todo ese diseño, así que dejemos
como está, pa después"*. Se guarda aquí para que cuando toque, nadie tenga que adivinar.

## Por qué gusta (y no es solo estética)

Lo que hace **Grok Bot** (la interfaz de "Timothy") es **quitar la dureza**: el texto llega **en bloques
cortos**, uno por idea, y el tono es **cálido y en primera persona**. Comparado con ZCode, que habla en
párrafos y en jerga de herramienta, esto se siente **un compañero** en vez de una terminal. Y eso es
exactamente lo que Auton promete: el orquestador como **director amable**, no como consola.

## Las piezas que hay que copiar (sacadas de las capturas)

1. **Texto en bloques cortos.** Cada idea es un bloque separado, de dos o tres líneas como mucho. Nada de
   párrafos largos. Es lo que hace la lectura ligera.
2. **Chips dentro del texto.** Las referencias (nombres, enlaces, elementos de una lista) van resaltadas
   dentro de la propia frase, con el color de acento y un subrayado suave. Sirven para señalar sin cortar la
   lectura.
3. **Listas numeradas dentro del bloque**, cada ítem en su fila, con su título en negrita y una línea de
   explicación debajo.
4. **Bloque de pregunta al final, con opciones etiquetadas.** Aparece al pie del mensaje, con las opciones
   marcadas **A, B, C** y una de ellas preseleccionada (con su marca de elegida). Y una flecha para desplegar.
   Esto es **mejor que nuestra tarjeta de preguntas**: más compacto y menos "formulario".
5. **Etiquetas de estado pequeñas** debajo del texto: tipo *"Created routines · BuildStac"* o *"○ Handling
   it"*. Son píldoras discretas que informan sin ocupar. Y **el avatar del asistente** al lado, pequeño.
6. **Tono**. Primera persona, frases humanas: *"Got it, I'll own all nine"*, *"On it."*, *"The build is
   underway"*. Y **admite lo que falta sin drama**: *"Some of it is still placeholder… I left prices off"*.
   Eso último es **nuestra regla de evidencia, contada con amabilidad**.

## Cómo encaja con lo que ya decidimos

No cambia nada de fondo: **los mismos tokens y componentes de ZCode** (regla que no se rompe), pero con
**otra composición y otro tono**. Es **compatible** con el chat intercalado
(`context/UI-CHAT-INTERCALADO.md`) y con los bloques anidados, y de hecho **mejora dos cosas**:

- **La narración** del orquestador pasa a ser bloques cortos, no párrafos.
- **La pregunta al humano** pasa a ser el bloque de opciones A/B/C, en vez de una tarjeta de formulario.

## Cuándo se hace

**Después del chat intercalado y de que la demo funcione.** Es la capa de acabado: primero que el hilo
cuente la historia bien; luego, que se lea bonito. Y cuando se haga, se hace **con la spec delante**, no a
oído.
