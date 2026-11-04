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

## Pantalla 1 — Entrada de la app: proyectos

- La app abre aquí, con el proyecto anterior cerrado. **No hay chat activo ni workers a la vista.**
- El panel izquierdo muestra **solo proyectos**: nombre, ruta y botón `+` para crear uno. Sin chats,
  tareas, Automations, Plugin Marketplace ni buscador de tareas.
- El centro **no tiene compositor**. Muestra la lista de proyectos con nombre, ruta y un **recap en
  una línea** del último trabajo de cada uno. Si no hay trabajo, dice `Sin sesiones todavía.`
- **Elegir una fila** (en el centro o en el panel) entra al proyecto. **Crear proyecto** pide nombre y
  ruta; al guardarlo se entra también. En ese momento el panel cambia a workers y aparece el hilo del
  orquestador.
- La pantalla se reutiliza del draft existente para el armazón; el resumen central es nuevo y
  minimalista.

## Pantalla 2 — Espacio del proyecto

Es **el espacio de un proyecto, y solo uno a la vez**. Se compone de tres zonas:

### 2.1 El hilo del orquestador (centro, lo principal)

- Es **una conversación**, no un panel de control. Arriba del hilo, el nombre del proyecto.
- Aquí vive **la narración del orquestador** y, **anidados en el hilo**, los **bloques de trabajo**.
- **El humano solo escribe aquí.** No hay otro campo de texto en la pantalla.

### 2.2 El panel izquierdo: **el proyecto y sus workers**

- **No se apaga el panel: se rehace.** La cabecera muestra **el proyecto activo como una fila nativa**
  (icono de carpeta + nombre, seleccionada), **sin el logo de ZCode**. Al pulsarla se abre un selector
  que lista **solo proyectos**; no hay chats, tareas ni botón de crear tarea dentro del proyecto.
- **Una fila por worker**, con el estilo de lista del chat normal de ZCode:
  - icono de estado a la izquierda,
  - **el nombre real del encargo/chat** (la descripción con la que se creó), no `worker N`,
  - **su estado en vivo** en el icono (`trabajando`, `preguntando`, `esperando`, `bloqueado`,
    `terminado`) y **su reloj** a la derecha; el silencio se marca con un punto pulsante,
  - **cuántos subagentes creó** (icono de rama + número, solo cuando hay). La cuenta sale de la
    sesión de cada worker, no solo del worker abierto; si el worker no creó ninguno, no se pinta nada,
  - y **su control de parada**, visible al pasar el ratón.
- En la **vista del orquestador no se listan subagentes**: solo agentes completos. Al abrir un worker,
  sus subagentes aparecen en el panel izquierdo y se abren a la derecha como un chat normal. Si el
  worker abierto no creó ninguno, el grupo `Subagentes` no aparece.
- El **panel derecho `Subagents`** lista solo subagentes (running/ended). No tiene el toggle
  `Espacio`/`Workers` ni el agregado que mezclaba todos los agentes; su pestaña se llama `Workers`.
- Los workers se agrupan por rol/motor (`Agentes ZCode`, `Subagentes`, `Muse Code`) con cabeceras
  plegables. La cabecera **Workers** también se pliega para ocultar la lista completa.
- **No hay vistas nativas de ZCode** (`Timeline`, agrupado, lista de tareas) ni sección `Tasks` en este
  panel. El proyecto es el encabezado; el hilo central no lleva la etiqueta `Orquestador`.
- **Clicable**: al abrir una fila se ve **su conversación completa directamente**, sin resumen ni
  cabecera separadora; la vuelta es un botón flotante sobre el chat. El worker conserva el chat
  normal de ZCode (compositor, modelo, permisos y acciones de la conversación); un subagente se
  observa en solo lectura.
- Referencia visual que pidió Edi: la lista de chats normal de ZCode (icono, nombre y acción), no una
  tarjeta con badge y segunda línea.

El contador no se deduce del hilo del orquestador: cada sesión de worker es su propia autoridad.

```text
sidebar (agentes completos)
  └─ useAutonSubagentCounts
       └─ zcodeAgentService.listSessionSubagents(sessionId del worker, endedLimit = 1)
            └─ childSessionIds.length → fila del worker (solo si > 0)
```

### 2.3 Los bloques anidados en el hilo

Dentro de la conversación, y en orden con el texto:

| Bloque | Qué muestra |
|---|---|
| **Trabajo** | Los workers de ese tramo, uno por línea, **con su reloj** y su última señal. Cabecera con el tiempo del tramo. Se **expande y se contrae**. |
| **Plan** | El plan del proyecto: sprints con su estado, su dueño y su criterio de hecho. *(La tarjeta del plan ya está en construcción por otra sesión: `packages/ui/src/auton/plan-card.tsx`.)* |
| **Evidencia** | Al cerrar un sprint: el comando que se corrió, su salida y los archivos tocados. Es la prueba de que está bien. |

### 2.4 La regla de layout y los eventos

**La spec de layout es [`context/UI-CHAT-INTERCALADO.md`](./UI-CHAT-INTERCALADO.md)**, y manda ella.
Resumen: el hilo es **una crónica intercalada** (narración → canal de worker → evento → narración…), sin
bloque por turno; el evento de pregunta de un worker **se camufla** como una fila más; los workers preguntan
**al orquestador**, y para preguntarle al humano se usa **la tool nativa de ZCode**; y **solo se usan los
tokens de ZCode**, sin colores nuevos.

## Estados y animaciones (lo nuevo)

- **Estado por worker**: los cinco de arriba, con color distinto. Y **parpadeo suave** cuando lleva mucho
  sin dar señales.
- **El reloj se mueve siempre**: si un worker está vivo, su tiempo corre; si se queda callado, se ve
  "sin señales hace Ns" — **un worker callado se ve callado, no exitoso**.
- **La entrada de un bloque de trabajo** aparece con una animación corta (no un salto).
- **Nada de spinners decorativos**: el progreso se muestra con hechos (última línea del worker), no con
  ruedas que giran.

## Qué reutilizar (dónde mirar en el código)

- **El panel y su navegación**: `packages/ui/src/project-sidebar/ProjectSidebarListHeader.tsx`,
  `AutonProjectPicker.tsx`, `packages/ui/src/auton/project-space/WorkerPanel.tsx`.
- **El estilo de fila**: `packages/ui/src/TaskListItem.tsx` (icono, nombre, acción; una sola línea).
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
