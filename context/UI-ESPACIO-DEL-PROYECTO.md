# UI — El espacio del proyecto (spec para construir)

> **Para el agente que arranque la UI**: esto es lo que hay que construir, con el detalle suficiente para
> no adivinar. Si algo no está aquí, **no lo inventes**: pregúntale a Edi.

## Qué es, en una frase

Es **el primer gran cambio de UI de Auton**: el espacio de trabajo de un proyecto, con **dos pantallas**,
**el panel izquierdo rehecho como lista de workers**, y **los bloques de trabajo anidados en el hilo**.

## Regla de oro del diseño

**Mismo estilo de ZCode, UI nueva.** Se reutilizan **componentes, tokens y tipografía** de
`packages/ui/src`; lo nuevo son **estados y animaciones**. Nada de un design system propio.

Y una regla que no se negocia: **de un vistazo tiene que quedar claro qué es el orquestador y qué es un
worker.** Etiqueta, color o forma distinta. No basta con el nombre.

## Pantalla 1 — Lista de proyectos

- Los proyectos, ordenados (por lo más reciente).
- **Botón de crear proyecto** que pide **dos cosas obligatorias**: **nombre** y **ruta** de la carpeta. Sin
  las dos, no se abre nada. *(Esto es lo que evita que un proyecto herede cosas de otro.)*
- Cada fila: nombre, ruta, y si tuvo actividad reciente.
- Al hacer clic: entra al espacio del proyecto.

## Pantalla 2 — Espacio del proyecto

Es **el espacio de un proyecto, y solo uno a la vez**. Se compone de tres zonas:

### 2.1 El hilo del orquestador (centro, lo principal)

- Es **una conversación**, no un panel de control. Arriba del hilo, el nombre del proyecto y la etiqueta
  **Orquestador**, que lo distingue de un worker.
- Aquí vive **la narración del orquestador** y, **anidados en el hilo**, los **bloques de trabajo**.
- **El humano solo escribe aquí.** No hay otro campo de texto en la pantalla.

### 2.2 El panel izquierdo: **los workers**

- **No se apaga el panel: se rehace.** Deja de listar proyectos y tareas de ZCode.
- **Una fila por worker**, con:
  - su nombre (`worker 1`, `worker 2`… o el que el orquestador le ponga),
  - **su estado en vivo** (`trabajando`, `preguntando`, `esperando`, `bloqueado`, `terminado`),
  - **su tiempo corriendo**,
  - y **su control de parada** (botón para detenerlo a mano).
- Las vistas de tareas (`Timeline`, agrupado, proyectos) muestran **solo la conversación del
  orquestador de cada proyecto**. Los chats legados y las sesiones de worker no se listan, no se
  editan y no se promueven a orquestador al seleccionarlos.
- **Clicable**: al abrir una fila se ve **su conversación completa** y **lo que hace en tiempo real** —
  igual que el chat de un proyecto normal, pero **sin campo de texto**: al worker no se le escribe.
- Desde la fila se puede **volver al hilo** del orquestador ("atrás" del panel).
- Referencia visual que pidió Edi: el bloque de tareas de **Grok Build** (fila con el reloj, el estado y
  los botones de parar/cerrar).

### 2.3 Los bloques anidados en el hilo

Dentro de la conversación, y en orden con el texto:

| Bloque | Qué muestra |
|---|---|
| **Trabajo** | Los workers de ese tramo, uno por línea, **con su reloj** y su última señal. Cabecera con el tiempo del tramo. Se **expande y se contrae**. |
| **Plan** | El plan del proyecto: sprints con su estado, su dueño y su criterio de hecho. *(La tarjeta del plan ya está en construcción por otra sesión: `packages/ui/src/auton/plan-card.tsx`.)* |
| **Evidencia** | Al cerrar un sprint: el comando que se corrió, su salida y los archivos tocados. Es la prueba de que está bien. |

### 2.4 La regla de layout: crónica intercalada (propuesta, pendiente del visto bueno de Edi)

**Esto no es un retoque de color: es el cambio que hace que se sienta un chat único y vivo.** Hoy el hilo
usa el agrupado de ZCode: un bloque colapsable tipo "trabajó X segundos" y **la respuesta final debajo**.
Esa forma es de un agente que **hace** el trabajo. El orquestador **no hace el trabajo: lo dirige**, así que
esa forma sobra.

**La regla:**

> El hilo es **una crónica**: narración → bloque de trabajo del tramo → narración → bloque → … y así
> indefinidamente, **sin cerrar el turno**.

- **Se acabó el bloque por turno.** No hay "trabajó Xs" con la respuesta abajo: hay **narración del
  orquestador**, y **un bloque por worker** (no por turno), que se abre y se cierra sin límite.
- **El trabajo no tiene "fase de work" y "fase de respuesta".** Todo ocurre **en el mismo hilo y a la vez**:
  el orquestador puede estar narrando, un worker trabajando y otro preguntando, sin que nada espere a nada.
- **Dónde se cambia**: los componentes que hoy agrupan por turno — `ConversationTimeline` y
  `ConversationTurnGroup` — pasan a componer por **evento en orden**: narración, canal de worker, evento
  del sistema, pregunta.
- **Nada de huecos**: si el orquestador espera, lo dice; si no tiene nada que decir, marca el tramo en
  espera y sigue vivo.

**Por qué importa tanto**: sin esto, en reposo la app **se siente como un agente normal**, y toda la
promesa —multiagente, un solo chat, el orquestador como director— se queda invisible aunque el código la
cumpla.

### 2.5 Los eventos: mismo tratamiento que los de ZCode

- **El evento de pregunta de un worker se camufla como un evento más del bloque de trabajo**: una fila,
  como las demás. Ni banner centrado, ni color propio, ni salto de layout.
- **Los workers no preguntan al humano.** El worker pregunta **al orquestador**; el orquestador decide si
  responde él o si le pregunta al humano, y para eso usa **la tool de preguntas que ZCode ya trae**.
- Lo mismo para el resto de eventos: **copiar el tratamiento que ZCode ya tiene** para sus filas de
  herramientas. Si algo se ve raro, es que se inventó en vez de copiarse.

### 2.6 Colores: solo los de ZCode (corrección pedida)

- **Nada de colores nuevos.** Ni azul para los workers, ni ámbar o verde propios: se usan **los tokens de
  ZCode**. Si ZCode no tiene un color para "pregunta" o "espera", se resuelve con **neutros y un solo
  acento**, igual que sus propias filas.
- **El estado se distingue por forma y palabra** —etiqueta, punto, parpadeo— **no por un arcoíris**. Cinco
  estados no son cinco colores.

> **Pendiente**: estas tres reglas (2.4, 2.5 y 2.6) las propone Grok y esperan el visto bueno de Edi antes
> de tocar la interfaz.

## Estados y animaciones (lo nuevo)

- **Estado por worker**: los cinco de arriba, con color distinto. Y **parpadeo suave** cuando lleva mucho
  sin dar señales.
- **El reloj se mueve siempre**: si un worker está vivo, su tiempo corre; si se queda callado, se ve
  "sin señales hace Ns" — **un worker callado se ve callado, no exitoso**.
- **La entrada de un bloque de trabajo** aparece con una animación corta (no un salto).
- **Nada de spinners decorativos**: el progreso se muestra con hechos (última línea del worker), no con
  ruedas que giran.

## Qué reutilizar (dónde mirar en el código)

- **El panel y su navegación**: `packages/ui/src/project-sidebar/ProjectSidebarNavigation.tsx`, `TaskList.tsx`, `WorkspaceSidebar.tsx`.
- **La vista de una sesión** (la corriente de un agente): ya existe; se **reutiliza** para el detalle del worker.
- **La tarjeta del plan**: `packages/ui/src/auton/plan-card.tsx` (en construcción).
- **Los tokens y la tipografía**: donde están definidos en `packages/ui/src`. No introducir colores ni fuentes nuevas.

## Qué NO toca este trabajo

- **Ni el orquestador ni el motor**: esta es pantalla y navegación.
- **Ni el motor de edición de ZCode.**
- **Ni los nombres del producto**: se dice **worker**, nunca "programador".

## Orden de construcción sugerido

1. **Pantalla 1** (lista de proyectos + creación con nombre y ruta). Es la más fácil y desbloquea todo.
2. **El panel izquierdo** con la lista de workers y su **control de parada** (aunque los datos aún vengan
   de lo que hay: estado y tiempo).
3. **El detalle del worker** reutilizando la vista de sesión, sin campo de texto.
4. **Los bloques anidados** en el hilo: trabajo primero, evidencia después; el plan ya lo trae la otra sesión.

## Cómo se sabe que está bien

- Las **pruebas 16** de `context/PRUEBAS-QUE-PROMETEMOS.md` (el espacio del proyecto).
- Y la prueba de la frase única: **cada zona se explica en una frase.** Si no, sobra.
