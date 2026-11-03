# Las pruebas de lo que prometemos

> **Una prueba por promesa.** Esto no es la suite de tests del código: es la lista de casos reales que
> hay que correr para poder **decir en voz alta** que Auton hace lo que dice, y para **medir si una
> mejora del orquestador mejoró de verdad**.
>
> Regla: **cada vez que se toca el prompt del orquestador, se vuelven a correr.** Si no, se está
> adivinando.

## Cómo se usa

- Cada prueba dice **qué prometemos**, **cómo se prueba** (qué se le pide), y **qué tiene que verse**.
- Se corren **a mano** y se anota el resultado con la fecha. El día de la demo se corre la lista entera.
- Si una prueba falla, **no se arregla el texto de la promesa: se arregla el sistema** (o se deja de
  prometer).
- Las marcadas **[auto]** se pueden automatizar y deberían serlo: son las que además protegen contra
  romper cosas al tocar el prompt.

## El primer gran cambio de UI (y dónde va)

**Es el espacio del proyecto**, y es trabajo de Edi, después de la tarjeta del plan (que ya se está
construyendo). Tiene tres piezas:

1. **Navegación de dos pantallas**: la lista de proyectos → el espacio del proyecto y "atrás" (D6).
2. **El espacio de la izquierda rehecho**: los **workers**, una fila por cada uno, **clicables** para ver
   su conversación y lo que hacen **en vivo**, **con control de parada** y **sin campo de texto** (al
   worker solo le habla el orquestador). Mismo estilo de ZCode, con **estados y animaciones nuevas**.
3. **Los bloques anidados** en el hilo: trabajo, plan y evidencia, con sus relojes.

Esto es lo que hace que el multiagente **se sienta** y no se administre.

---

## Las pruebas

### 1. El orquestador parte el trabajo en proporción **[auto]**
- **Qué prometemos**: no infla lo pequeño ni aplana lo grande.
- **Cómo se prueba**: dos encargos. Uno de una línea (cambiar un texto) y uno grande (un proyecto con
  varios frentes).
- **Qué tiene que verse**: 1 o 2 sprints en el pequeño; entre 8 y 20 en el grande. Y en el pequeño,
  **cero** exploración del repo antes de despachar.

### 2. No termina respuestas: narra sin huecos
- **Qué prometemos**: nunca te deja sin saber qué pasa.
- **Cómo se prueba**: lanza un trabajo y **no toques nada durante tres minutos**.
- **Qué tiene que verse**: al menos una línea suya entre cada acción —cuando manda a alguien, cuando
  espera, cuando algo cierra—, y **ningún tramo mudo de más de un minuto**.

### 3. Canales de trabajo anidados, varios a la vez **[auto]**
- **Qué prometemos**: trabajar en varios frentes desde un solo chat.
- **Cómo se prueba**: pide dos cosas que no se pisen (un arreglo de interfaz y uno de backend).
- **Qué tiene que verse**: **dos workers** dentro del bloque de trabajo, **cada uno con su reloj
  corriendo**, y poder abrir cada uno para ver lo suyo.

### 4. El canal rápido, en los dos sentidos **[auto]**
- **Qué prometemos**: los workers hablan con el orquestador mientras trabajan, y él les responde.
- **Cómo se prueba**: un encargo deliberadamente ambiguo, para que el worker necesite preguntar.
- **Qué tiene que verse**: la pregunta del worker, la respuesta del orquestador, y **el worker
  siguiendo** sin haber cerrado su turno.

### 5. Nada se cierra sin evidencia **[auto]**
- **Qué prometemos**: "listo" no cuenta.
- **Cómo se prueba**: deja que un worker reporte DONE sin haber corrido nada.
- **Qué tiene que verse**: el sprint **no** se cierra; el orquestador pide la prueba o lo manda a
  verificarlo.

### 6. Revisión en dos etapas, sobre el mismo directorio **[auto]**
- **Qué prometemos**: nadie se aprueba a sí mismo.
- **Cómo se prueba**: un sprint de trabajo real.
- **Qué tiene que verse**: primero una revisión de contrato (¿cumple el criterio de hecho?) y después una
  de calidad, hechas **por otro**, y trabajando sobre **el mismo directorio** donde se escribió el código.
  Y si el revisor encuentra problemas, el sprint **no** se cierra.

### 7. El orquestador no escribe el producto **[auto]**
- **Qué prometemos**: dirige, no implementa.
- **Cómo se prueba**: pídele directamente que escriba él un archivo.
- **Qué tiene que verse**: se niega y crea el encargo para un worker. La negativa **viene del sistema**,
  no de una recomendación en el prompt.

### 8. Los límites se escriben, se versionan y no se aflojan **[auto]**
- **Qué prometemos**: la autonomía está gobernada.
- **Cómo se prueba**: cambia un límite del contrato; y aparte, intenta que un worker lo cambie.
- **Qué tiene que verse**: el cambio queda **registrado con versión, quién y cuándo**; y el intento del
  worker se rechaza, pero **su reporte** de que está mal calibrado sí se acepta.

### 9. Si no sabe decidir, pregunta **[auto]**
- **Qué prometemos**: no avanza a ciegas.
- **Cómo se prueba**: un encargo con un criterio de hecho que no se puede comprobar con una máquina.
- **Qué tiene que verse**: **pregunta**, y no sigue adelante.

### 10. Puedes escribir mientras hay una pregunta abierta
- **Qué prometemos**: tu mensaje nunca queda detrás de un formulario.
- **Cómo se prueba**: cuando haya una pregunta abierta, escribe **otra cosa** distinta.
- **Qué tiene que verse**: tu mensaje entra primero; la pregunta **se reformula** con lo que dijiste o
  **se retira sola** si ya no aplica.

### 11. Pregunta por algo viejo y contesta desde el registro **[auto]**
- **Qué prometemos**: no pierde la historia.
- **Cómo se prueba**: en un chat largo, pregunta por qué se tomó una decisión de hace veinte turnos.
- **Qué tiene que verse**: la respuesta sale del **registro**, con punteros, y si no está, dice que no
  está en vez de inventarlo.

### 12. Dos motores, mismo contrato **[auto]**
- **Qué prometemos**: el motor es un enchufe.
- **Cómo se prueba**: el mismo encargo, una vez con el motor de casa y otra con Muse Code, en **dos
  entornos separados**.
- **Qué tiene que verse**: el **mismo encargo**, el **mismo reporte de estado** y la **misma exigencia de
  evidencia** en los dos. Y el revisor comparando los dos resultados.

### 13. Parar a un worker a mano
- **Qué prometemos**: tú tienes el botón.
- **Cómo se prueba**: detén un worker mientras trabaja.
- **Qué tiene que verse**: se detiene, **lo dice en el hilo**, y su trabajo queda **bloqueado con el
  motivo escrito** — nunca como "fallido" y nunca en silencio.

### 14. Deshacer devuelve los archivos idénticos **[auto]**
- **Qué prometemos**: el trabajo malo se revierte sin daño.
- **Cómo se prueba**: revierte un sprint con archivos creados, modificados y con finales de línea mixtos.
- **Qué tiene que verse**: los modificados vuelven **byte a byte**, los creados desde cero
  **desaparecen**, un archivo tocado después **no se pisa** (conflicto), repetir la orden no hace nada
  (idempotente), y todo queda anotado en el registro.

### 15. La métrica no se puede maquillar **[auto]**
- **Qué prometemos**: la cifra dice la verdad.
- **Cómo se prueba**: una corrida que **falla** el criterio de hecho.
- **Qué tiene que verse**: entra como **fallo**, no como "menos intervenciones"; y la cifra se reporta
  sobre **todos** los intentos, no solo los exitosos.

### 16. El espacio del proyecto (la UI)
- **Qué prometemos**: el multiagente se siente, no se administra.
- **Cómo se prueba**: entra a un proyecto, pide dos trabajos, y usa la interfaz sin tocar nada más.
- **Qué tiene que verse**: **dos pantallas** (lista de proyectos y espacio del proyecto, con "atrás"); a la
  izquierda **los workers**, clicables, **en vivo**, con **parada manual** y **sin campo de texto**; y se
  distingue **de un vistazo** qué habla el orquestador y qué hace un worker.

### 17. El orquestador ELIGE la herramienta, no la reimplementa **[auto]**
- **Qué prometemos**: lo que existe, se usa. Una capacidad sin línea en el prompt es código muerto.
- **Cómo se prueba**: pedirle en una sesión real "deshaz el sprint 2" y, aparte, "escribe el plan".
- **Qué tiene que verse**: la llamada a **AutonRevert** (con `itemId` del sprint) y a **AutonPlan** en el
  hilo; el orquestador **no** intenta revertir a mano con `Bash` ni `Write`.
- **Cómo se comprueba sin modelo**: `core/tests/auton-four-pieces.test.ts` verifica que la herramienta
  está registrada, que su nombre aparece en la sección de prompt que se ensambla y que la sección está
  incluida en el builder. La elección del modelo requiere la corrida con modelo real.

---

## Cobertura automatizada

| Prueba | Archivo |
| --- | --- |
| 2. No termina respuestas | `core/tests/auton-real-dispatch-runtime.test.ts`, `auton-live-turn-runtime.test.ts`, `auton-live-loop.test.ts` |
| 3. Canales anidados y eventos despertadores | `ui/test/autonThreadChannels.test.tsx` (los tres tipos desde el mapeo real), `ui/test/autonSubagentChannel.test.ts`, `bootstrap/tests/auton-thread-question-projection.test.ts` |
| 4. Canal rápido bidireccional | `core/tests/auton-fast-channel-runtime.test.ts` |
| 8. Límites versionados y no relajables | `core/tests/auton-limits-guard.test.ts`, `auton-plan-tool.test.ts` |
| 9. Si no sabe decidir, pregunta | `core/tests/auton-limits-governance.test.ts`, `auton-four-pieces.test.ts` |
| 14. Deshacer devuelve los archivos idénticos | `core/tests/auton-revert.test.ts`, `auton-revert-e2e.test.ts`, `adapters/tests/auton-revert-bytes.test.ts` |
| 17. El orquestador elige la herramienta | `core/tests/auton-four-pieces.test.ts` |

Las pruebas 1, 5, 6, 7, 10, 11, 12, 13, 15 y 16 siguen siendo corridas a mano con modelo real.

---

## Lo que estas pruebas protegen

No son para la demo: son para **no engañarnos**. El día que se cambie el prompt del orquestador, estas
dieciséis pruebas dicen si mejoró o si solo cambió. Y el día de la demo, son la respuesta a la pregunta
incómoda del jurado: **"¿y cómo sé que eso es cierto?"** — porque hay una prueba por promesa, y se corrió
ayer.

### 1. El orquestador parte el trabajo en proporción **[auto]**
- **Qué prometemos**: no infla lo pequeño ni aplana lo grande.
- **Cómo se prueba**: dos encargos. Uno de una línea (cambiar un texto) y uno grande (un proyecto con
  varios frentes).
- **Qué tiene que verse**: 1 o 2 sprints en el pequeño; entre 8 y 20 en el grande. Y en el pequeño,
  **cero** exploración del repo antes de despachar.


### 4. El canal rápido, en los dos sentidos **[auto]**
- **Qué prometemos**: los workers hablan con el orquestador mientras trabajan, y él les responde.
- **Cómo se prueba**: un encargo deliberadamente ambiguo, para que el worker necesite preguntar.
- **Qué tiene que verse**: la pregunta del worker, la respuesta del orquestador, y **el worker
  siguiendo** sin haber cerrado su turno.


### 6. Revisión en dos etapas, sobre el mismo directorio **[auto]**
- **Qué prometemos**: nadie se aprueba a sí mismo.
- **Cómo se prueba**: un sprint de trabajo real.
- **Qué tiene que verse**: primero una revisión de contrato (¿cumple el criterio de hecho?) y después una
  de calidad, hechas **por otro**, y trabajando sobre **el mismo directorio** donde se escribió el código.
  Y si el revisor encuentra problemas, el sprint **no** se cierra.


### 8. Los límites se escriben, se versionan y no se aflojan **[auto]**
- **Qué prometemos**: la autonomía está gobernada.
- **Cómo se prueba**: cambia un límite del contrato; y aparte, intenta que un worker lo cambie.
- **Qué tiene que verse**: el cambio queda **registrado con versión, quién y cuándo**; y el intento del
  worker se rechaza, pero **su reporte** de que está mal calibrado sí se acepta.


### 14. Deshacer devuelve los archivos idénticos **[auto]**
- **Qué prometemos**: el trabajo malo se revierte sin daño.
- **Cómo se prueba**: revierte un sprint con archivos creados, modificados y con finales de línea mixtos.
- **Qué tiene que verse**: los modificados vuelven **byte a byte**, los creados desde cero
  **desaparecen**, un archivo tocado después **no se pisa** (conflicto), repetir la orden no hace nada
  (idempotente), y todo queda anotado en el registro.


### 15. La métrica no se puede maquillar **[auto]**
- **Qué prometemos**: la cifra dice la verdad.
- **Cómo se prueba**: una corrida que **falla** el criterio de hecho.
- **Qué tiene que verse**: entra como **fallo**, no como "menos intervenciones"; y la cifra se reporta
  sobre **todos** los intentos, no solo los exitosos.


### 18. El worker real: sesión completa, con navegador y canal **[auto]**
- **Qué prometemos**: un programador puede construir su trabajo y probarlo él mismo, y contarlo por el canal.
- **Cómo se prueba**: un cambio de interfaz despachado en modo sesión (`worker_mode: "session"`), con la instrucción de abrirlo y revisarlo en su navegador.
- **Qué tiene que verse**: el worker con **su propia carpeta** y **su propio navegador**; un mensaje suyo por el canal con lo que vio; la fila del worker en el espacio del proyecto con su reloj, su estado y su transcripción; y poder **detenerlo a mano**. Con el interruptor apagado, el mismo encargo vuelve a comportarse como un subagente.

### 19. read: contexto con rutas y ni un archivo tocado **[auto]**
- **Qué prometemos**: el modo `read` consigue contexto para decidir sin poder modificar el proyecto.
- **Cómo se prueba**: pide "lee cómo está montado X y dime dónde tocar Y" con `mode: "read"`.
- **Qué tiene que verse**: un resumen **con rutas** de archivo; **ninguna entrada nueva** en `.auton/changes.jsonl` (el diario no registra un solo archivo); y el worker sin herramientas de escritura en su juego.

### 20. research: recomendación con razones, no una lista de enlaces **[auto]**
- **Qué prometemos**: el modo `research` ayuda a decidir entre alternativas externas sin tocar código.
- **Cómo se prueba**: pide comparar dos alternativas externas con `mode: "research"`.
- **Qué tiene que verse**: una **recomendación con razones** y fuentes citadas; **no** una entrega en forma de lista de enlaces; y el diario **sin entradas** de archivos.

### 21. debug: el comando que reproduce el fallo **[auto]**
- **Qué prometemos**: el modo `debug` señala la causa y deja reproducir el fallo, sin arreglarlo.
- **Cómo se prueba**: un fallo reproducible con `mode: "debug"`.
- **Qué tiene que verse**: **el comando exacto** que reproduce el fallo y la **causa raíz** señalada; ningún arreglo aplicado: el diario no registra ediciones de código y el arreglo queda para un `build`.

### 22. refactor: cambia la forma, los tests siguen verdes **[auto]**
- **Qué prometemos**: el modo `refactor` cambia la forma sin cambiar el comportamiento.
- **Cómo se prueba**: un refactor acotado con `mode: "refactor"`.
- **Qué tiene que verse**: **la suite previa sigue en verde**, el comportamiento observable no cambió y el reporte dice qué se movió y qué no.

### 23. Muse Code como motor del worker **[auto]**
- **Qué prometemos**: un sprint puede correr en Muse Code con el mismo brief, modo, evidencia y REPORTE que en el motor de casa.
- **Cómo se prueba**: despacha con `engine: "muse"` un encargo mínimo en una carpeta propia y pide que cierre con REPORTE.
- **Qué tiene que verse**: la sonda de versión, el worker corriendo en **su carpeta**, su salida/progreso, el **REPORTE con uno de los cuatro estados** y la parada. Si Muse no está instalado o autenticado, el despacho **falla explícito** y no cae a ZCode. En `read` y `research` no puede escribir (el adaptador apaga escritura y shell).
- **Transporte**: el camino conversacional usa `muse serve` (MSP) y permite más entradas en la misma sesión; `exec` queda como alternativa de una pasada (`AUTON_MUSE_TRANSPORT=exec`).

### 24. El worker sigue hablando en la misma sesión **[auto]**
- **Qué prometemos**: el orquestador puede mandar más de una entrada al mismo worker, y las respuestas llegan en orden sobre la misma sesión y la misma carpeta.
- **Cómo se prueba**: en ZCode, espera a que el worker termine y mándale dos mensajes seguidos; en Muse, mándale un segundo mensaje mientras corre.
- **Qué tiene que verse**: la primera respuesta, la segunda y la tercera, **el mismo id de sesión y la misma carpeta**; en Muse, la segunda entrada entra como steer y la sesión sigue viva; en ZCode, la reanudación conserva el contexto. La conversación completa queda en el detalle del worker.

### 25. La conversación y las sesiones de los workers se pueden ver **[auto]**
- **Qué prometemos**: cada worker deja su conversación completa y su sesión indexada por motor, en orden de inicio.
- **Cómo se prueba**: abre el detalle de un worker ZCode y de uno Muse, y revisa el índice de workers del proyecto.
- **Qué tiene que verse**: mensajes del orquestador y del worker, filas de herramienta y cierre; y en el índice, motor, id de sesión del motor, carpeta, estado y tiempos, con el filtro por motor.

---

## Lo que estas pruebas protegen

No son para la demo: son para **no engañarnos**. El día que se cambie el prompt del orquestador, estas
dieciséis pruebas dicen si mejoró o si solo cambió. Y el día de la demo, son la respuesta a la pregunta
incómoda del jurado: **"¿y cómo sé que eso es cierto?"** — porque hay una prueba por promesa, y se corrió
ayer.
