# Por qué Auton gana la hackathon

> Análisis del artículo de DeepSeek Harness (**"Super-agent"**, https://x.com/DeepSeekHarness/article/2116857257245987236)
> contrastado línea por línea con la Visión 2.0. Lectura completa: 294 líneas, 9 secciones.
> Este documento es el argumento, no la arenga: cada afirmación se apoya en una cita o en código del repo.

---

## 1. La frase que citaste, y por qué es más que una frase

> *"As people take less part in low-level execution, their role is gradually moving up to higher-level
> decisions and sign-off."* — Artículo, §1

Y el cierre del artículo la remata:

> *"the bottleneck to further productivity gains is shifting to human attention"* — §9

Hasta hoy, el cuello de botella de un agente de código era **el modelo**. El artículo dice que ya no:
el modelo ejecuta razonablemente, y lo que limita es **la atención humana** que hace falta para
dirigir varios frentes. Su respuesta: quitarle al humano la gestión de sesiones y de contexto
(arquitectura de dos niveles, triggers, watchdogs).

**Auton responde a la misma frase, pero un escalón más arriba.** El artículo mueve al humano de la
*ejecución* a *las decisiones*. Auton mueve al humano de las decisiones de *ingeniería* a las
decisiones de *producto*. No es "menos atención": es **menos criterio de ingeniería aportado por el
humano**, porque la disciplina (planear, descomponer, verificar, reintentar, revisar) vive dentro del
sistema.

Ese es el salto, y es el argumento central de este documento.

---

## 2. Qué propone el artículo (mapa completo, sin recortes)

| § | Idea | Qué resuelve |
|---|---|---|
| 1 | **Super-agent**: el agente deja de ser una sesión que alguien maneja a mano | Continuo, productivo, proactivo, persistente |
| 2 | **Dos niveles**: *Router* (interacción global y despacho, **no ejecuta**, puede vivir sin Bash, le vale un modelo ligero) + *Workers* (contexto aislado, herramientas completas, **nunca hablan con humanos**, reportan al Router) | Continuidad **y** concurrencia; las sesiones pasan a ser un detalle interno |
| 3 | **Triggers**: filtrado en dos etapas (políticas en código = Fast Path; modelo = Slow Path), *suscripción y pass-through* por **Thread**, **Inline & Spill** (el contexto como caché) + **Chain of Recall** (grafo de referencias por IDs), **ejecución especulativa** | Que el agente sea *proactivo* y no se ahogue en contexto |
| 4 | **Full-duplex**: `start()`/`stop()` asíncronos en vez de `run()` bloqueante; normas por canal (IM: ≤100 palabras y solo cuando hay que decidir; canales async: densos y estructurados) | Que el humano pueda hablar mientras el trabajo corre |
| 5 | **Separar cómputo, estado y entornos**: Agent Loop en la nube, estado persistente en base de datos, entornos donde ya están, vía **daemon ligero** en cada máquina (**BYOM**) | Persistencia real: la máquina puede dormir |
| 6 | **Watchdog**: un *Control Loop* externo que es **otra sesión con herramientas**; vigila infraestructura **y progreso** (no solo que el proceso viva: que el modelo no esté en bucle ni desviado) | Recuperación automática |
| 7 | **Experimentos**: Super-agent 12,4 min p50 / 15,7 p95 vs Single Session con subagente 20,4 / 29,5 (prompt neutral) y 13,8 / 29,0 (prompt "delegation-first"). Pass-through recorta ~37% los tokens del Router. Batching en el Router: de 1 a 40 triggers/min, tamaño de lote 1,0→2,8 y tiempo amortizado por decisión 6,4s→1,6s | Evidencia de que el diseño funciona |
| 8 | **Problemas abiertos**: escalar los dos niveles; trabajar *sin* sesiones; fronteras de contexto y A2A; seguridad y privacidad (credenciales que el agente debe usar **sin verlas**) | Honestidad sobre lo que no está resuelto |
| 9 | **Conclusión**: no hay teoría nueva, son ideas clásicas de sistemas aplicadas a agentes; el agente deja de ser "una ventana de chat que espera instrucciones" | El marco mental |

---

## 3. Dónde el artículo **valida** lo que Auton ya construyó

Esto es lo valioso para el jurado: no somos un experimento suelto, coincidimos con la arquitectura
que un laboratorio grande publicó como su diseño interno.

| Artículo | Auton (verificado) |
|---|---|
| Router y Workers como dos niveles | **Orquestador** y **programmers** (Visión 2.0 §10). Es la misma división, por la misma razón |
| *"Workers never interact with humans directly… report their status to the Router"* (§2.2) | El humano solo habla con el orquestador; el programmer cierra con `REPORTE` (`DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`) y el runtime lo parsea |
| *"Sessions should be an implementation detail, not a mental burden"* (§2) | Un chat = un project workspace con su propio orquestador; las sesiones de los workers son internas |
| *"Wasting the context window is wasting the model's intelligence"* (§3.3) | Compactación + microcompacto portados del propio ZCode: resumen rodante, se conservan los últimos rounds, se limpian resultados viejos |
| El Watchdog *"monitors task progress as well as infrastructure liveness"* (§6) | `reconcile` + tick + `why()`: recicla fantasmas, reabre sprints y explica qué está atascado |
| *"It responds quickly and completes several complex tasks in parallel"* (§1) | Varios programmers en paralelo con scope leases y worktrees, cupo configurable |
| Proactividad por eventos | El sistema **despierta** al orquestador cuando la flota cambia: no espera a que el humano escriba ("si el humano tiene que escribir *sigue*, Auton falló") |

---

## 4. Dónde Auton **va más allá** (y esto es el corazón del pitch)

El artículo describe su Router así, explícitamente:

> *"the Router layer is designed not to execute tasks itself. It only interacts with humans and
> dispatches tasks… In our experience, the Router layer's work is often simpler than expected, and a
> **lighter model** can usually provide both speed and quality."* — §2.1

Ese Router es un **despachador**. Reparte y recuerda. Y el artículo admite que la parte difícil queda
abierta: cuándo shardear, cuándo los workers deben hablar entre sí, y —§8.1— que *"co-designing the
system and the model is another direction worth exploring"*, incluyendo **entrenar** al modelo para
el trabajo del Router (juzgar eventos, despachar en lotes, recordar contexto).

**Auton pone ahí un ingeniero, no un despachador.** Cuatro diferencias concretas:

### 4.1 El Router de Auton convierte intención en ingeniería
Antes de despachar, Auton **fija el contrato** (propósito, restricciones, fuera de alcance, DoD),
**parte el trabajo** en sprints con scope y criterio de hecho, y decide **cuántos frentes** pueden
correr a la vez sin pisarse. El artículo no tiene ese paso: sus Triggers son eventos que ya llegan
como tareas. Auton tiene que *inventar* las tareas a partir de una frase humana.

### 4.2 Verificación independiente en dos etapas, con evidencia como condición de cierre
El artículo tiene un Watchdog que detecta que un worker **no progresa o se desvía**. Auton tiene algo
distinto: **revisión de contrato** (¿cumple el DoD?, sin creer el reporte del implementador) y
después **revisión de calidad**, hechas por otro agente, sobre el mismo worktree. Y la regla dura:

> Un mensaje del modelo diciendo "listo" **no cuenta** como terminado.

Eso ataca el problema que el propio artículo deja en §8.4 (confianza): si el que verifica es el mismo
que ejecuta, la verificación no vale. Auton separa los papeles.

### 4.3 Auton es agnóstico del motor y de la nube
El artículo construye **un sistema** (Harness + daemons + nube). Auton es una **capa encima de los
motores que ya existen**: Claude Code, Codex, ZCode, Muse Code. No compite con ellos: los dirige.
Consecuencia práctica para la hackathon: Auton puede usar **Muse Code** como ejecutor —el 25% de la
nota— sin dejar de ser Auton.

### 4.4 Auton no necesita que el humano aporte disciplina
El experimento de §7.1 es la mejor prueba de por qué: **con el prompt neutral, el modelo no delegó ni
una vez en 5 corridas**; con el "delegation-first" delegó en 4 de 5 y aun así el p95 siguió peor que
el del Super-agent, porque *"a single session has to rely on prompt engineering and the model's
on-the-spot judgment"*. Su conclusión: **la arquitectura debe mitigarlo a nivel de sistema, no de
prompt**.

Auton aplica esa lección al problema siguiente: la tentación del modelo de hacerlo todo él. En Auton
el orquestador **no puede** escribir el producto (`run_check` rechaza heredocs y redirecciones: "tú no
escribes el producto, para eso están los programmers"), y los perfiles de esfuerzo
(`minimal`/`standard`/`thorough`) limitan *cuánto* hace cada worker según lo que el orquestador
decida. Es diseño de sistema, no esperanza en el prompt.

---

## 5. Sobre la democratización: sí, pero no como tesis central

Decías que te gustaba por ética, pero dudabas porque *"si no sabes, al final te toca aprender"*.
Estoy de acuerdo en bajarle el tono, y el artículo da la forma precisa de decirlo:

- **No prometas** "cualquiera hace software de calidad profesional". Es falso y un jurado técnico lo
  castiga.
- **Sí promete**: *"dejas de competir en cuánto sabes dirigir agentes"*. La disciplina de coordinar,
  partir, verificar y reintentar deja de ser tu carga y pasa a ser del sistema. Lo que queda de tu
  lado son decisiones de producto: qué construir, qué restricciones, qué apruebas.
- Eso **es** democratización, pero de la *dirección de ingeniería* — exactamente lo que el artículo
  llama subir al humano a "higher-level decisions and sign-off". Auton sube un escalón más: el humano
  no necesita saber *cómo* se verifica un sprint, porque el sistema ya lo sabe.

La formulación que sí aguanta un escrutinio: **una persona sola puede ejecutar un proyecto que antes
requería supervisión continua de un equipo.** Que es literalmente tu caso con Lunar Móvil.

---

## 6. El pitch para el jurado, en el orden de la rúbrica

| Criterio | Argumento |
|---|---|
| **Impacto (30%)** | El problema no es inventado: **Lunar Móvil**, un port a Android nativo demasiado grande para supervisarlo sprint a sprint. Auton convierte semanas de dirección continua en decisiones puntuales. Y el artículo de DeepSeek demuestra que el cuello de botella ya no es el modelo sino la atención humana: eso es mercado, no opinión |
| **Uso de herramientas de Meta (25%)** | Auton es agnóstico del motor: **Muse Code** entra como backend de los programmers, con el mismo protocolo de reporte y la misma verificación. No es un envoltorio: Auton *dirige* Muse Code con contrato, scope y revisión |
| **Profundidad técnica (20%)** | Arquitectura de dos niveles con Router que **no ejecuta**, verificación en dos etapas sobre el mismo worktree, protocolo de reporte con estados que mandan sobre el exit code, contexto como caché (compactación + microcompacto + presupuesto), perfiles de esfuerzo, evidencia obligatoria para cerrar, y aislamiento real del estado (`~/.auton`) |
| **Calidad de la demo (25%)** | El tablero en vivo: el plan, los sprints, la flota con relojes, las tarjetas de cada tool intercaladas con lo que dice el orquestador, y el **Evidence Inspector** con el comando y su salida. Un jurado ve *cómo se verifica*, no una promesa |

**La frase de cierre que yo usaría**: *el artículo de DeepSeek dice que el humano debe subir de la
ejecución a las decisiones. Auton lo lleva al siguiente escalón: el humano decide el producto, y la
disciplina de ingeniería deja de depender de él.*

---

## 7. Lo que hay que robarle al artículo (lista accionable)

Por orden de valor, y con el estado actual en el repo:

1. **Watchdog como sesión independiente** (§6): hoy `reconcile` es una función del runtime; debería ser
   una sesión con herramientas que juzgue *progreso* (no solo liveness) y que un humano pueda
   interrogar en lenguaje natural.
2. **Ejecución especulativa** (§3.4): el caso "silently reproduce and fix" es directamente aplicable —
   cuando el humano reporta un bug, Auton puede reproducirlo y preparar el fix en background y solo
   hablar si lo confirmó.
3. **Threads y suscripción** (§3.2): un sprint o un archivo es un "thread"; los eventos de seguimiento
   van directo al worker suscrito sin pasar por el orquestador. Hoy todo pasa por el orquestador.
4. **`start()`/`stop()` asíncronos** (§4.1): nuestro "Detener" existe; falta el `start` que devuelve el
   control al instante y entrega el resultado como evento (hoy el turno espera).
5. **Normas por canal** (§4.2): el tope de 100 palabras para mensajes al humano es una regla simple y
   verificable que podemos adoptar tal cual en el orquestador.
6. **Credenciales que el agente usa sin ver** (§8.4): nuestro modelo actual deja las keys en un `.env`
   legible. El artículo marca esto como problema abierto serio y nosotros deberíamos al menos no
   empeorarlo.

## 8. Lo que NO hay que decir

- "Auton reemplaza al desarrollador". Falso y mata la credibilidad. Auton reemplaza **la supervisión**,
  no el criterio de producto.
- "Auton garantiza software profesional para cualquiera". Es una promesa que no podemos verificar.
- "Somos los primeros en arquitectura de dos niveles". El artículo es de DeepSeek y es público. La
  honestidad aquí **suma**: citarlo demuestra que leímos el estado del arte y que coincidimos con él
  por las mismas razones, y que además resolvemos dos de sus problemas abiertos.

---

# Parte II — El artículo, explicado sin jerga

Esta parte es para leer en voz alta en la demo: qué encontró DeepSeek, qué construyó, cómo lo midió y
qué dejó sin resolver. Nada de siglas.

## 9. Qué le pasó a DeepSeek (el problema que los llevó a esto)

Tenían un agente de código que funcionaba bien. El problema apareció al usarlo **en paralelo**:

- Un agente vive en **una sesión**. Si quieres tres trabajos a la vez, abres tres sesiones.
- Tú eres el que tiene que recordar qué hay en cada una, cambiar entre ellas y saber cuál te está
  esperando. **Ellos dicen que una persona puede seguir bien entre 3 y 5 sesiones activas.**
- Y esa es la trampa: con un solo trabajo, lo que te limita es **el modelo**. Con varios, lo que te
  limita es **tu atención**. El modelo mejoró muchísimo, tu atención no.

Su frase: *"con estos diseños, un solo trabajo está limitado por la capacidad del modelo, pero el
trabajo múltiple está limitado por la atención humana."* Ese es el diagnóstico que abre el artículo, y
es el mismo que da origen a Auton.

## 10. Qué construyeron (las siete piezas, en lenguaje llano)

1. **Dos niveles.** Arriba, un *Router*: un agente que **solo habla con humanos y reparte trabajo**.
   Abajo, varios *Workers*: cada uno con su contexto separado, sus herramientas completas, trabajando
   en una tarea. Los Workers **nunca hablan con humanos**: le cuentan a su Router cómo va, y el Router
   es el que te responde. (Esto es, literalmente, orquestador y programmers.)
2. **Dejan de reaccionar solo a lo que tú escribes.** El agente se conecta a los sitios donde ya
   ocurren las cosas — chats de grupo, correo, comentarios de un PR, resultados del CI — y esos
   eventos son los que lo despiertan. Los llaman *Triggers*.
3. **Dos filtros para no ahogarse.** Primero un filtro barato y determinista (reglas: "en este grupo
   solo respondo si me nombran"), y solo lo que pasa ese filtro va al modelo, que decide con criterio.
   El filtro barato descarta el ruido sin gastar; el caro se reserva para lo dudoso.
4. **Los eventos van directo a quien corresponde.** Un PR, un hilo de chat o una cadena de correos son
   un *Thread*. Cuando un Worker toma ese hilo, los mensajes siguientes **le llegan a él directamente**
   y no pasan por el Router. El Router se queda solo con los trabajos nuevos y la coordinación.
5. **El contexto, tratado como una caché.** Meter todo al modelo es un desperdicio (diluye su
   atención); meter muy poco lo obliga a leer una y otra vez. Así que: lo que va a necesitar pronto se
   mete; lo que es largo se deja fuera y se pone un resumen con un puntero para leerlo *si hace
   falta*; y cada objeto tiene un identificador que apunta al siguiente, de modo que el modelo puede
   ir tirando del hilo ("recuerdo encadenado"). Es exactamente el problema que resolvimos con la
   compactación y el microcompacto.
6. **Actúan antes de que se lo pidan.** Si alguien reporta un bug en el chat del equipo, el agente
   **intenta reproducirlo y prepara el arreglo en segundo plano sin decir nada**. Si lo confirma y el
   arreglo es simple, lo entrega; si no, se queda callado. Ellos lo configuraron como política
   ("reproducir y arreglar en silencio") y es de lo más aprovechable que trae el artículo.
7. **La conversación no se bloquea.** En un agente normal, cuando llama a una herramienta que tarda,
   **todo espera** hasta que la herramienta termina; mientras tanto no puedes decirle nada. Ellos lo
   cambiaron por un `start()` que responde "empezado" al instante y entrega el resultado después, como
   un evento más. Así puedes seguir hablando mientras trabaja. **Aviso honesto: ellos mismos dicen que
   esto ya lo tienen implementado pero todavía no encendido por defecto.** (Nuestro botón "Detener"
   cubre la mitad de eso: podemos parar; lo que falta es el `start` que devuelve el control ya.)
8. **El cerebro en la nube, el trabajo donde está.** Separaron tres cosas que un agente local mezcla:
   el programa que piensa, la memoria de la conversación, y el entorno donde se ejecutan las cosas
   (tus carpetas, tus credenciales, tus programas). Se les ocurrió lo lógico: **no mover el entorno**.
   En la nube vive el cerebro, en una base de datos la memoria, y en cada máquina un **demonio
   pequeñito** que solo ejecuta órdenes y devuelve resultados. Así el agente sobrevive a que tu
   portátil se duerma, y usa tu máquina cuando está encendida. Lo llaman *"trae tu propia máquina"*.
9. **Un vigilante aparte.** Un *Watchdog*: **otra** sesión de agente, con herramientas, que vive fuera
   del sistema principal y que revisa dos cosas: que la infraestructura no falle (errores de API,
   recuperación de estado) y —esto es lo fino— **que cada Worker esté avanzando de verdad**, no dando
   vueltas en un bucle ni desviándose del objetivo. Porque *"muchas anomalías no son caídas: el
   proceso sigue vivo, pero el modelo está atascado"*. Y como el vigilante es un agente, los
   mantenedores le pueden preguntar en lenguaje natural por qué falló algo.

## 11. Cómo lo midieron (y aquí está nuestra mejor munición)

Hicieron dos experimentos. Te los cuento sin estadística.

**Experimento 1 — ¿qué diseño termina antes los trabajos?**
Montaron cuatro diseños a la vez y les dieron **el mismo flujo de unos 300 mensajes**, de los cuales
solo **20 eran peticiones de trabajo real**; el resto era charla, seguimientos, cancelaciones y avisos
del CI. Cronometraron desde que llegaba la petición hasta que salía el resultado. Repitieron cada
diseño 5 veces.

- **Su Super-agent**: **12,4 minutos** en el caso típico y **15,7** en los malos.
- **Un solo agente con herramienta de subagentes, prompt normal** ("usa un subagente cuando sea
  apropiado"): **20,4 minutos** típicos y **29,5** en los malos. Y el dato demoledor: **en las 5
  corridas el modelo no delegó ni una vez**. Se puso a hacer todo él, y cada mensaje nuevo lo
  interrumpía.
- **El mismo diseño, pero con un prompt que insistía** ("cada mensaje te llega a ti, así que prefiere
  delegar…"): mejoró el caso típico a **13,8**, pero **los malos siguieron en 29,0** — porque en 1 de
  las 5 corridas el modelo decidió que el trabajo era "pequeño" y lo hizo él, y esa corrida se hizo
  eterna.

**Lo que esto significa** (y es una frase de ellos): *"una sola sesión tiene que confiar en el prompt y
en el juicio del modelo en el momento"*. Confiar en que el modelo sea disciplinado es una lotería: a
veces sale bien, a veces decide que él lo hace. **La solución no es un prompt mejor, es quitarle la
decisión y ponerla en la arquitectura.** Ese es exactamente el principio que Auton aplica al problema
siguiente (§12).

(De paso midieron que no usar el paso directo de eventos al Worker no cambia los tiempos, pero hace
que el Router trabaje ~30% más y gaste ~37% más tokens. Es ahorro, no velocidad.)

**Experimento 2 — ¿cuánto aguanta un solo Router?**
Subieron la frecuencia de eventos que necesitan decisión, de **1 a 40 por minuto**. Cada respuesta
individual se hizo un poco más lenta (de 2,5 a 3,9 segundos), pero como el Router **atiende varios
eventos juntos**, el tiempo por decisión **bajó de 6,4 a 1,6 segundos**. O sea: bajo carga no se
degrada, se vuelve *más* eficiente. Por eso no reparten el Router en varios.

## 12. Lo que ellos mismos dicen que no han resuelto

Esto es lo más útil del artículo para nosotros, porque marca dónde se puede aportar de verdad. Su §8
lista cuatro:

1. **Escalar los dos niveles:** cuándo conviene partir el Router en varios (y a costa de perder
   memoria compartida), y cuándo los Workers deberían hablar entre ellos directamente. Y una frase
   que vale oro: *"co-diseñar el sistema y el modelo es otra dirección que vale la pena explorar"* —
   es decir, **entrenar al modelo específicamente para el trabajo del Router** (juzgar eventos,
   despachar en lotes, recordar contexto). Reconocen que hoy el Router es una pieza relativamente
   tonta y que ahí hay campo.
2. **Trabajar sin sesiones:** si las sesiones dejan de ser lo que el usuario ve, ¿cómo se le presenta
   el trabajo? Sospechan que la "ventana de chat" es el centro por costumbre, no por necesidad.
3. **Fronteras de contexto y comunicación entre agentes:** cuando varias personas tienen su agente y
   el equipo tiene otro, ¿qué contexto se comparte y cuál se aísla? Sin resolver.
4. **Seguridad y privacidad:** su diseño asume que la nube y las máquinas se confían. Si te
   comprometen el cerebro en la nube, **todas las máquinas conectadas quedan expuestas**. Y aunque no
   te comprometan: si las credenciales de tu máquina entran al contexto del modelo, cualquier
   ejecución normal puede filtrarlas. Conclusión suya: hace falta que el agente **use** credenciales
   sin **verlas**. Sin eso, este tipo de sistema no se puede usar en serio.

---

# Parte III — El ingeniero contra el despachador

Esta es la tesis que interesa. La desarrollo con el cuidado que pide.

## 13. Qué es exactamente el Router de DeepSeek

Hay que ser justo: el suyo está muy bien pensado y lo dicen con precisión.

> *"El Router está diseñado para **no** ejecutar tareas él mismo. Solo interactúa con humanos y
> despacha tareas… En nuestra experiencia, el trabajo del Router suele ser **más simple de lo que se
> espera**, y un **modelo más ligero** normalmente da velocidad y calidad."* — §2.1

Y un poco más arriba, sobre por qué separan en dos niveles: *"el sistema se hace cargo de la gestión
del contexto y de la ejecución concurrente, así que los usuarios casi nunca tienen que pensar en
sesiones"*. Su Router hace cuatro cosas: recibe eventos, decide cuáles merecen acción, despacha al
Worker que toca, y mantiene la memoria global. **Y responde al humano.** Nada más.

Ahí está la clave, y no es un defecto suyo: es **el problema que ellos eligieron**. Fíjate en de dónde
salen sus Triggers: "alguien reportó un bug en el chat del equipo", "hay un PR que revisar", "el CI
falló", "llegó una invitación de reunión". Todos esos eventos **ya son tareas**. El trabajo de
averiguar *qué* hay que hacer está hecho antes de que el Router lo vea: lo hizo quien reportó el bug o
quien abrió el PR. El entorno le entrega la tarea masticada.

## 14. Por qué el caso de Auton es otro problema

Auton no recibe tareas. Recibe **intenciones**. La diferencia es toda la dificultad:

| | DeepSeek | Auton |
|---|---|---|
| Lo que llega | Un evento que **ya es una tarea** ("este PR, este bug, este CI") | Una frase de intención: *"quiero portar Lunar Móvil a Android nativo"* |
| Quién define el trabajo | El entorno (el bug ya existe, el PR ya está abierto) | **Auton**: contrato, sprints, scope, criterio de hecho |
| Quién decide el corte | Nadie: la tarea viene entera | **Auton**: en cuántos sprints, con qué dependencias, cuántos frentes a la vez |
| Quién define "terminado" | El estándar del proyecto | **Auton**: el DoD por sprint y el contrato del goal |
| Quién verifica | Un Watchdog que mira si el Worker avanza o se desvía | **Auton**: un revisor independiente que comprueba el contrato y después la calidad, sobre el mismo worktree |
| Quién decide reintentar o cambiar de enfoque | El entorno (llega otro evento) | **Auton**: lee el estado que devuelve el Worker y decide si reintenta, replanifica o escala |
| Quién responde al humano | El Router | El orquestador — **sí, igual que ellos** |

Mira la columna derecha: **todo lo que en DeepSeek hace el entorno o el humano, en Auton lo hace el
orquestador.** Eso no es "más features". Es ocupar una posición distinta en la misma arquitectura.

Por eso la frase que quiero que quede: **donde DeepSeek tiene Triggers, Auton tiene un contrato; donde
DeepSeek despacha, Auton descompone; donde DeepSeek vigila que el Worker no se desvíe, Auton revisa
que el trabajo sea bueno; y donde DeepSeek solo relaciona tareas entre sí, Auton vuelve a planear
cuando la realidad contradice el plan.**

## 15. Por qué esto es exactamente lo que ellos dejan abierto

No es una coincidencia: su §8.1 dice que el campo por explorar es justamente el Router —cuándo
partirlo, y "co-diseñar el sistema y el modelo" para que el Router juzgue, despache y recuerde mejor.
Traducido: **saben que su Router es la parte menos resuelta de su arquitectura, y eligen que sea
delgada a propósito.**

Auton no hace un Router más gordo: **le cambia el oficio.** En DeepSeek el Router es un *despachador*;
en Auton es un *ingeniero*. Y el detalle que lo demuestra es el experimento de §11: ellos comprobaron
que pedirle disciplina al modelo por prompt es una lotería (0 de 5 delegaciones con el prompt normal;
4 de 5 con el insistente, con resultados inestables). Su conclusión fue *"hay que mitigarlo en la
arquitectura"*. Auton toma esa conclusión y la aplica un nivel más arriba: **no le pides al orquestador
que sea disciplinado, se lo impones en el sistema**:

- El orquestador **no puede** escribir el producto: la herramienta de shell rechaza heredocs y
  redirecciones, y le devuelve el motivo. No es un consejo en el prompt: es una negativa del sistema.
- **La intensidad se decide y se escribe.** Cada sprint lleva su perfil (`minimal`, `standard`,
  `thorough`). Un sprint `minimal` que toca archivos fuera de su scope se considera **fallido aunque
  compile**. La disciplina es un dato del trabajo, no una virtud esperada.
- **La verificación es de otro.** El que revisa no arregla, y tiene prohibido creer el reporte del
  implementador. Y el cierre no se acepta por declaración: *un mensaje del modelo diciendo "listo" no
  cuenta*.
- **El sistema te habla primero.** Cuando la flota cambia, el orquestador despierta solo. Si el humano
  tiene que escribir "sigue", Auton falló.

Es el mismo principio que ellos validaron, aplicado al escalón siguiente. Y eso es defendible ante un
jurado técnico porque **lo dijeron ellos**: la disciplina va en la arquitectura, no en el prompt.

## 16. Dónde está el límite honesto de esta tesis

Para que el argumento aguante la pregunta incómoda del jurado, hay que decir también dónde flaquea:

- **Nuestro ingeniero es tan bueno como su plan.** Si parte mal el trabajo, revisa mal. Por eso existen
  el contrato escrito, el tablero visible y el Evidence Inspector: para que el humano pueda auditar el
  criterio, no solo el resultado.
- **Dependemos del motor que ejecuta.** Si el Worker es flojo, el ingeniero no lo arregla. De ahí que
  Auton sea agnóstico: el mismo orquestador dirige Claude Code, Codex, ZCode o Muse Code, y puede
  cambiar de motor sin cambiar de método.
- **No resolvemos su §8.4 (seguridad).** Nuestro modelo de credenciales es hoy un archivo en disco.
  Copiar su idea —que el agente use credenciales sin verlas— es trabajo pendiente, y decirlo en voz
  alta nos da credibilidad en lugar de quitarla.
- **La ejecución especulativa y los Threads son suyos y nos faltan** (ver §7, Parte I: la lista de lo
  que hay que robarle). Reconocerlo y tener plan es mejor que fingir que ya lo tenemos.

