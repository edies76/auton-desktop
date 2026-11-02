# Arquitectura del orquestador continuo

> Decisión de arquitectura pedida por Edi. Es el cambio que separa a Auton de "un agente más".
> Sustituye al modelo de "pregunta → respuesta" por un **orquestador vivo que narra por sprints**.
> **No toca la interfaz de ZCode**: se reutiliza la suya.

## El cambio de fondo

Hoy el orquestador funciona como un chat: recibe un mensaje, hace cosas, **cierra el turno**. Todo lo
demás (workers, revisiones) ocurre *dentro* de ese turno y, cuando termina, el hilo se queda mudo
hasta que el humano escriba otra vez. Eso hace tres cosas mal:

1. El humano se queda sin saber nada entre turnos.
2. El orquestador no puede abrir trabajo nuevo mientras espera a los que ya corren.
3. El tiempo no se puede medir por trabajo: solo se ve "la tarea" entera.

**Lo que se construye en su lugar:** el orquestador **no termina respuestas**. Mantiene un **bucle vivo**
que recibe eventos y va **narrando por tramos**, y cada tramo es un sprint. El hilo deja de ser
pregunta-respuesta y pasa a ser **una crónica del trabajo**, dividida por sprints.

## Las ocho piezas

### 1. Bucle vivo, no turnos
El orquestador mantiene un proceso que escucha. Los eventos que le llegan son de cuatro tipos y tienen
prioridad distinta:

| Prioridad | Evento | De dónde |
|---|---|---|
| 1 | Mensaje del humano | el chat |
| 2 | Pregunta de un worker | el canal rápido |
| 3 | Cierre, fallo o bloqueo de un worker | el canal rápido |
| 4 | Latido y progreso | el sistema |

Nada de esto crea "un turno nuevo": **entra en el bucle** y el orquestador decide qué cuenta y cuándo.

### 2. La conversación se divide por sprints, no por respuestas
Cada sprint es **un tramo con su propio encabezado** en el hilo: qué se propuso, cuándo arrancó, qué
worker lo lleva, qué pasó y cómo cerró. El humano puede leer de arriba abajo y reconstruir la historia
completa sin que nadie se la explique.

Regla de oro: **no hay huecos**. Si el orquestador está esperando, lo dice. Si no tiene nada que decir,
no inventa relleno: marca el tramo como en espera y sigue vivo.

### 3. Varios canales de ejecución abiertos a la vez
Mientras narra, puede abrir trabajo nuevo: mandar otro worker, preguntar algo, revisar lo entregado.
Su bucle **no se bloquea esperando** a que un worker termine: los resultados le llegan como eventos.

### 4. Tiempos: por ejecución, por sprint y total
Tres relojes, todos visibles:
- **Por worker**: cuánto lleva trabajando y desde cuándo no da señales.
- **Por sprint**: cuánto tardó de punta a punta, y cuánto de ese tiempo fue espera de otro.
- **Total de la tarea**: la suma, con los solapamientos contados una sola vez.

Sin esto no hay métrica posible: "intervenciones humanas por entrega verificada" necesita saber cuánto
costó cada entrega.

### 5. Canal rápido orquestador ↔ worker
Hoy el worker reporta "al final". Se necesita un canal **directo y de baja latencia** en los dos
sentidos:
- Worker → orquestador: "voy por aquí", "esto no lo sé", "terminé", "me bloqueé".
- Orquestador → worker: "cambia de enfoque", "te faltaba este dato", "para y reporta".

Es el mismo mecanismo que ya probamos a mano con el buzón entre dos agentes, pero dentro del producto y
sin depender de nadie externo.

### 6. Preguntas al humano, y qué pasa si escribe justo entonces
- Se pregunta **con frecuencia y con opciones**, no en prosa.
- **Si el humano escribe mientras hay una pregunta abierta**, su mensaje **no se pierde ni se encola
  detrás**: entra con prioridad 1, la pregunta abierta se reformula con esa información si aplica, y si
  ya no hace falta se retira sola. El humano nunca tiene que "responder el formulario" para que le
  hagan caso.
- Y si el orquestador **no sabe decidir** si algo está bien, pregunta en vez de seguir.

### 7. El programador NO es un subagente (corrección)
**Hoy sí lo es**, y es una limitación real: se le recorta el juego de herramientas, no tiene sesión
propia y no puede probar su trabajo como lo haría una sesión normal.

Lo que debe ser:
- Una **sesión completa y de primera clase**, con **todo el juego de herramientas** de ZCode.
- **Incluido el navegador interno para probar su propio trabajo.** Eso es del worker, **nunca del
  orquestador**: el orquestador no prueba clicando; el worker sí, y entrega la prueba.
- Su propio entorno de trabajo, aislado del de sus hermanos.
- Habla **solo** con el orquestador, nunca con el humano.
- Y en el futuro, tan capaz como una sesión normal: la diferencia no es lo que puede hacer, es **a
  quién le reporta**.

El orquestador lo dirige por la misma vía que la interfaz usa para manejar sesiones: **crear, hablar,
detener, leer**. Nada de magia nueva.

### 8. El orquestador, extraíble (después)
Su valor no debería depender de esta app. Más adelante debería poder llevarse a otro sitio y seguir
siendo el mismo ingeniero. **Se deja para después**, solo se anota: implica diseñar su núcleo separado
de la interfaz, y hoy no toca.

## Lo que NO se hace ahora

- **No se toca la interfaz de ZCode.** Se reutiliza tal cual.
- **No se hace una interfaz propia del orquestador** (sin la división de proyectos y tareas a la
  izquierda). Es un cambio de rumbo grande y va después del producto.
- **No se toca el motor de edición.** Funciona y está intacto.

## Orden de construcción

1. **La política de esfuerzo en el encargo de cada worker** (la intensidad se escribe).
2. **Canal rápido orquestador ↔ worker** + reporte con estado.
3. **El bucle vivo** con los cuatro tipos de evento y la narración por sprints.
4. **Los tres relojes**.
5. **Preguntas con opciones y el caso "el humano escribe mientras pregunto"**.
6. **El programador como sesión completa, con navegador para probar**.
7. **Tablero e inspector de evidencia** encima de todo eso.

Los puntos 1 y 2 son los que se pueden verificar primero y los que ya tienen material probado en el
prototipo (`auton cat jam zcode`): ahí el programador **ya era un proceso aparte con su entorno**, el
reporte con estado existía, y el orquestador despertaba solo cuando la flota cambiaba.
