# Arquitectura del orquestador de Auton

> **Esta es la spec de trabajo.** El documento que forkea una sesión nueva para construir el orquestador.
> Si algo aquí contradice a `AUTON-VISION.md`, manda la visión y hay que corregir este archivo.
>
> **Lo que NO se toca**: la interfaz de ZCode (se reutiliza), el motor de edición de ZCode (funciona y
> está intacto), y el panel lateral **se transforma, no se apaga**: deja de listar proyectos y tareas y
> pasa a listar **los workers del proyecto actual**. Ver `context/UI-ESPACIO-DEL-PROYECTO.md` y la D6.

---

## 1. El cambio de fondo: el orquestador no termina respuestas

Hoy funciona como un chat: recibe un mensaje, hace cosas y **cierra el turno**. Todo lo demás (workers,
revisiones) ocurre dentro de ese turno y, al terminar, el hilo queda mudo hasta que el humano escriba.
Eso falla en tres cosas:

1. El humano se queda sin saber nada entre turnos.
2. El orquestador no puede abrir trabajo nuevo mientras espera a los que ya corren.
3. El tiempo no se puede medir por trabajo: solo se ve "la tarea" entera.

**Lo que se construye**: un **bucle vivo** que recibe eventos y **narra por tramos**, donde cada tramo es
un sprint. El hilo deja de ser pregunta-respuesta y pasa a ser **una crónica del trabajo**.

## 2. Los eventos y sus prioridades

| Prioridad | Evento | De dónde |
|---|---|---|
| 1 | Mensaje del humano | el chat |
| 2 | Pregunta de un worker | canal rápido |
| 3 | Cierre, fallo o bloqueo de un worker | canal rápido |
| 4 | Latido y progreso | el sistema |

Nada de esto abre "un turno": **entra en el bucle** y el orquestador decide qué cuenta y cuándo.

## 3. La conversación se divide por sprints

Cada sprint es **un tramo con encabezado** en el hilo: qué se propuso, cuándo arrancó, qué worker lo
lleva, qué pasó y cómo cerró. El humano lee de arriba abajo y reconstruye la historia sin que nadie se la
explique. **Sin huecos**: si espera, lo dice; si no tiene nada que decir, marca el tramo en espera y
sigue vivo. Nada de relleno.

## 4. Varios canales de ejecución a la vez

Mientras narra, puede abrir trabajo nuevo: mandar otro worker, preguntar algo, revisar lo entregado. Su
bucle **no se bloquea esperando**: los resultados le llegan como eventos.

## 5. Los tres relojes

- **Por worker**: cuánto lleva trabajando y desde cuándo no da señales.
- **Por sprint**: cuánto tardó de punta a punta y cuánto de eso fue espera de otro.
- **Total de la tarea**: la suma, con los solapamientos contados una sola vez.

Sin esto no hay métrica posible.

## 6. Canal rápido orquestador ↔ worker

Hoy el worker reporta al final. Se necesita un canal **directo y de baja latencia** en los dos sentidos:
él recibe "voy por aquí / no sé / terminé / me bloqueé", y puede mandar "cambia de enfoque / te faltaba
este dato / para y reporta". Es el mecanismo que ya se probó a mano entre dos agentes, pero dentro del
producto.

## 7. Preguntas al humano, y qué pasa si escribe justo entonces

- Se pregunta **con frecuencia y con opciones**, no en prosa.
- **Si el humano escribe mientras hay una pregunta abierta**, su mensaje **no se encola detrás**: entra
  con prioridad 1, la pregunta se reformula con esa información si aplica, y si ya no hace falta **se
  retira sola**. Nunca hay que "responder el formulario" para que le hagan caso.
- Y si el orquestador **no sabe decidir** si algo está bien, pregunta en vez de seguir.

## 8. El programador NO es un subagente (corrección)

**Hoy sí lo es**, y es una limitación real: se le recorta el juego de herramientas, no tiene sesión
propia y no puede probar su trabajo como una sesión normal.

Lo que debe ser:
- **Sesión completa y de primera clase**, con **todo** el juego de herramientas.
- **Incluido el navegador interno para probar su propio trabajo.** Eso es del worker, **nunca del
  orquestador**: el orquestador no prueba clicando; el worker sí y entrega la prueba.
- Su propio entorno de trabajo, aislado de sus hermanos.
- Habla **solo** con el orquestador.
- La diferencia con una sesión normal no es *qué puede hacer*: es **a quién le reporta**.

El orquestador lo dirige por la **misma vía que la interfaz usa para manejar sesiones**: crear, hablar,
detener, leer.

## 9. El contexto de un bucle que no termina

### El problema
Un bucle infinito con contexto es imposible **si el contexto es la conversación**. El error de todos los
harnesses es ese: tratan el hilo como el contexto del modelo y cuando crece **lo resumen**. Resumir 800k
en 15k pierde cosas valiosas, siempre. El compacto no es la solución: es el síntoma.

### La decisión (punto medio, por etapas)
| Etapa | Qué se hace | Cuándo |
|---|---|---|
| **1. Ahora** | **Registrar todo en disco, sin resumir nada**: eventos, encargos, reportes, decisiones, artefactos y salidas de comandos, con identificador y referencias (objetivo → sprint → worker → artefacto → decisión). El contexto vivo sigue como hoy: contrato + sprint activo + últimos intercambios + compacto. | **Se hace ya** |
| **2. Cuando duela** | **Recuperación simple**: una herramienta de memoria que busque por texto en el registro y devuelva pocas líneas y punteros. Sin vectores, sin embeddings. | Se hace cuando el orquestador empiece a olvidar cosas que sí pasaron |
| **3. Más adelante** | Recuperación semántica (RAG de verdad) si la búsqueda por texto no alcanza | Solo si hace falta |

**Por qué el punto medio funciona**: la parte caras es la **recuperación inteligente**, no el registro.
Registrar es escribir archivos, y eso lo hace el sistema solo. Y en el caso del orquestador el contexto
se gasta sobre todo en **decisiones**, no en leer archivos (eso lo hacen los workers), así que aguanta
mucho más de lo que parece sin ningún truco.

**La regla que no se rompe**: **nada se tira**. Aunque el contexto vivo se compacte, el material original
queda en el registro y es recuperable.

### Lo que sí hay que adoptar de DeepSeek
Su "Inline vs Spill" y su **cadena de recuerdos** (cada objeto con identificador y referencias a los
relacionados) son exactamente la etapa 1 y 2. Su compacto, no.

## 10. El canal: por qué el multiagente se siente o no se siente

En todos los harness actuales los agentes son **sesiones separadas**: abres pestañas, cambias de una a
otra y tú eres el mensajero. El multiagente **no se siente: se administra**.

En Auton hay **un solo hilo** (el del humano) y dentro, **canales de trabajo anidados**: cada worker es
un canal que se abre y se cierra sin límite, con su reloj corriendo, y que habla con el orquestador en su
idioma (reporte de estado y preguntas). El humano ve la crónica; cuando quiere detalle, abre el canal de
ese worker.

**La escena que lo demuestra** (y es la escena de demo): pedir un arreglo de interfaz mientras otro
worker trabaja en el backend, **todo en el mismo chat**, y que el orquestador reparta sin perder el
hilo.

## 11. Muse Code como motor del worker (sin reemplazar nada)

### Qué reemplaza
El motor que **escribe el código** dentro del worker. **No** reemplaza al orquestador (sigue pensando con
el modelo que le pongamos), **no** reemplaza la interfaz, **no** reemplaza el motor de edición de ZCode.

### Cómo funciona
El **motor es una elección por sprint**, y la decide el orquestador al despachar:

```
sprint → worker → motor: [el de casa] | [Muse Code] | [otro]
La interfaz sigue siendo la de ZCode. El protocolo de reporte es el mismo para todos.
```

Por debajo es **un adaptador**, y esa forma ya está probada: en el prototipo hay **tres adaptadores
intercambiables** para el mismo papel (el CLI de Grok, OpenCode y el de casa) y el sistema elige uno sin
cambiar nada por encima. Muse Code entra como **un cuarto**: recibe el encargo escrito, trabaja en su
carpeta y **cierra con el reporte de estado** que el orquestador ya sabe leer.

### Lo que hay que verificar antes de prometer (cuatro pruebas mínimas)
1. Que se pueda lanzar **sin interacción**, con un encargo y una carpeta.
2. Que su salida se pueda **leer de a poco** (para el canal rápido) o solo al final.
3. Que respete la **carpeta de trabajo** indicada sin tocar fuera.
4. Cómo se **autentica**, y si eso permite dejarlo corriendo solo.

Si alguna falla, se dice y se busca la forma. Lo que no se hace es presentar "Muse Code dentro" sin
haberlo corrido.

### La pregunta dura: ¿cómo garantizas que hace lo mismo que el motor de ZCode?
**No se garantiza. Y no hay que garantizarlo.** La paridad de herramientas es una promesa imposible: son
programas distintos. Lo que se garantiza es **el contrato**:

- **El mismo encargo** (brief con objetivo, criterio de hecho, scope y límites).
- **El mismo reporte de estado**, con las mismas cuatro salidas.
- **La misma exigencia de evidencia** para cerrar: sin artefacto que pruebe el criterio de hecho, el
  sprint no se cierra — venga de donde venga el código.
- **La misma revisión independiente** encima, sin importar el motor.

Si un motor hace menos, **se nota en la evidencia y en la revisión**, y el orquestador tiene tres
salidas: cambiar de motor para ese sprint, partirlo en trozos más pequeños, o hacer él mismo la
verificación y dejarlo bloqueado con el motivo. Eso es más honesto y más fuerte que prometer paridad.

### Qué gana Auton
Dirige **herramientas de Meta** en vez de competir con ellas, y puede mostrarlo: *el mismo encargo, el
mismo protocolo de reporte y de evidencia, dos motores distintos, y Auton dirigiendo a los dos igual.*
Para la hackathon es el argumento del 25% (uso de herramientas de IA de Meta) sin regalar el resto.

## 12. Sprints, TODOs y modo goal: cómo se unifican

| Pieza | Qué es |
|---|---|
| **Goal** | El contrato y el modo de trabajo: qué se construye, restricciones, qué queda fuera, criterio de hecho global |
| **Sprint** | La **unidad de despacho**: tiene dueño, criterio de hecho y reloj |
| **TODO** | El plan **interno** de un worker: sus pasos. Se muestra **anidado** dentro de su canal |

**Regla para decidir si algo es un sprint**: un sprint se abre cuando hay un trabajo que **otro** puede
hacer, que **cabe** en una sesión de worker y que vas a **verificar por partes**. Si el trabajo cabe en
un worker y no lo vas a revisar por trozos, **no lo llames sprint: mándalo y ya**. Eso evita el error de
partir un archivo en diez sprints.

## 13. Lo que se trae del prototipo (`auton cat jam zcode`)

| Del prototipo | Valor | ¿Ya? |
|---|---|---|
| El prompt del orquestador probado (hizo un juego completo en 45s con 5 llamadas) | 80% de "el orquestador como ingeniero" | **Sí** |
| Reporte con estado que manda sobre el resultado del proceso | El canal por el que se entera de verdad | **Sí** |
| Revisión sobre el mismo directorio del que escribió | Sin eso el revisor revisa un sitio vacío | **Sí** |
| Despertar automático + latido de flota | Nunca te quedas sin saber qué pasa | **Sí** |
| Guardia que impide que el orquestador escriba producto | Sin él, se pone a programar y deja de dirigir | **Sí** |
| Topes de tamaño de plan (un archivo es una fila, no un equipo) | Evita 20 programadores para un pacman | **Sí** |
| Robustez: error de herramienta no mata al worker; no hay "fallidos", hay "bloqueado con motivo" | Aguanta una noche sin supervisión | **Sí** |
| Control de gasto (tokens por chat y tope) | Dejarlo solo sin esto es caro y a ciegas | **Sí**, mínimo |
| Selector de modelo y rotación | Útil, no diferencial | Después |
| Su interfaz y su forma de guardar datos | El desktop lo hace mejor | **No** |

## 16. La experiencia objetivo, escrita tal cual (esto es lo que se construye)

```
Tú:    Mejora el diseño del chat y arregla el error de inicio de sesión.

Auton: Voy a trabajar los dos frentes. Un programador revisa el diseño
       y otro investiga el inicio de sesión.

       ┌ Trabajo · 02:14 · [expandir] ───────────────────────────────┐
       │ Programador 1 — Diseño        · 02:14  ajustando el cuadro  │
       │                                        de mensajes          │
       │ Programador 2 — Inicio sesión · 01:58  la sesión no se      │
       │                                        restaura bien       │
       └─────────────────────────────────────────────────────────────┘

Auton: El problema de sesión parece estar en la recuperación del usuario.
       Le pedí que confirme la causa antes de tocarla.
```

Lo que hay que leer en esa escena, porque cada pieza es un requisito:
- **Una sola conversación.** El humano no abre pestañas ni cambia de sesión.
- **El bloque de trabajo es un canal anidado**: agrupa a los workers, se abre y se cierra sin límite,
  y **cada uno lleva su reloj**.
- **El reloj del bloque (02:14) es el del trabajo en curso**, no el total de la tarea.
- El orquestador habla **arriba y abajo** del bloque: antes para decir qué va a hacer y con quién,
  después para contar qué encontró y **qué decidió**. Sin huecos.
- Los workers hablan con el orquestador, **no con el humano**; lo que el humano ve de ellos es lo que el
  orquestador decide contar.

## 17. Corrección de vocabulario: el sprint es del orquestador

**Se decide** (corrección de Edi, aceptada): el **sprint pertenece al orquestador**. Es su unidad de
trabajo: tiene dueño (él), criterio de hecho, reloj y evidencia. Lo que el worker recibe **no es un
sprint**: es un **encargo** — el trozo de ese sprint que él puede hacer.

```
orquestador ──(sprint: criterio + reloj + evidencia)──► encargo ──► worker
```

Por qué importa: si el sprint fuera del worker, el orquestador sería un repartidor de tareas ajenas. Al
ser suyo, **él sigue el sprint**, decide qué manda en cada momento, cuándo cambia de enfoque y cuándo lo
cierra. Eso es dirigir.

Consecuencia práctica: en el tablero, **el sprint es del orquestador**; debajo aparecen los encargos
enviados, que son los que los workers ejecutan.

## 18. El motor: qué es Muse Code, dónde vive y qué ganamos

### Cómo se integra (y por qué no es una fusión de código)
Muse Code, igual que el CLI de ZCode o el de Grok, es **un programa que se instala aparte**. Auton **no
mete su código dentro**: lo **lanza, le da el encargo y lee su reporte**. Es exactamente lo que hace hoy
el prototipo con los motores que ya soporta: los busca en el sistema, elige uno y lo ejecuta en la
carpeta del worker.

Por tanto:
- **Sí hay que instalarlo aparte** (su CLI o su SDK, lo que ofrezca).
- El código de Auton **no lo contiene**: lo usa como una herramienta más.
- Y si algún día ofrece SDK embebible, se puede pasar a ese modo; eso se decide al verificar (punto 11).

### Lo que NO es el uso
No es que dos motores trabajen **sobre lo mismo a la vez**. Cada sprint corre en **un motor**, y el
orquestador elige cuál al despachar. Dos motores corriendo en paralelo significa **dos encargos
distintos**, no dos sobre el mismo archivo.

### Lo que sí ganamos
1. **El criterio de la hackathon**: usar herramientas de IA de Meta, de verdad y no de adorno.
2. **Resiliencia**: si un motor no está disponible o es malo para algo, se cambia sin cambiar nada más.
3. **Que se pueda añadir cualquier motor en el futuro.** Sí: **ese es el punto**. Auton es agnóstico del
   motor; el motor es un enchufe. Hoy: el de casa (ZCode), Muse Code, y mañana el que salga.
4. **Un duelo de motores**, opcional y honesto: el **mismo encargo**, dos motores, **dos entornos
   separados**, y el revisor compara los dos resultados. No para trabajar juntos, sino para elegir el
   mejor. Es una escena potente para la demo y no requiere nada nuevo: el reviewer ya existe.

### El límite que hay que decir en voz alta
Cada motor tiene **su propio sistema de permisos y aprobaciones**. Auton tiene que **mapear el suyo sobre
el del motor** (o desactivarlo donde no lo necesite), y eso es trabajo por motor. No es imposible, pero
tampoco es gratis, y prometerlo sin haberlo probado sería el mismo error que le criticamos a los packs de
prompts.


1. **Política de esfuerzo escrita en el encargo** de cada worker (regula la intensidad; hoy solo es
   recomendación). Es lo más pequeño y lo de más impacto.
2. **Límites escritos y versionados**: cuándo escala al humano, y el caso **"no sé decidir → pregunto"**.
   Es lo más nuevo que tenemos.
3. **Canal rápido + reporte de estado.**
4. **Registro durable en disco** (etapa 1 del punto 9). Barato y evita perder historia.
5. **El bucle vivo** con narración por sprints y canales anidados.
6. **Los tres relojes.**
7. **Preguntas con opciones** y el caso "el humano escribe mientras pregunto".
8. **El programador como sesión completa**, con navegador propio para probar.
9. **Motor por sprint** (Muse Code como cuarto adaptador).
10. **Tablero e inspector de evidencia** encima de todo.

## 15. Cómo se presenta (y con qué se prueba)

- **La demo deja de ser Lunar Móvil.** Se demuestra con **una tarea pequeña en un repositorio propio,
  commiteado y repetible delante del jurado**. Lunar queda como segundo caso.
- **Escenas a mostrar**: la narración por sprints sin huecos · los tres relojes · un worker que pregunta a
  mitad de sprint · **el humano escribiendo mientras la pregunta está abierta y la pregunta
  reformulándose sola** · el cierre con evidencia en pantalla · y la métrica visible.
- **Nada se presenta sin referencia citable**: cada capacidad afirmada, con ruta y commit. El prototipo
  **se commitea** o sus capacidades quedan marcadas como no verificadas.
