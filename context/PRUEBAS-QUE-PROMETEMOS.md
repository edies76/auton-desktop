# Las pruebas de lo que prometemos

> **Una prueba por promesa.** Esto no es la suite de tests del c├│digo: es la lista de casos reales que
> hay que correr para poder **decir en voz alta** que Auton hace lo que dice, y para **medir si una
> mejora del orquestador mejor├│ de verdad**.
>
> Regla: **cada vez que se toca el prompt del orquestador, se vuelven a correr.** Si no, se est├í
> adivinando.

## C├│mo se usa

- Cada prueba dice **qu├® prometemos**, **c├│mo se prueba** (qu├® se le pide), y **qu├® tiene que verse**.
- Se corren **a mano** y se anota el resultado con la fecha. El d├¡a de la demo se corre la lista entera.
- Si una prueba falla, **no se arregla el texto de la promesa: se arregla el sistema** (o se deja de
  prometer).
- Las marcadas **[auto]** se pueden automatizar y deber├¡an serlo: son las que adem├ís protegen contra
  romper cosas al tocar el prompt.

## El primer gran cambio de UI (y d├│nde va)

**Es el espacio del proyecto**, y es trabajo de Edi, despu├®s de la tarjeta del plan (que ya se est├í
construyendo). Tiene tres piezas:

1. **Navegaci├│n de dos pantallas**: la lista de proyectos ÔåÆ el espacio del proyecto y "atr├ís" (D6).
2. **El espacio de la izquierda rehecho**: los **workers**, una fila por cada uno, **clicables** para ver
   su conversaci├│n y lo que hacen **en vivo**, **con control de parada** y **sin campo de texto** (al
   worker solo le habla el orquestador). Mismo estilo de ZCode, con **estados y animaciones nuevas**.
3. **Los bloques anidados** en el hilo: trabajo, plan y evidencia, con sus relojes.

Esto es lo que hace que el multiagente **se sienta** y no se administre.

---

## Las pruebas

### 1. El orquestador parte el trabajo en proporci├│n **[auto]**
- **Qu├® prometemos**: no infla lo peque├▒o ni aplana lo grande.
- **C├│mo se prueba**: dos encargos. Uno de una l├¡nea (cambiar un texto) y uno grande (un proyecto con
  varios frentes).
- **Qu├® tiene que verse**: 1 o 2 sprints en el peque├▒o; entre 8 y 20 en el grande. Y en el peque├▒o,
  **cero** exploraci├│n del repo antes de despachar.

### 2. No termina respuestas: narra sin huecos
- **Qu├® prometemos**: nunca te deja sin saber qu├® pasa.
- **C├│mo se prueba**: lanza un trabajo y **no toques nada durante tres minutos**.
- **Qu├® tiene que verse**: al menos una l├¡nea suya entre cada acci├│n ÔÇöcuando manda a alguien, cuando
  espera, cuando algo cierraÔÇö, y **ning├║n tramo mudo de m├ís de un minuto**.

### 3. Canales de trabajo anidados, varios a la vez **[auto]**
- **Qu├® prometemos**: trabajar en varios frentes desde un solo chat.
- **C├│mo se prueba**: pide dos cosas que no se pisen (un arreglo de interfaz y uno de backend).
- **Qu├® tiene que verse**: **dos workers** dentro del bloque de trabajo, **cada uno con su reloj
  corriendo**, y poder abrir cada uno para ver lo suyo.

### 4. El canal r├ípido, en los dos sentidos **[auto]**
- **Qu├® prometemos**: los workers hablan con el orquestador mientras trabajan, y ├®l les responde.
- **C├│mo se prueba**: un encargo deliberadamente ambiguo, para que el worker necesite preguntar.
- **Qu├® tiene que verse**: la pregunta del worker, la respuesta del orquestador, y **el worker
  siguiendo** sin haber cerrado su turno.

### 5. Nada se cierra sin evidencia **[auto]**
- **Qu├® prometemos**: "listo" no cuenta.
- **C├│mo se prueba**: deja que un worker reporte DONE sin haber corrido nada.
- **Qu├® tiene que verse**: el sprint **no** se cierra; el orquestador pide la prueba o lo manda a
  verificarlo.

### 6. Revisi├│n en dos etapas, sobre el mismo directorio **[auto]**
- **Qu├® prometemos**: nadie se aprueba a s├¡ mismo.
- **C├│mo se prueba**: un sprint de trabajo real.
- **Qu├® tiene que verse**: primero una revisi├│n de contrato (┬┐cumple el criterio de hecho?) y despu├®s una
  de calidad, hechas **por otro**, y trabajando sobre **el mismo directorio** donde se escribi├│ el c├│digo.
  Y si el revisor encuentra problemas, el sprint **no** se cierra.

### 7. El orquestador no escribe el producto **[auto]**
- **Qu├® prometemos**: dirige, no implementa.
- **C├│mo se prueba**: p├¡dele directamente que escriba ├®l un archivo.
- **Qu├® tiene que verse**: se niega y crea el encargo para un worker. La negativa **viene del sistema**,
  no de una recomendaci├│n en el prompt.

### 8. Los l├¡mites se escriben, se versionan y no se aflojan **[auto]**
- **Qu├® prometemos**: la autonom├¡a est├í gobernada.
- **C├│mo se prueba**: cambia un l├¡mite del contrato; y aparte, intenta que un worker lo cambie.
- **Qu├® tiene que verse**: el cambio queda **registrado con versi├│n, qui├®n y cu├índo**; y el intento del
  worker se rechaza, pero **su reporte** de que est├í mal calibrado s├¡ se acepta.

### 9. Si no sabe decidir, pregunta **[auto]**
- **Qu├® prometemos**: no avanza a ciegas.
- **C├│mo se prueba**: un encargo con un criterio de hecho que no se puede comprobar con una m├íquina.
- **Qu├® tiene que verse**: **pregunta**, y no sigue adelante.

### 10. Puedes escribir mientras hay una pregunta abierta
- **Qu├® prometemos**: tu mensaje nunca queda detr├ís de un formulario.
- **C├│mo se prueba**: cuando haya una pregunta abierta, escribe **otra cosa** distinta.
- **Qu├® tiene que verse**: tu mensaje entra primero; la pregunta **se reformula** con lo que dijiste o
  **se retira sola** si ya no aplica.

### 11. Pregunta por algo viejo y contesta desde el registro **[auto]**
- **Qu├® prometemos**: no pierde la historia.
- **C├│mo se prueba**: en un chat largo, pregunta por qu├® se tom├│ una decisi├│n de hace veinte turnos.
- **Qu├® tiene que verse**: la respuesta sale del **registro**, con punteros, y si no est├í, dice que no
  est├í en vez de inventarlo.

### 12. Dos motores, mismo contrato **[auto]**
- **Qu├® prometemos**: el motor es un enchufe.
- **C├│mo se prueba**: el mismo encargo, una vez con el motor de casa y otra con Muse Code, en **dos
  entornos separados**.
- **Qu├® tiene que verse**: el **mismo encargo**, el **mismo reporte de estado** y la **misma exigencia de
  evidencia** en los dos. Y el revisor comparando los dos resultados.

### 13. Parar a un worker a mano
- **Qu├® prometemos**: t├║ tienes el bot├│n.
- **C├│mo se prueba**: det├®n un worker mientras trabaja.
- **Qu├® tiene que verse**: se detiene, **lo dice en el hilo**, y su trabajo queda **bloqueado con el
  motivo escrito** ÔÇö nunca como "fallido" y nunca en silencio.

### 14. Deshacer devuelve los archivos id├®nticos **[auto]**
- **Qu├® prometemos**: el trabajo malo se revierte sin da├▒o.
- **C├│mo se prueba**: revierte un sprint con archivos creados, modificados y con finales de l├¡nea mixtos.
- **Qu├® tiene que verse**: los modificados vuelven **byte a byte**, los creados desde cero
  **desaparecen**, un archivo tocado despu├®s **no se pisa** (conflicto), repetir la orden no hace nada
  (idempotente), y todo queda anotado en el registro.

### 15. La m├®trica no se puede maquillar **[auto]**
- **Qu├® prometemos**: la cifra dice la verdad.
- **C├│mo se prueba**: una corrida que **falla** el criterio de hecho.
- **Qu├® tiene que verse**: entra como **fallo**, no como "menos intervenciones"; y la cifra se reporta
  sobre **todos** los intentos, no solo los exitosos.

### 16. El espacio del proyecto (la UI)
- **Qu├® prometemos**: el multiagente se siente, no se administra.
- **C├│mo se prueba**: entra a un proyecto, pide dos trabajos, y usa la interfaz sin tocar nada m├ís.
- **Qu├® tiene que verse**: **dos pantallas** (lista de proyectos y espacio del proyecto, con "atr├ís"); a la
  izquierda **los workers**, clicables, **en vivo**, con **parada manual** y **sin campo de texto**; y se
  distingue **de un vistazo** qu├® habla el orquestador y qu├® hace un worker.

### 17. El orquestador ELIGE la herramienta, no la reimplementa **[auto]**
- **Qu├® prometemos**: lo que existe, se usa. Una capacidad sin l├¡nea en el prompt es c├│digo muerto.
- **C├│mo se prueba**: pedirle en una sesi├│n real "deshaz el sprint 2" y, aparte, "escribe el plan".
- **Qu├® tiene que verse**: la llamada a **AutonRevert** (con `itemId` del sprint) y a **AutonPlan** en el
  hilo; el orquestador **no** intenta revertir a mano con `Bash` ni `Write`.
- **C├│mo se comprueba sin modelo**: `core/tests/auton-four-pieces.test.ts` verifica que la herramienta
  est├í registrada, que su nombre aparece en la secci├│n de prompt que se ensambla y que la secci├│n est├í
  incluida en el builder. La elecci├│n del modelo requiere la corrida con modelo real.

---

## Cobertura automatizada

| Prueba | Archivo |
| --- | --- |
| 2. No termina respuestas | `core/tests/auton-real-dispatch-runtime.test.ts`, `auton-live-turn-runtime.test.ts`, `auton-live-loop.test.ts` |
| 3. Canales anidados y eventos despertadores | `ui/test/autonThreadChannels.test.tsx` (los tres tipos desde el mapeo real), `ui/test/autonSubagentChannel.test.ts`, `bootstrap/tests/auton-thread-question-projection.test.ts` |
| 4. Canal r├ípido bidireccional | `core/tests/auton-fast-channel-runtime.test.ts` |
| 8. L├¡mites versionados y no relajables | `core/tests/auton-limits-guard.test.ts`, `auton-plan-tool.test.ts` |
| 9. Si no sabe decidir, pregunta | `core/tests/auton-limits-governance.test.ts`, `auton-four-pieces.test.ts` |
| 14. Deshacer devuelve los archivos id├®nticos | `core/tests/auton-revert.test.ts`, `auton-revert-e2e.test.ts`, `adapters/tests/auton-revert-bytes.test.ts` |
| 17. El orquestador elige la herramienta | `core/tests/auton-four-pieces.test.ts` |

Las pruebas 1, 5, 6, 7, 10, 11, 12, 13, 15 y 16 siguen siendo corridas a mano con modelo real.

---

## Lo que estas pruebas protegen

No son para la demo: son para **no enga├▒arnos**. El d├¡a que se cambie el prompt del orquestador, estas
diecis├®is pruebas dicen si mejor├│ o si solo cambi├│. Y el d├¡a de la demo, son la respuesta a la pregunta
inc├│moda del jurado: **"┬┐y c├│mo s├® que eso es cierto?"** ÔÇö porque hay una prueba por promesa, y se corri├│
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
- **Límite declarado**: Muse es **one-shot**; en este entorno no acepta mensajes a mitad de corrida. Si el sprint necesita preguntar a media faena, se parte o se usa `zcode`.

---

## Lo que estas pruebas protegen

No son para la demo: son para **no engañarnos**. El día que se cambie el prompt del orquestador, estas
dieciséis pruebas dicen si mejoró o si solo cambió. Y el día de la demo, son la respuesta a la pregunta
incómoda del jurado: **"¿y cómo sé que eso es cierto?"** — porque hay una prueba por promesa, y se corrió
ayer.
