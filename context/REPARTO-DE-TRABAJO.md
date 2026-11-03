# Reparto del trabajo (3 etapas, 3 personas)

> **Quién hace qué y en qué orden.** Léelo junto con `context/EMPIEZA-AQUI.md`.
> Regla de oro: **nadie toca la interfaz de ZCode ni el motor de edición** (ver `EMPIEZA-AQUI.md`).

## Cómo se reparte, y por qué así

| Etapa | Quién | Qué | Por qué a esa persona |
|---|---|---|---|
| **1** | **Edi** (con la sesión de Grok) | **Los límites versionados**: cuándo escala al humano, y el caso **"no sé decidir → pregunto"** | Es **lo más nuevo que tiene el producto** y toca el corazón del prompt y del runtime. Es la pieza que decide si Auton es distinto |
| **1** | **Compañero A** | **El registro durable**: guardar todo lo que pasa con identificador y referencias (objetivo → sprint → encargo → artefacto → decisión) + una herramienta de búsqueda que devuelva pocas líneas | Es **autocontenido, claro y verificable**: o guarda o no guarda. No depende de nada del núcleo |
| **1** | **Compañero B** | **Los tres relojes** (por worker, por sprint, total, con los solapamientos contados una vez) | Es **datos + pantalla con los componentes que ya existen**. Se prueba con el reloj delante |
| **1** | **Compañero B** (después) | **Verificar Muse Code**: las 4 pruebas (arranque sin interacción, salida legible de a poco, respeta su carpeta, autenticación) | Es **investigación con lista de comprobación**: cero riesgo y desbloquea la etapa 3 |
| **2** | **Edi** (con la sesión de Grok) | **El núcleo: bucle vivo + canales anidados + canal rápido** con el orquestador | Es **lo más difícil y lo que más se rompe**. Depende del registro (A) y del reporte de estado |
| **3** | **Compañero A** | **Tablero de sprints + inspector de evidencia** (lee el registro) | Es **pantalla sobre datos que ya existen**: con la etapa 1 hecha, es directo |
| **3** | **Compañero B** | **Motor por sprint**: Muse Code como un adaptador más, con el mismo reporte | Con las 4 pruebas hechas, es **escribir un adaptador**, y la forma ya está probada en el prototipo |

**Por qué el orden es este**: el registro y los relojes **no dependen de nadie** y se pueden hacer en
paralelo desde ya. El bucle vivo **sí depende** del registro (necesita dónde guardar y de dónde
recuperar), así que va en la etapa 2. Y el tablero y el motor **dependen** de lo anterior.

## Definición de "hecho" para cada uno

**A · Registro durable**
- Cada evento, encargo, reporte, decisión y artefacto se guarda **con identificador y con referencias** a
  los objetos relacionados. Nada se resume y nada se tira.
- Una herramienta de búsqueda devuelve **pocas líneas y punteros**, no volcados.
- Se puede responder: *"¿por qué se cambió esto?"* consultando el registro.
- Prueba: buscar algo que pasó hace veinte turnos y que la respuesta salga del registro, no de la memoria
  del modelo.
- **No** se implementa búsqueda semántica ni vectores: eso es la etapa 3 de la spec, solo si hace falta.

**B · Tres relojes**
- Reloj por worker (cuánto lleva y desde cuándo no da señales), por sprint (de punta a punta, con la
  espera separada) y total de la tarea (solapamientos contados **una vez**).
- Se ven con los componentes y tokens que ya usa la app. Nada de diseño nuevo.
- Prueba: un trabajo con dos workers en paralelo y una espera de por medio da los tres números correctos.

**B · Las 4 pruebas de Muse Code**
- Cada una, con su comando y su salida anotados. Si alguna falla, **se dice y se para**: no se escribe el
  adaptador sobre una suposición.

**Edi · Límites versionados**
- El contrato guarda **versión** de los límites, con quién y cuándo los cambió.
- Existe el estado **"no se puede evaluar"** y **escala** al humano en vez de seguir.
- Un worker puede **reportar** que un límite está mal calibrado; **nunca** modificarlo.

**Edi · Núcleo**
- El orquestador **no termina respuestas**: narra por tramos, cada tramo es un sprint, y no hay huecos.
- Los canales de trabajo se **abren y cierran sin límite**, anidados en el hilo del humano.
- El canal rápido funciona **en los dos sentidos** con los workers.

## Reglas para los tres (no negociables)

1. **Un commit por cambio con sentido**, con mensaje que explique qué y por qué.
2. **Nada de credenciales** en el repo.
3. **Verificar antes de afirmar**: si no se probó, se dice "sin verificar". Nada de "debería funcionar".
4. **No usar `--no-verify`** para saltar checks, salvo que el hook no pueda correr, y entonces se corre a
   mano y se dice.
5. **No tocar la interfaz de ZCode ni el motor de edición.** Si hace falta una pantalla nueva, se hace con
   sus componentes y sus tokens.
6. **Antes de preguntar**, leer `context/EMPIEZA-AQUI.md` y la spec. Después, preguntar sin miedo.

## Cómo se coordina el trabajo (el buzón como centro de contexto)

El buzón de agentes sirve como **centro de contexto compartido**: cada uno tiene su instancia, se mandan
los hallazgos y los bloqueos, y **todo queda escrito** en vez de en llamadas. Para eso:

- Cada persona tiene su instancia de buzón y **su identificador** (Edi ya tiene la suya; la de Grok es la
  que planificó todo).
- Los acuerdos que se tomen por el buzón **se copian al repositorio** (un commit o un documento). Lo que
  solo vive en el chat, no existe.
- Y la conversación de la sesión de Grok **se sube al buzón automáticamente** cada cinco minutos, así que
  quien quiera puede leer de dónde salió cada decisión.

---

# Features no incluidas inicialmente (trabajo de Edi, aparte)

> **Esto no entra en ninguna fase.** Es para empezar cuando Edi quiera, en su propia sesión.
> No bloquea nada de lo de arriba.

## A. El espacio de la izquierda, rehecho: los workers

**No se elimina: se rehace.** Antes habíamos decidido apagarlo; ahora se decide **reconstruirlo** para que
ahí vivan los workers.

**Cómo se ve y cómo se usa:**

- **Una fila por worker**, clicable. Al abrirla, se ve **su conversación completa** y **lo que está haciendo
  en tiempo real** — igual que el chat de un proyecto normal, pero **de un proyecto a la vez**.
- **Sin campo de texto para ellos**: al worker no se le escribe directo. **El único que habla es el
  orquestador.**
- **Sí se pueden detener a mano.** Cada worker lleva su control de parar/pausar y su **tiempo y estado en
  vivo** — el mismo patrón que el bloque de tareas de Grok Build (la fila con el reloj, el estado y los
  botones de parar y cerrar).
- **Todo el control vive en la interfaz del orquestador**, y desde ahí se **salta** al worker que quieras
  ver.
- **Tiene que quedar claro en pantalla qué es orquestador y qué es worker**: etiqueta, color o forma
  distinta. No basta con el nombre.
- **Mismo estilo de ZCode, UI nueva**: se reutilizan componentes, tokens y tipografía, y se añaden estados
  y animaciones nuevas encima.

**Terminología**: se dice **worker**. Se deja de decir "programador".

**Qué reutilizar**: la vista que ya muestra la corriente de una sesión, y los controles de proceso que ya
tiene la app. Lo nuevo es la lista, los estados y las animaciones.

## B. El orquestador que sabe planear (criterio de aceptación)

Edi lo pidió explícito y lo refinamos con ChatGPT. **Esto es lo que debe hacer Auton**: planear y
conversar como un ingeniero. Los cinco pasos son el criterio; si falta uno, no está.

**Ejemplo que se usa para juzgarlo**: *"quiero mejorar Lunar para que sea más fácil estudiar"*. El
orquestador **no** se lanza a crear veinte tareas.

1. **Entender la intención.** Preguntar qué problema quiere resolver el humano y para quién, e
   **investigar el proyecto para saber qué existe** antes de proponer nada.
2. **Proponer alternativas.** Explicar opciones, con sus ventajas y sus límites, y **recomendar una
   cuando tenga razones** para ello. No ofrecer un menú sin criterio.
3. **Conversar sobre producto.** Ayudar a decidir **qué experiencia** se quiere, sin pasarle al humano
   las decisiones técnicas.
4. **Construir el plan.** Definir resultados, **prioridades**, dependencias, encargos para los workers, y
   **cómo se comprobará cada entrega**.
5. **Mantenerlo vivo.** Si durante el trabajo aparece algo nuevo o el humano cambia de opinión:
   **actualizar el plan y explicar qué cambia**. Sin empezar de cero.

**Y sabe cuánta planificación necesita cada cosa** — esto es la proporción, y es obligatorio:
cambiar un botón puede resolverse con **un encargo sencillo**; replantear el modo de estudio de Lunar
merece **una conversación y un plan más profundo**. Elegir mal la proporción (inflar lo pequeño o aplanar
lo grande) es el fallo más visible del orquestador.

### Lo que se suma de la lista anterior (sigue valiendo)

- **El plan legible en 30 segundos**: arriba tres o cinco líneas (qué, en qué orden, qué depende de qué,
  cómo se sabrá que está terminado) y debajo los sprints. Es lo que muestra la tarjeta del plan.
- **Decidir o preguntar, nunca dejar abierto**: cada ambigüedad se resuelve con una razón o con una
  pregunta.
- **Lo que NO se va a hacer** escrito en el plan: es lo que evita que el alcance crezca solo.

### Las pruebas

- **La #1** de `context/PRUEBAS-QUE-PROMETEMOS.md`: parte en proporción (1-2 sprints para un archivo,
  8-20 para un producto).
- **Nueva — "el humano no rehace el plan"**: que un tercero lea el plan y diga si le cambiaría algo.
  Si le cambia, el orquestador **transcribió, no planeó**.
- **Nueva — los cinco pasos en orden**: dado el ejemplo de Lunar, se deben ver los cinco (intención,
  alternativas, conversación de producto, plan y mantenimiento) y **no** una lista de veinte tareas.

### Fuera del MVP (a propósito)

Planificación multi-turno larga con el humano, el asistente planificador propio del orquestador, y
aprender de planes anteriores. Eso es v3.4, y se dice así para no prometerlo.
