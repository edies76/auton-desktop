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

## B. El orquestador que sabe planear (esto es lo que separa al producto)

Edi lo pidió explícito y tiene razón: **lo que él está haciendo a mano es lo que debe hacer Auton.**
Planear el proyecto a fondo, sostener conversaciones largas, decidir el corte del trabajo. Eso no es un
ajuste del prompt: es **trabajo pesado de prompt engineering**, y es el corazón del producto.

Lo que el orquestador tiene que saber hacer:

1. **Pensar antes de partir.** Entender la intención, el stack, las restricciones, y **lo que no se va a
   hacer**. Preguntar lo que decide producto; decidir él lo demás.
2. **Planear profundo, y proporcional.** Sprints con criterio de hecho, dependencias y frentes paralelos,
   y saber cuándo **no** hacerlo (un archivo es una fila, no un equipo).
3. **Conversar para planear.** Con el humano: pocas preguntas, con opciones, sin interrogar. Y **con sus
   workers**: hablar con ellos para partir el trabajo, no solo repartirlo.
4. **Explicar el plan como si lo hubiera escrito un ingeniero**: qué se va a hacer, en qué orden, qué
   depende de qué, y cómo se sabrá que está terminado.
5. **El criterio de que está bien hecho**: **el humano no tiene que rehacer el plan**. Si tiene que
   corregirlo, el orquestador no planeó: transcribió.

**Por qué esto es el diferencial**: cualquiera puede pedirle a un modelo que escriba una lista de tareas.
Lo que casi nadie tiene es un sistema donde el plan **se piensa**, se **escribe en un contrato**, se
**reparte con criterio** y se **revisa con evidencia**. Eso es prompt engineering + arquitectura, y es lo
que hay que trabajar con más cuidado de todo el proyecto.
