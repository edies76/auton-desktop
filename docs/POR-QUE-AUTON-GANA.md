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
