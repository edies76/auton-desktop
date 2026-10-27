# AUTON — VISIÓN 2.0

> **De ejecutar instrucciones a dirigir ingeniería.**  
> **Tú decides qué construir. Auton se encarga de convertir esa intención en software comprobable.**

**Documento maestro de visión, producto, arquitectura e investigación**  
**Fecha:** 27 de octubre de 2026  
**Estado:** visión de producto + propuesta técnica + plan de validación, no declaración de capacidades ya implementadas.  
**Contexto inmediato:** Meta Global AI Developer Hackathon 2026; Auton Web existente y Auton Desktop propuesto sobre un fork de ZCode.

---

## Cómo leer este documento

Este documento amplía la visión original de `AUTON-VISION.md` y recoge los cambios de dirección expresados por su creador. No pretende hacer pasar propuestas por implementaciones.

Se utilizarán cinco etiquetas cuando importe distinguir los niveles de certeza:

- **[VISIÓN ORIGINAL]** Una idea o requisito procedente del documento inicial.
- **[DECISIÓN ACTUAL]** Un cambio o aclaración aportado por el creador para la visión 2.0.
- **[PROPUESTA]** Una recomendación de diseño o estrategia todavía no confirmada como decisión.
- **[HIPÓTESIS]** Algo que podría ser cierto, pero exige experimentos.
- **[POR VERIFICAR]** Un hecho sobre el código, la integración o las reglas que no puede darse por demostrado solo con este documento.

**Regla de honestidad:** Auton no se presentará como superior a Claude Code, Codex, ZCode u otros sistemas sin comparaciones reproducibles. Tampoco se llamará «avance científico demostrado» a lo que hoy es una dirección de investigación.

---

# PARTE I — EL CENTRO

## 1. La frase que define Auton

> **En las herramientas actuales, a menudo el humano todavía tiene que ser el ingeniero que dirige a la IA. En Auton, buscamos que esa dirección de ingeniería sea parte del producto.**
>
> **Tú apruebas la dirección. El sistema ejecuta el oficio.**

La versión original lo expresaba así:

> «En los otros, el límite eres tú: tu disciplina para planear, verificar y reintentar. En Auton, esa disciplina es el producto».

Esta tesis se conserva. La visión 2.0 añade una precisión fundamental:

**El oficio que Auton busca automatizar no es solamente programar; es la dirección técnica que el usuario realiza cuando utiliza un agente de programación.**

El programador humano hoy hace mucho más que dar una orden. Interpreta errores, decide si algo está suficientemente terminado, reformula instrucciones, comprueba restricciones, plantea una arquitectura, replanifica cuando una solución falla, compara opciones, detecta regresiones y decide cuándo avanzar. Incluso cuando el modelo escribe el 95 % del código, ese trabajo de dirección puede seguir recayendo en una sola persona.

**Auton quiere situar a un ingeniero de IA entre la intención del creador y los motores de programación existentes.**

No promete abolir al humano ni convertir cualquier idea en software perfecto. Busca que la persona pueda elevarse un nivel de abstracción: de supervisar cada iteración técnica a dirigir un proyecto mediante objetivos, restricciones y decisiones significativas.

### Fórmula central

```text
Creador
  └─ decide QUÉ construir, POR QUÉ y cuáles son los límites
        ↓
Auton / Orchestrator
  └─ decide CÓMO abordarlo, QUÉ delegar, QUÉ comprobar y CUÁNDO reintentar
        ↓
Motores de programación
  └─ implementan cambios concretos en el repositorio
        ↓
Verificación independiente
  └─ determina qué está demostrado y qué sigue pendiente
        ↓
Auton
  └─ continúa, corrige, replantea o escala una decisión al humano
```

### Declaración breve de producto

**Auton es un sistema de dirección de ingeniería autónoma que traduce objetivos humanos en planes ejecutables, coordina agentes de programación, verifica sus resultados y sostiene la continuidad del trabajo hasta completar objetivos comprobables o requerir una decisión humana.**

### Declaración breve en inglés

**Auton — The AI engineer between your vision and your coding agents.**

*You define what to build. Auton figures out how, directs coding agents, verifies their work, and keeps going.*

Estas frases describen el **objetivo del producto**, no una garantía incondicional de desempeño.

---

## 2. ¿Qué cambia respecto a Auton 1.0?

| Dimensión | Visión original | Visión 2.0 |
|---|---|---|
| Definición | «Jefe de obra con IA» | Director de ingeniería entre el creador y los agentes |
| Principal aporte | Disciplina automatizada: plan, code, verify, retry | Delegación del juicio y la supervisión técnica, apoyada por esa disciplina |
| Relación con el usuario | Conversación con un solo orquestador | Conversación de producto y dirección; el humano evita microgestionar agentes |
| Relación con los coders | Programmer como ejecutor | Modelos y harnesses reemplazables; Claude Code, Codex, ZCode u otros pueden ser las manos |
| Interfaz prevista originalmente | CLI-first | **Auton ya pasó a ser una app web; Auton Desktop es el siguiente objetivo** |
| Escritorio | No era el centro | Fork y adaptación de ZCode para acelerar la entrega de Auton Desktop |
| Caso real | Lunar Móvil y sus 100 sprints | Lunar Móvil como necesidad del creador, dogfood y experimento de validación |
| Diferenciación pretendida | Más autonomía gracias al protocolo | Menor dependencia de la experiencia humana como director de agentes |
| Investigación | Verificación, persistencia y orquestación | Medir si la arquitectura mejora calidad, autonomía o coste incluso con modelos más modestos |
| Prioridad | Loop 1× antes que una flota | **Se mantiene:** primero una cadena de trabajo fiable, después paralelismo y escala |

**[DECISIÓN ACTUAL]** Auton ya no debe describirse como un producto exclusivamente CLI. Su estado actual comunicado por el creador es **aplicación web**. Para el hackathon se propone una **aplicación desktop** basada en ZCode. La implementación concreta y el grado de madurez de la web no se han auditado en este documento.

**[VISIÓN ORIGINAL QUE SE CONSERVA]** Las tres funciones fundamentales son Brain/Orchestrator, Hands/Programmer y Judge/Tester. El humano se relaciona principalmente con el orquestador.

---

## 3. Qué es Auton y qué no es

### Auton sí pretende ser

1. Un **intermediario técnico inteligente** entre intención y ejecución.
2. Un **director de ingeniería** que convierte ideas difusas en contratos verificables.
3. Un **orquestador duradero** que coordina trabajos largos y tolera interrupciones.
4. Un **sistema de calidad** que no equipara «el modelo dijo listo» con «funciona».
5. Una **capa por encima de herramientas de coding existentes**, no necesariamente un motor de generación propio.
6. Una forma de permitir que creadores con menos experiencia puedan abordar proyectos más complejos sin tener que ejercer continuamente de arquitectos, revisores y gestores de tareas.

### Auton no debe presentarse como

1. Un modelo fundacional nuevo.
2. Una técnica de razonamiento garantizada para hacer inteligente a cualquier modelo.
3. Un sistema que elimina la necesidad de validación humana en decisiones de alto impacto.
4. Un simple chatbot con una pantalla de sprints.
5. Una copia de ZCode con nuevas etiquetas visuales.
6. Un agente de programación que solo sabe llamar a otros agentes.
7. Una solución ya demostrada como más barata o más fiable que sus competidores.

---

# PARTE II — EL PROBLEMA

## 4. El desarrollador como harness invisible

El flujo común de trabajo con asistentes de programación puede verse así:

```text
Usuario: «Haz X»
Coder: implementa
Usuario: revisa, detecta que no entendió X
Usuario: reformula
Coder: modifica
Usuario: corre o lee pruebas, encuentra otra omisión
Usuario: pega errores
Coder: corrige
Usuario: recuerda restricciones originales
Usuario: vuelve a pedir cambios
... y así sucesivamente.
```

Aunque Claude Code, Codex, ZCode y otras herramientas ya ofrecen planificación, subagentes, ejecución autónoma y verificaciones, **existen tareas y escenarios donde el usuario sigue siendo el coordinador del trabajo**.

El problema real no es «la IA todavía no escribe código». Es que **la dirección técnica puede continuar dependiendo del tiempo, atención y experiencia de quien la usa**.

En especial, un creador poco experimentado puede no saber:

- Qué requisitos faltan en su solicitud.
- Qué solución arquitectónica es apropiada.
- Qué compromisos técnicos está aceptando.
- Qué pruebas deben pasar antes de considerar algo terminado.
- Cuándo insistir, cambiar de enfoque o deshacer un cambio.
- Cómo preservar decisiones anteriores durante trabajos largos.
- Qué parte de la salida del agente es evidencia y qué parte es solo una afirmación.

El riesgo no se limita a perder tiempo: también puede producir software frágil, difícil de mantener o con fallos no detectados.

## 5. Tres problemas que Auton busca reducir

### 5.1. Sobrecarga de dirección

El usuario debe repartir trabajo, gestionar dependencias, mantener contexto, seguir errores y decidir próximos pasos. Incluso si la programación está automatizada, la coordinación no lo está suficientemente para algunos casos de uso.

**Resultado deseado:** el usuario solo interviene en decisiones de intención, producto, permisos, riesgo o bloqueos realmente irreducibles.

### 5.2. Brecha de experiencia

Un principiante puede expresar lo que quiere construir, pero no conoce necesariamente los estándares para hacerlo bien. Dar una orden directa a un coder puede producir un resultado atractivo sin buena arquitectura, pruebas o seguridad.

**Resultado deseado:** el orquestador suple parte del conocimiento de dirección: identifica requisitos omitidos, propone enfoques, razona sobre compensaciones y pregunta de forma focalizada.

### 5.3. Falta de confiabilidad observable

Los sistemas pueden declarar éxito antes de completar criterios verificables. Los tests pueden ser incompletos y las fallas pueden reaparecer más adelante.

**Resultado deseado:** cada unidad terminada tiene trazabilidad: requisito → cambio → prueba → evidencia → decisión.

## 6. ¿Es un problema urgente y valioso?

**Respuesta sin marketing:** para algunos usuarios sí; para todo el mercado, no necesariamente.

- Para un desarrollador que ya dirige agentes con soltura, Auton puede ser una mejora marginal si no reduce sustancialmente su trabajo.
- Para un founder técnico con recursos limitados y un backlog amplio, reducir revisión y coordinación puede ser muy valioso.
- Para un usuario inexperto, la ayuda de ingeniería puede ser más importante que acceder al modelo de código más capaz.
- Para un equipo profesional, autonomía sin auditoría, permisos ni control puede ser más un riesgo que una ventaja.

Por eso, el valor no debe definirse como «todos necesitan más agentes». Debe probarse en usuarios y trabajos donde el **costo de supervisar agentes supera una parte importante del costo de producir código**.

---

# PARTE III — LA OPORTUNIDAD REAL

## 7. El cambio de nivel: de operador a director

Auton propone tres niveles de interacción:

**Nivel 1 — Operación de código.** «Crea este componente; corrige esta función; ejecuta estas pruebas». El humano administra tareas individuales.

**Nivel 2 — Delegación de tareas.** «Implementa esta funcionalidad». Un agente planifica y ejecuta varias acciones, pero el humano a menudo revisa la estrategia y enlaza ciclos.

**Nivel 3 — Dirección delegada de ingeniería.** «Quiero este producto, con estas restricciones y objetivos». Auton identifica la ruta técnica, gestiona múltiples ciclos de ejecución y presenta decisiones significativas y evidencia.

**Auton aspira al nivel 3.** No porque otros productos jamás hayan trabajado ahí, sino porque convertir ese nivel en una experiencia robusta, clara y medible es su foco.

## 8. La promesa para creadores menos experimentados

Un usuario podría decir:

> «Necesito una aplicación de finanzas con cuentas, gastos, ingresos, estadísticas y autenticación».

Un coder directo puede comenzar a programar. Auton debería, antes de hacerlo:

1. Identificar ambigüedades de producto relevantes.
2. Separar decisiones de negocio de decisiones puramente técnicas.
3. Evaluar arquitectura, almacenamiento, autenticación, permisos y riesgos.
4. Proponer un alcance alcanzable.
5. Plantear sprints con condiciones de aceptación observables.
6. Asignar implementación al motor ejecutor.
7. Comprobar que el resultado cumple los contratos acordados.
8. Corregir problemas o explicar las decisiones que requieren al usuario.

**El usuario no tiene que aprender inmediatamente a ser senior para obtener ayuda de ingeniería tipo senior.** Esta frase es una aspiración de experiencia, no una equivalencia demostrada con un ingeniero humano.

## 9. La tesis de capacidad: la arquitectura también importa

**[HIPÓTESIS CENTRAL]** Una arquitectura de dirección —con buena descomposición, memoria de decisiones, prompts acotados, ejecución instrumentada y verificadores externos— puede elevar de forma notable el rendimiento efectivo de modelos de programación, incluidos modelos menos costosos o menos capaces.

El punto no es «añadir más razonamiento y obtener magia». La mejora vendría de **convertir una tarea larga e incierta en muchas tareas precisas, acompañadas por controles que permiten detectar errores y cambiar de estrategia**.

Puede haber ganancias en:

- Probabilidad de terminar correctamente una tarea.
- Reducción de omisiones de requisitos.
- Autonomía sostenida durante ciclos largos.
- Menor cantidad de intervención humana.
- Trazabilidad y confiabilidad de la entrega.
- Costo por tarea realmente completada.

También puede haber pérdidas:

- Gastos adicionales en tokens y herramientas.
- Mayor latencia.
- Errores de planificación que contaminan varios sprints.
- Acumulación de correcciones deficientes.
- Coordinación redundante o sobreingeniería.

**No se asumirá que un modelo económico + Auton vence a un modelo potente. Esa comparación es un experimento, no un eslogan.**

## 10. Una definición honesta de innovación

La novedad no puede residir simplemente en tener un orquestador, subagentes, planes, auto-wake o tests: existen herramientas con capacidades semejantes.

La innovación defendible tendría que surgir de una **combinación específica, reproducible y efectiva** de decisiones de diseño, como:

1. Separar intención humana, juicio de ingeniería y verificación empírica.
2. Mantener un contrato estable para el objetivo mientras cambia la implementación.
3. Dirigir ejecutores reemplazables mediante briefs pequeños y criterios de aceptación ejecutables.
4. Persistir decisiones y evidencias más allá de la ventana de contexto.
5. Reintentar con diagnósticos, no con órdenes genéricas de «intenta otra vez».
6. Comparar rutas de solución y estimar cuándo dejar de insistir.
7. Escalar solo decisiones de producto, riesgo y bloqueos de alta incertidumbre.
8. Demostrar mejoras frente a una base equivalente.

**[HIPÓTESIS]** Si este conjunto produce mejoras grandes y repetibles, podría representar un avance práctico en autonomía de ingeniería. Llamarlo avance científico requeriría una metodología rigurosa, baselines, replicación y delimitación clara de la contribución.

---

# PARTE IV — EL CASO REAL: LUNAR MÓVIL

## 11. El problema que dio origen al producto

**[VISIÓN ORIGINAL]** Lunar existe como aplicación web en el repositorio `chatbot-standalone`. El desafío es llevar su experiencia a Android nativo en Kotlin, con paridad de funciones esenciales y sin modificar el backend ni el producto web existente.

El alcance registrado en el documento original incluye, entre otros elementos:

- Chat con streaming.
- Microchats.
- Espacios.
- Árbol y mapa de estudio.
- Anclas.
- Biblioteca.
- Memoria.
- Cuenta de usuario.
- Pagos.

Existe un paquete de trabajo definido en **100 unidades P-001 a P-100**, junto con objetivos, briefs, skills Android y recetas de evidencia en una estructura descrita como `mobile-kotlin/auton/`.

La existencia de esa estructura procede del documento original; **no se ha inspeccionado su contenido en esta revisión**.

## 12. Por qué Lunar Móvil valida el problema

Una persona construyendo un producto complejo puede preparar muchos prompts, pero administrar manualmente cada uno no escala bien:

```text
P-001 → revisar → pegar P-002 → pedir test → corregir
      → recordar regla original → pegar P-003 → revisar...
```

La necesidad concreta es:

> «Quiero crear Lunar Móvil. Debe ser Android nativo, preservar el backend y mantener las funcionalidades requeridas. Apruebo el plan y las decisiones importantes, pero no quiero dirigir cada iteración de codificación».

Esa es una necesidad genuina del propio creador. No se inventa un problema para justificar un hackathon.

## 13. Qué significa éxito con Lunar Móvil

**No es necesario afirmar que se construirán las 100 unidades durante el hackathon.** De hecho, eso sería una promesa de alto riesgo.

Propuesta de demostración inicial:

1. Cargar el contexto, restricciones y dependencias de Lunar.
2. Elegir un vertical slice de Android acotado y relevante, por ejemplo autenticación existente + pantalla de chat + streaming, según viabilidad real.
3. Que Auton genere un plan y criterios de aceptación antes de codificar.
4. Que el usuario apruebe la dirección.
5. Que Auton delegue varios sprints de implementación.
6. Que se ejecute compilación real y pruebas relevantes.
7. Introducir o encontrar un fallo real y que el sistema intente resolverlo sin intervención manual.
8. Guardar evidencia de los cambios y del resultado.
9. Mostrar un artefacto Android ejecutable o una prueba demostrable de la funcionalidad acordada.

**Advertencia:** la disponibilidad de backend, cuentas de prueba, claves, emulador, entorno Android y dependencias puede determinar el alcance final. Deben resolverse antes de prometer una funcionalidad específica.

## 14. Lunar como cliente, laboratorio y prueba de fuego

Lunar sirve a la vez como:

- **Cliente cero:** existe una necesidad que Auton intenta resolver.
- **Proyecto de dogfooding:** Auton trabaja sobre una necesidad propia y compleja.
- **Prueba de continuidad:** existen decenas de unidades potenciales, no un único prompt.
- **Prueba de restricciones:** no tocar backend ni web es un contrato verificable.
- **Fuente de datos de investigación:** cada sprint produce información de éxito, costo, fallos e intervenciones.

Si Auton únicamente completa una tarea sencilla y la muestra con una interfaz bonita, Lunar no habrá validado la visión. Si consigue llevar varias etapas independientes con evidencia y restricciones, el argumento será mucho más fuerte.

---

# PARTE V — PRODUCTO Y EXPERIENCIA

## 15. La nueva presencia del producto

**[DECISIÓN ACTUAL]** Auton es ahora una **aplicación web**. Su interfaz web debe entenderse como parte vigente del proyecto.

**[DECISIÓN ACTUAL]** Para el hackathon, el objetivo es **Auton Desktop**, construido mediante un **fork de ZCode** que será adaptado a la identidad, experiencia y arquitectura de Auton.

No se trata de «volver al CLI». La terminal seguirá siendo una herramienta de trabajo de los agentes, pero no es la identidad principal del producto.

### Roles de cada superficie

| Superficie | Papel propuesto |
|---|---|
| Auton Web | Experiencia existente; posible acceso remoto, gestión de proyectos o continuidad de sesiones según capacidades reales |
| Auton Desktop | Entorno principal de demostración y ejecución local de proyectos durante el hackathon |
| Motor de orquestación | Núcleo reutilizable que no debe depender exclusivamente de Electron ni de los componentes visuales |
| CLI / herramientas terminal | Herramientas internas de ejecución, testing, git, compilación y depuración |

**[PROPUESTA]** Evitar dos productos separados con lógica duplicada. Diseñar un motor que pueda sostener web y desktop aunque inicialmente solo una superficie lo use completamente.

## 16. Experiencia principal: hablar con un ingeniero, no con diez bots

La experiencia ideal comienza con una conversación:

**Usuario:** «Quiero Lunar Móvil. Kotlin nativo. Paridad con la web, pero no toques el backend. Necesito que el chat funcione primero».

**Auton:** entiende el objetivo, identifica ambigüedades, inspecciona el repositorio y propone el plan. El usuario no recibe un muro de log.

**Usuario:** «Apruebo. Prioriza el streaming y la estabilidad».

**Auton:** prepara los sprints, delega implementación y verifica. Mientras trabajan los ejecutores, el usuario puede preguntar por el estado, cambiar prioridades o introducir decisiones nuevas.

**Auton:** entrega una síntesis breve de qué se hizo, qué se probó, qué falló, cómo se corrigió y qué sigue.

### Principios de interacción

1. **Una conversación principal.** Los agentes internos no invaden el chat del usuario.
2. **El usuario habla en objetivos de producto.** Auton traduce a tareas técnicas.
3. **El trabajo es visible, no ruidoso.** Board, eventos y evidencias expandibles.
4. **El usuario siempre puede pausar, redirigir o cancelar.**
5. **La aprobación humana tiene sentido.** No se pregunta por decisiones técnicas triviales, sí por cambios de alcance, gastos, permisos o decisiones irreversibles.
6. **El estado sobrevive a cierres e interrupciones.**
7. **Nunca se disfraza una suposición de una verificación.**

## 17. Interfaz desktop: componentes esenciales

**[PROPUESTA]** La aplicación de escritorio debería priorizar cinco áreas:

### 17.1. Goal Workspace

Una tarjeta de objetivo con propósito, alcance, exclusiones, estado, presupuesto, riesgos y definición de éxito.

### 17.2. Sprint Board

El elemento visual fuerte heredado de la visión original:

- Sprints pendientes, activos, bloqueados, fallidos y completados.
- Objetivos y criterios de aceptación de cada sprint.
- Dependencias.
- Ejecutor responsable.
- Tiempos y presupuesto.
- Resultados de los verificadores.
- Estado persistido.

### 17.3. Activity Feed legible

En vez de transmitir miles de tokens en bruto:

- «Auton decidió dividir el módulo de streaming».
- «Programmer modificó 4 archivos en el scope permitido».
- «Tester detectó regresión en reconexión».
- «Auton preparó un retry con diagnóstico».
- «Sprint aprobado: build y tests relevantes superados».

Cada evento importante se puede expandir para ver el detalle original cuando sea necesario.

### 17.4. Evidence Inspector

Para cada resultado:

- Qué requisito se pretendía satisfacer.
- Qué archivos cambiaron.
- Qué comandos se ejecutaron.
- Qué pruebas pasaron y cuáles no.
- Qué artefactos se generaron.
- Qué sigue sin demostrarse.

### 17.5. Decision Inbox

Un espacio muy pequeño para decisiones que verdaderamente necesita el humano:

- Elecciones de producto no inferibles.
- Riesgo de borrar o sobrescribir datos.
- Cambios de arquitectura con consecuencias grandes.
- Acceso a recursos, credenciales o despliegues.
- Bloqueos persistentes tras agotar rutas de corrección razonables.

---

# PARTE VI — ARQUITECTURA DE DIRECCIÓN

## 18. Arquitectura lógica del sistema

```text
┌──────────────────────────────────────────────────────────────────┐
│                         CREADOR                                  │
│          Intención · Prioridades · Restricciones · Aprobación     │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     AUTON EXPERIENCE                             │
│       Conversación · Goal Workspace · Sprint Board · Evidencia    │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   AUTON ORCHESTRATOR                              │
│  Goal Contract · Plan · Decision Engine · Context · Risk Policy    │
└────────────┬─────────────────┬─────────────────┬─────────────────┘
             │                 │                 │
             ▼                 ▼                 ▼
      SPRINT ENGINE      MEMORY / SKILLS    SUPERVISOR
      Dependencias       Decisiones         Jobs durables
      Briefs + DoD       Continuidad        Retries / Wake
             │                 │                 │
             └─────────────────┼─────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   EXECUTOR ADAPTERS                              │
│                ZCode · Codex · Claude Code · otros                 │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    VERIFICATION LAYER                            │
│      Build · Tests · Typecheck · Lint · Visual · Scope · Git       │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      EVIDENCE GATE                               │
│       PASS → commit / avanzar · FAIL → diagnosticar / retry        │
│                  UNCERTAIN → investigar / escalar                 │
└──────────────────────────────────────────────────────────────────┘
```

**[PROPUESTA]** Separar control plane (dirección), execution plane (ejecución) y evidence plane (verificación). No es obligatorio implementar tres servicios físicos para lograr esta separación; al principio pueden ser módulos dentro del mismo proceso.

## 19. Los tres oficios se mantienen

### 19.1. BRAIN — Orchestrator

No debería convertirse en un agente que escribe todo el código personalmente. Su valor está en dirigir:

- Comprender intención y restricciones.
- Elaborar arquitectura y rutas de ejecución.
- Descomponer trabajo en sprints verificables.
- Elegir y parametrizar motores de programación.
- Construir briefs acotados.
- Leer evidencia, detectar incoherencias y ajustar el plan.
- Decidir PASS / retry / replanning / escalate.
- Preservar decisiones importantes.
- Comunicar al usuario solo lo relevante.

El orquestador **representa funcionalmente parte del papel del usuario-desarrollador actual**: usa otras IAs con criterio y método. No sustituye la propiedad del producto ni la autoridad del humano.

### 19.2. HANDS — Programmer

- Implementa archivos reales.
- Trabaja dentro de un scope declarado.
- Recibe un brief corto y suficiente.
- Informa cambios, comandos y resultados.
- No cierra un sprint por simple declaración.
- Puede operar sobre un motor reemplazable.

En la versión inicial puede haber **un solo programmer**. Múltiples ejecutores en paralelo no son requisito del MVP.

### 19.3. JUDGE — Tester / Verifier

- Comprueba criterios de aceptación.
- Corre comandos reproducibles.
- Ejecuta build, lint, typecheck y tests cuando aplique.
- Realiza verificaciones visuales o de comportamiento cuando sea factible.
- Detecta cambios fuera de scope.
- Conserva evidencia estructurada.
- No confunde «las pruebas pasaron» con «el sistema carece de defectos».

**Separación esencial:** el modelo que hizo el trabajo no debe ser la única fuente de verdad sobre su calidad.

## 20. El contrato del objetivo (Goal Contract)

Cada proyecto inicia con un acuerdo entre intención y ejecución:

```yaml
id: goal-lunar-android
purpose: Llevar las capacidades principales de Lunar a Android nativo.
user_intent: Quiero una app Android utilizable sin dirigir cada tarea técnica.
constraints:
  - Kotlin nativo
  - No modificar el backend existente
  - No modificar la aplicación web existente
  - Trabajar en un repositorio Android separado
required_capabilities:
  - Chat con streaming
  - Autenticación compatible
out_of_scope:
  - Reescribir la infraestructura de Lunar
human_decisions:
  - Cambios de alcance funcional
  - Permisos y secretos
  - Modificaciones arquitectónicas irreversibles
success_evidence:
  - Compilación Android reproducible
  - Pruebas relevantes y trazables
  - Demonstración del flujo acordado
```

*El YAML es ilustrativo, no una representación de un esquema ya implementado.*

El contrato debe ser estable a lo largo de los sprints. Si el usuario cambia un objetivo, Auton registra qué cambió y qué partes del plan dejan de ser válidas.

## 21. Descomponer correctamente el trabajo

**[VISIÓN ORIGINAL]** Para proyectos grandes, Auton favorece planes con muchas tareas pequeñas y verificables. La visión inicial rechazaba condensar arbitrariamente proyectos extensos en tres tareas genéricas y proponía, como principio, no menos de ocho sprints para un producto.

**[PROPUESTA DE MATIZ]** Conservar la intención de descomposición profunda, pero evitar imponer un número rígido de sprints cuando no represente el trabajo. La cantidad correcta debe depender del tamaño, riesgo, dependencias y verificabilidad. Para Lunar, cien unidades ya hacen explícita la complejidad.

Cada sprint debería tener:

```yaml
sprint_id: P-017
purpose: Implementar reconexión básica del streaming.
dependencies: [P-012]
scope:
  allow:
    - app/src/main/java/.../chat/**
  deny:
    - backend/**
    - web/**
acceptance:
  - La conexión se reestablece después de un corte simulado.
  - El estado de conversación no se duplica.
verification:
  - ./gradlew assembleDebug
  - ./gradlew testDebugUnitTest
retry_policy:
  max_attempts: 3
```

*Ejemplo inventado para especificar diseño; no representa el contenido real de P-017.*

Un buen sprint termina en un resultado verificable, no solo en un archivo modificado.

## 22. Los briefs: contexto mínimo suficiente

Un ejecutor no debería recibir indiscriminadamente todo el historial de chat.

Su brief debería incluir:

1. Identificador y propósito del sprint.
2. Resultado esperado.
3. Archivos y carpetas permitidos.
4. Restricciones heredadas del contrato del objetivo.
5. Decisiones técnicas aplicables.
6. Dependencias y cambios recientes relevantes.
7. Definition of Done (DoD).
8. Comandos de verificación.
9. Ruta para reportar evidencia y bloqueos.

Esta organización intenta reducir ruido, pérdidas de contexto y conflictos entre tareas.

## 23. Loop principal: PLAN → BUILD → VERIFY → LEARN → CONTINUE

```text
1. Interpretar objetivo
2. Proponer plan / confirmar dirección
3. Elegir sprint listo
4. Generar brief + DoD
5. Delegar a programmer
6. Recoger diff, comandos y resultados
7. Ejecutar verificaciones independientes
8. Clasificar:
   PASS       → registrar evidencia, commit seguro, siguiente sprint
   FAIL       → diagnosticar causa, reintentar con hipótesis corregida
   UNCERTAIN  → ampliar verificaciones o pedir revisión
   BLOCKED    → replantear o escalar una decisión al humano
9. Persistir estado
10. Continuar automáticamente cuando sea seguro
```

**[VISIÓN ORIGINAL]** El límite inicial de reintentos es tres. La cifra es una política de partida, no una ley universal. Lo relevante es evitar loops infinitos, gasto sin progreso y escaladas prematuras.

### Auto-wake no es solo enviar otro prompt

Auto-wake significa que el **sistema controla el ciclo de trabajo** y puede reanudar un job tras una interrupción o después de obtener evidencia suficiente. Un mensaje «continúa» generado automáticamente, sin estado y sin criterios, no reproduce ese comportamiento.

### Reinicio y recuperación

El sistema debería poder responder después de reiniciar:

- Qué objetivo estaba activo.
- Qué sprints terminaron de verdad.
- Qué trabajo quedó a medias.
- Qué verificación falta.
- Qué artefactos se crearon.
- Qué acciones son seguras de reanudar.

## 24. Estados mínimos para un sprint

```text
PENDING
  → READY
  → RUNNING
  → VERIFYING
       ├─ PASS       → COMMITTED → DONE
       ├─ FAIL       → RETRY_READY → RUNNING
       ├─ UNCERTAIN  → INVESTIGATING
       └─ BLOCKED    → ESCALATED
```

Un sprint no debe marcarse `DONE` por terminar una respuesta del modelo. Solo puede cerrarse si la evidencia obligatoria está completa o si existe una excepción explícita registrada y aceptada.

**[PROPUESTA]** Registrar transiciones como eventos inmutables o auditables para reconstruir por qué el sistema avanzó.

## 25. Memoria: cuatro capas que no se confunden

Se conserva la estructura de la visión inicial:

| Capa | Contenido | Propósito |
|---|---|---|
| L1 — Ventana | Contexto inmediato de una operación | Razonar sobre una tarea activa |
| L2 — Sesión | Estado durable, board, eventos y resultados | Continuar tras interrupciones |
| L3 — Proyecto | Arquitectura, restricciones y decisiones | No reabrir decisiones ya tomadas sin causa |
| L4 — Skills | Playbooks de tareas especializadas | Reutilizar conocimiento procedimental |

No toda salida del modelo debe transformarse en memoria. Se priorizan **hechos verificados, decisiones explícitas y aprendizajes con evidencia**.

## 26. El Evidence Gate: la credibilidad del sistema

Auton debe distinguir:

- **Declaración:** «implementé autenticación».
- **Observación:** «modifiqué estos archivos».
- **Prueba:** «el comando terminó con código 0».
- **Conclusión limitada:** «la compilación pasó; la autenticación de extremo a extremo todavía no está probada».

Una buena evidencia vincula:

```text
Requisito → Sprint → Commit/Diff → Pruebas → Artefactos → Veredicto
```

Ejemplos de evidencia:

- Log de compilación con timestamp y exit code.
- Resultado de tests y cobertura relevante, cuando exista.
- Capturas o grabaciones generadas por pruebas visuales.
- Diff y hash de commit.
- Manifest de archivos cambiados.
- Reporte de accesos fuera de scope.
- Limitaciones conocidas del veredicto.

La evidencia debería permitir a una persona auditar el progreso sin leer todo el razonamiento interno de los modelos.

## 27. Error handling: causa raíz antes que parches

Reintentar no significa ejecutar el mismo prompt tres veces.

Protocolo propuesto:

1. Clasificar la falla: compilación, contrato, comportamiento, entorno, dependencia o incertidumbre.
2. Identificar qué cambió desde el último estado válido.
3. Formular una hipótesis específica.
4. Proponer la corrección menos invasiva que aborda la causa.
5. Ejecutar pruebas relacionadas y regresiones pertinentes.
6. Actualizar el plan si el problema es arquitectónico.
7. Escalar si se agota el presupuesto, persiste la incertidumbre o el riesgo excede la autorización.

**Una reparación que hace pasar un test debilitando la prueba no cuenta como progreso.**

---

# PARTE VII — AUTON DESKTOP SOBRE ZCODE

## 28. ¿Por qué partir de ZCode?

El proyecto público ZCode describe un espacio de trabajo de programación con interfaces de **desktop, web y terminal**, componentes UI compartidos, servicios backend y código de runtime/CLI de agentes.

El repositorio público se encuentra en:

- https://github.com/zai-org/ZCode
- Documentación general: https://github.com/zai-org/ZCode/blob/main/README.en.md

Su estructura documentada incluye:

```text
packages/desktop          → Electron y empaquetado desktop
packages/web              → Cliente web
packages/server           → Servicios HTTP/WebSocket
packages/ui               → React, hooks y estado compartido
packages/services         → Servicios de negocio/persistencia
packages/shared, rpc...   → Protocolos y tipos
apps/zcode-cli            → CLI, TUI, runtime y herramientas del agente
```

**[HECHO EXTERNO VERIFICADO AL 27-10-2026]** Es una base pública y documentada. El proyecto indica licencia Apache-2.0; las condiciones exactas, componentes de terceros y avisos aplicables deben verificarse antes de redistribuir.

### El razonamiento estratégico

No conviene gastar gran parte del hackathon escribiendo desde cero:

- Ventanas y empaquetado Electron.
- Navegación de repositorios.
- Editor o visor de archivos.
- Terminal y procesos.
- Paneles de actividad.
- Integración básica con agentes.
- Transporte de eventos.

Ese tiempo debería invertirse en **la aportación propia de Auton: dirección, decisiones, verificación y continuidad**.

## 29. Riesgo de convertirse en un rebranding

Forkear ZCode no constituye por sí mismo una innovación en autonomía.

El proyecto sería débil si la única diferencia observable fuese:

- Logo Auton.
- Colores nuevos.
- Panel de sprints cosmético.
- Prompts de orquestación sin evidencia de mejora.

El proyecto tendría una contribución propia identificable si añadiera:

1. Contratos de objetivos y decisiones persistentes.
2. Orquestador que dirige herramientas externas.
3. Protocolo de briefs y criterios verificables.
4. Tester independiente y evidencia estructurada.
5. Supervisor durable para iteraciones largas.
6. Política de retries y escaladas basada en diagnósticos.
7. Benchmarks que muestren resultados atribuibles a esos componentes.

## 30. Estrategia de fork

**[PROPUESTA]**

### Fase A — Clonar y reproducir

- Identificar commit base de ZCode.
- Montar toolchain según su documentación y `mise.toml`.
- Confirmar que la app desktop arranca sin modificaciones.
- Registrar la versión de referencia y licencias.
- Comprobar que el flujo de coding base funciona localmente.

### Fase B — Aislar la marca y experiencia

- Renombrar producto y metadatos propios donde sea legítimo.
- Sustituir identidad gráfica y rutas de datos sin destruir compatibilidad.
- Añadir Goal Workspace, Sprint Board, Evidence Inspector y Decision Inbox.
- Evitar cambios extensos innecesarios al runtime original.

### Fase C — Introducir Auton Core

- Definir interfaces entre UI, orquestador, supervisor y executors.
- Guardar eventos y estado del goal.
- Implementar delegación de un sprint.
- Añadir verification gate y auto-continue.

### Fase D — Instrumentar y medir

- Hacer correr las mismas tareas en ZCode base y Auton.
- Registrar model ID, presupuesto, comandos, resultados y errores.
- Capturar una demo reproducible.

## 31. Interfaces del núcleo (propuesta)

```ts
// Boceto arquitectónico, no API implementada.
type GoalContract = {
  id: string;
  intent: string;
  constraints: string[];
  acceptance: AcceptanceCriterion[];
  approved: boolean;
};

type Sprint = {
  id: string;
  goalId: string;
  dependencies: string[];
  scope: FileScope;
  brief: string;
  checks: VerificationCheck[];
  status: SprintStatus;
};

type ExecutorAdapter = {
  start(sprint: Sprint): Promise<ExecutionHandle>;
  observe(handle: ExecutionHandle): AsyncIterable<ExecutionEvent>;
  cancel(handle: ExecutionHandle): Promise<void>;
};

type Verifier = {
  verify(sprint: Sprint, output: ExecutionOutput): Promise<Verdict>;
};

type Verdict = {
  kind: "PASS" | "FAIL" | "UNCERTAIN" | "BLOCKED";
  evidenceIds: string[];
  reasons: string[];
};
```

Esta separación permitiría adaptar distintas herramientas sin forzar que todas operen con un único modelo ni un único protocolo interno.

## 32. Qué NO hacer durante el hackathon

- Reescribir todo ZCode para que «se sienta original».
- Construir una flota multiagente si un solo executor aún falla.
- Duplicar la app web completa dentro de Electron por estética.
- Comprometerse a terminar Lunar Móvil entero.
- Añadir decenas de skills no validadas.
- Desarrollar una infraestructura distribuida cuando un supervisor local durable es suficiente.
- Gastar días en personalización visual sin un benchmark funcional.
- Publicar una ventaja competitiva basada exclusivamente en una demo seleccionada.

---

# PARTE VIII — INVESTIGACIÓN Y VALIDACIÓN

## 33. Preguntas de investigación

La visión 2.0 tiene que poder expresarse como preguntas que admitan respuesta empírica:

**RQ1.** ¿Auton mejora la tasa de tareas correctamente completadas frente al mismo ejecutor sin su protocolo?

**RQ2.** ¿Reduce la cantidad de decisiones técnicas e intervenciones manuales necesarias para llegar al resultado?

**RQ3.** ¿Un modelo menos capaz dirigido por Auton alcanza o se acerca al desempeño de un modelo más potente usado directamente, a un costo competitivo?

**RQ4.** ¿Qué módulos generan la mejora: planificación, briefs, memoria, verificación, retries o su combinación?

**RQ5.** ¿Cómo se comporta al crecer el horizonte de tarea, por ejemplo de 1 a 10 o 30 sprints?

**RQ6.** ¿Es capaz de recuperarse de fallos de proceso, contexto y herramientas sin corromper el proyecto?

## 34. Las cuatro configuraciones de comparación

Una matriz básica:

| Configuración | Orquestación | Modelo ejecutor | Qué mide |
|---|---|---|---|
| A — Base económico | ZCode original | Económico | Línea base de un modelo accesible |
| B — Auton económico | Auton | El mismo económico | Valor incremental de la arquitectura |
| C — Base potente | ZCode original | Potente | Nivel de referencia de mayor capacidad |
| D — Auton potente | Auton | El mismo potente | Si el protocolo también ayuda con modelos fuertes |

Las comparaciones deben controlar, tanto como sea posible:

- Versión del repositorio y estado inicial.
- Enunciado de cada tarea.
- Permisos y herramientas disponibles.
- Modelos concretos y versiones.
- Límite de tiempo y gasto.
- Número máximo de intentos.
- Ejecución de pruebas externas.
- Criterio de éxito definido antes de observar resultados.

**Importante:** una comparación justa debe considerar también que ZCode tiene características de planificación y autonomía. No se debe caricaturizar al baseline como un sistema incapaz de iterar.

## 35. Métricas principales

### Tasa de éxito verificado

```text
Tasa de éxito = tareas aprobadas por el evaluador externo / tareas intentadas
```

### Intervención humana

```text
Intervenciones por tarea = decisiones o correcciones manuales requeridas
```

Distinguir consultas legítimas sobre producto de rescates técnicos causados por fallos del sistema.

### Costo por tarea correcta

```text
Costo por tarea correcta = costo total de ejecución / número de tareas correctas
```

Contabilizar todos los modelos, herramientas y retries, no solo el precio por token del programmer.

### Tiempo por tarea correcta

Medir tiempo real transcurrido y, por separado, tiempo humano activo.

### Confiabilidad de continuidad

Porcentaje de ejecuciones que reanudan correctamente tras una interrupción simulada.

### Calidad de evidencia

Proporción de sprints `DONE` para los cuales puede reconstruirse el vínculo entre criterio y prueba.

## 36. Diseño experimental mínimo razonable

**[PROPUESTA]**

- Seleccionar **al menos 20 tareas independientes** si el presupuesto lo permite; para un demo preliminar de hackathon se puede ejecutar un subconjunto y declarar que es exploratorio.
- Mezclar bug fixes, nuevas features, tests faltantes, refactors con restricciones y tareas de integración.
- Congelar el conjunto de pruebas antes de correr agentes.
- Repetir ejecuciones si existe variabilidad relevante.
- No permitir correcciones humanas invisibles.
- Conservar fallos además de éxitos.
- Mantener resultados de un evaluador independiente del agente que produce el código.
- Publicar configuración y límites, evitando credenciales o código privado no autorizado.

### Ablations: comprobar qué aporta cada módulo

| Prueba | Componentes activos |
|---|---|
| Base | Executor original |
| + Plan | Contratos y sprints |
| + Verify | Plan y verificaciones independientes |
| + Retry | Plan, verify y diagnósticos de corrección |
| + Memory | Añadir decisiones persistentes |
| Auton completo | Todos los módulos del MVP |

Así se evita atribuir un resultado al «razonamiento de Auton» cuando quizá proviene simplemente de más tiempo o más llamadas al modelo.

## 37. Resultado que justificaría seguir construyendo

Los objetivos siguientes son **criterios de decisión internos sugeridos**, nunca benchmarks observados:

- A igualdad de presupuesto, una mejora consistente en la tasa de éxito.
- O bien, a igualdad de tasa de éxito, menor coste por tarea completada.
- O bien, una reducción sustancial de intervención humana sin deteriorar calidad.
- Continuidad real sobre varias tareas, no solo una ejecución individual.

El proyecto puede ser valioso si logra una de estas mejoras de manera robusta. Si no logra ninguna, debe revisarse la hipótesis arquitectónica en vez de protegerla con más marketing.

---

# PARTE IX — META GLOBAL AI DEVELOPER HACKATHON 2026

## 38. Por qué encaja en los dos temas oficiales

La página oficial del evento plantea dos temas:

**Build for Your World:** usar los modelos de Meta para resolver un problema conocido personalmente, ahorrar tiempo y capacidad mental o habilitar algo antes difícil.

**Push the Frontier:** usar los modelos de Meta para explorar capacidades nuevas, incluidos retos en software.

Fuentes oficiales:

- https://dev.meta.ai/events/global-hackathon
- https://events.cerebralvalley.ai/e/meta-ai-developer-hackathon

### Argumento 1 — Build for Your World

> «Soy un creador que está construyendo Lunar. Necesito llevarlo a Android nativo con decenas de unidades de trabajo y restricciones de compatibilidad. Las herramientas de coding me ayudan a producir código, pero todavía consumo mucho tiempo coordinándolas, detectando omisiones y reiniciando el trabajo. Auton nace para resolver esa necesidad real».

Este argumento tiene la ventaja de la autenticidad. **Lunar Móvil es el dolor de origen y una prueba de uso real.**

### Argumento 2 — Push the Frontier

> «Auton investiga una nueva capa de autonomía: un director de ingeniería que gobierna coders reemplazables mediante contratos, planes, verificación independiente y ciclos duraderos. Queremos medir si esa arquitectura permite resolver tareas más largas y mejorar el rendimiento efectivo de modelos existentes».

Este argumento tiene la ventaja de la ambición técnica. Pero **la afirmación de avance necesita pruebas**, no solo un diagrama.

### Relación de ambos argumentos

```text
Problema del mundo del creador
        ↓
Lunar Móvil exige ingeniería sostenida
        ↓
Auton intenta delegar la dirección técnica
        ↓
Nuevo protocolo de autonomía y verificación
        ↓
Lunar Móvil sirve de prueba real
        ↓
Benchmarks independientes miden el avance generalizable
```

No hay contradicción: la necesidad real motiva el experimento técnico.

## 39. Uso sustancial de Muse

El evento invita a construir con modelos Muse y otras herramientas de Meta. Para que Auton sea una candidatura coherente, Muse debería participar en una función **central y demostrable** del sistema.

**[PROPUESTA]** Explorar Muse como razonador del orquestador:

- Interpretación y clarificación de objetivos.
- Diseño de planes y dependencias.
- Selección de estrategias de implementación.
- Construcción de briefs para coders.
- Análisis de errores y decisiones de retry.
- Replanificación ante fallos repetidos.
- Síntesis de evidencia para el usuario.

El ejecutor podría ser Muse u otro motor compatible, dependiendo de integraciones y reglas aplicables.

### Lo que no sería suficiente

- Poner un selector «Muse» sin demostrar su uso.
- Añadir una pantalla secundaria de chat de Meta.
- Generar la descripción del README con Muse, pero dejar intacta la arquitectura central.

### Prueba de integración sustancial

Realizar un experimento en el que se compare el protocolo con y sin una capacidad clave basada en Muse —por ejemplo, análisis estructurado de fallos— manteniendo constantes las demás variables en lo posible.

**[POR VERIFICAR]** Disponibilidad del modelo elegido, límites de API, precio, compatibilidad de herramientas y condiciones de participación.

## 40. Qué deben ver los jueces

El video debería demostrar una secuencia de valor, no una visita turística por todas las pantallas:

1. **Dolor real:** un creador necesita Lunar Móvil y no puede supervisar cien prompts manualmente.
2. **Intención humana:** define objetivo y restricciones en lenguaje natural.
3. **Traducción de ingeniería:** Auton detecta dependencias, forma sprints y pide aprobar dirección.
4. **Delegación real:** Auton invoca un motor de programación y modifica archivos del proyecto.
5. **Verificación:** se ejecutan tests o compilación y aparece evidencia.
6. **Fallo y recuperación:** el tester descubre algo y Auton lo corrige sin instrucciones paso a paso del humano.
7. **Resultado:** app, funcionalidad o artefacto comprobable, no solo código mostrado en pantalla.
8. **Comparación:** un dato claro sobre cuánto mejor funcionó Auton en tareas comparables, si la evidencia lo soporta.

**Momento decisivo:** mostrar al usuario alejado del trabajo técnico mientras Auton coordina varias iteraciones y vuelve con un resultado verificable.

## 41. Entregables recomendados

- Aplicación Auton Desktop que funcione en un entorno comprobado.
- Código con contribuciones propias identificables respecto al fork.
- README con instalación, requisitos y pasos reproducibles.
- Video que muestre la ejecución real.
- Caso Lunar Móvil con objetivo, sprints, evidencias y artefactos.
- Benchmark exploratorio con resultados completos y limitaciones.
- Diagrama de arquitectura.
- Registro de licencias y atribuciones del fork.
- Explicación clara de qué componente utiliza los modelos de Meta.

## 42. Fechas y reglas: no improvisar

Según la página oficial consultada el **27 de octubre de 2026**:

| Hito | Fecha oficial publicada |
|---|---|
| Inicio del hackathon | 26 de octubre de 2026 |
| Talleres | 27 de octubre – 4 de noviembre |
| Fecha límite de entrega | **4 de noviembre de 2026, 9:00 p. m. ET** |
| Evaluación | 4–8 de noviembre |
| Final / anuncio | 9 de noviembre |

El 4 de noviembre la costa este de Estados Unidos está en horario estándar (UTC−5), por lo que esa hora coincide con las **9:00 p. m. de Colombia**. No debe confundirse con el horario de verano de octubre.

**Importante:** estos datos no sustituyen las reglas completas aceptadas dentro del portal del participante. Antes de enviar hay que comprobar especialmente:

- Participación aceptada y categoría seleccionada.
- Reglas sobre código escrito antes del evento.
- Reglas sobre forks y dependencias de terceros.
- Uso obligatorio o elegibilidad de modelos Meta.
- Derechos sobre demo, datos de proyectos y código mostrado.
- Material y formato de entrega.

**No se afirma aquí que el fork sea automáticamente elegible:** eso debe verificarse en las reglas oficiales. La estrategia honesta es identificar con precisión qué se desarrolló durante el hackathon.

---

# PARTE X — PLAN DE CONSTRUCCIÓN

## 43. MVP realista para el hackathon

El MVP no es una empresa completa ni un copiloto universal. Es una prueba integrada de la tesis.

### Obligatorio

- Desktop inicia y abre un proyecto local.
- Usuario define objetivo y restricciones.
- Orquestador genera y guarda sprints verificables.
- Usuario aprueba la dirección general.
- Programmer ejecuta un sprint real.
- Tester independiente corre pruebas o checks genuinos.
- La evidencia queda vinculada al sprint.
- En caso de fallo, Auton produce un diagnóstico y reintenta.
- El sistema avanza automáticamente tras un PASS.
- El usuario ve progreso en el Sprint Board.

### Deseable

- Reanudación robusta tras cierre inesperado.
- Soporte para dos tipos de ejecutor.
- Comparativa A/B integrada o exportable.
- Pruebas visuales en Android.
- Cancelación y redirección de objetivos activos.

### Fuera del MVP

- Cien sprints de Lunar completamente terminados.
- Orquestación distribuida a escala.
- Decenas de programadores concurrentes.
- Automatización universal de despliegues en producción.
- Memoria que aprende autónomamente sin evaluación.
- Garantía de código libre de defectos.

## 44. Camino crítico técnico

```text
Fork arranca
   ↓
Auton Core se integra
   ↓
Se puede crear un goal persistente
   ↓
Un sprint se ejecuta y modifica el repo
   ↓
Un verificador independiente produce un veredicto
   ↓
Un FAIL activa corrección; un PASS permite continuar
   ↓
Dos o más sprints encadenados sin intervención técnica humana
   ↓
Demo Lunar + benchmark contra baseline
```

El **camino crítico** es la cadena mínima que demuestra dirección delegada. Todo elemento que no contribuya a esa cadena debería posponerse si amenaza el plazo.

## 45. Plan sugerido de trabajo del 27 de octubre al 4 de noviembre

| Día | Principal entregable |
|---|---|
| 27 oct. | Auditar Auton Web y ZCode, cerrar alcance y elegir vertical slice de Lunar |
| 28 oct. | Fork desktop reproducible y Goal Contract persistente |
| 29 oct. | Orchestrator → programmer funcionando en una tarea real |
| 30 oct. | Verifier externo, evidence gate y una corrección automática |
| 31 oct. | Supervisor durable, auto-continue y Board conectado a eventos reales |
| 1 nov. | Integración central con Muse y primeras comparaciones controladas |
| 2 nov. | End-to-end Lunar Móvil, depuración y pruebas de recuperación |
| 3 nov. | Benchmark final, video, documentación y prueba desde entorno limpio |
| 4 nov. | Verificar elegibilidad, revisar artefactos y enviar a tiempo |

Este calendario es **una propuesta de priorización**, no una promesa ni una estimación garantizada de desarrollo. Si el fork presenta dificultades, recortar interfaz avanzada y mantener intacto el experimento de autonomía.

## 46. Criterios de salida del MVP

Se considerará que existe una demostración válida del MVP cuando, en una ejecución reproducible:

- El usuario define el objetivo una sola vez y aprueba el plan.
- Auton crea al menos dos sprints dependientes.
- Un executor modifica archivos reales en ambos.
- Un verificador produce resultados reales, no simulados.
- Se observa al menos un fallo detectado y una corrección basada en diagnóstico.
- No hace falta introducir manualmente «continúa» entre los sprints.
- Existe evidencia consultable para los sprints cerrados.
- El sistema respeta las carpetas prohibidas.
- La funcionalidad final puede probarse desde un entorno documentado.

Si alguno de estos puntos no se cumple, el video y el README deben decirlo con precisión.

---

# PARTE XI — SEGURIDAD, FIABILIDAD Y CONTROL

## 47. El usuario delega la ingeniería, no la autoridad

Auton no debe tomar decisiones irreversibles por simple autonomía.

### Acciones que pueden automatizarse con autorización previa

- Crear ramas de trabajo.
- Editar archivos dentro de scope.
- Ejecutar pruebas y compilaciones locales.
- Instalar dependencias permitidas por política.
- Crear commits al completar criterios explícitos.

### Acciones que deberían solicitar aprobación o bloquearse por defecto

- Borrar información fuera del workspace.
- Operar con credenciales no autorizadas.
- Publicar código o secretos.
- Desplegar a producción.
- Ejecutar comandos destructivos.
- Modificar infraestructura o pagos.
- Cambiar restricciones centrales sin aprobación.

## 48. Política de presupuesto

Toda ejecución necesita límites:

- Tiempo por goal y sprint.
- Costo de modelos y herramientas.
- Número de retries.
- Límite de cambios no verificados.
- Concurrencia.
- Acceso a red y sistema de archivos.

El sistema debería informar «no tengo evidencia suficiente dentro del presupuesto actual» antes que simular éxito.

## 49. Prevención del error compuesto

Un fallo del orquestador puede propagarse a muchos sprints. Mitigaciones:

1. Aprobación del contrato inicial.
2. Sprints pequeños con salidas verificables.
3. Pruebas de regresión.
4. Checkpoints y reversibilidad.
5. Detección de cambios fuera de alcance.
6. Revisión del plan tras fallos repetidos.
7. Escaladas por riesgo, no solo por número de retries.
8. Registro de decisiones y su evidencia.

Una app de escritorio con acceso al sistema local exige aún más cuidado con permisos, comandos y fuentes de instrucciones no confiables.

---

# PARTE XII — POSICIONAMIENTO Y NEGOCIO

## 50. Para quién se construye primero

### Usuario inicial

**Creador técnico o semitécnico** que ya utiliza asistentes de programación, tiene varios frentes abiertos y siente que todavía trabaja como gerente manual de los agentes.

### Problema que compra resolver

No quiere comprar «más generación de código». Quiere **menos supervisión técnica por unidad de software correctamente terminado**.

### Usuario secundario

Equipos pequeños que necesitan trazabilidad de decisiones, pruebas y continuidad, siempre que el sistema demuestre seguridad y control adecuados.

### Lo que no se promete todavía

Que cualquier persona sin experiencia construirá por sí sola aplicaciones seguras de producción; que Auton podrá reemplazar a un equipo entero; o que una arquitectura siempre compensa la falta de capacidad del modelo.

## 51. La competencia real

Auton compite y coopera con herramientas como ZCode, Claude Code, Codex, Cursor y plataformas de creación de aplicaciones.

No es correcto afirmar que todas carecen de orquestación, pruebas o auto-continuación: varias cuentan con funciones de ese tipo y evolucionan rápidamente.

La diferenciación propuesta debe sostenerse en:

- **Experiencia:** una capa de conversación de dirección, no microgestión de coders.
- **Protocolo:** contratos, briefs, planes, tests y replanificación cohesionados.
- **Observabilidad:** evidencia legible de por qué se cree que algo está terminado.
- **Portabilidad:** posibilidad de cambiar ejecutores sin rehacer la experiencia.
- **Resultados:** mejora medible de éxito, autonomía o eficiencia.

Las cuatro primeras son características; **la quinta determina si hay ventaja competitiva real**.

## 52. Foso posible, sin inventarlo

**[HIPÓTESIS]** Si el producto acumula workflows robustos, verificadores confiables, datos de errores y decisiones basadas en evidencia, podría desarrollar una ventaja difícil de reproducir rápidamente.

Pero hoy no se debe hablar de «foso consolidado» sin demostrar:

- Retención de usuarios.
- Casos de éxito replicables.
- Coste o calidad superiores.
- Skills y verificadores generalizables.
- Datos de operación que realmente mejoren los resultados.

---

# PARTE XIII — OBJECIONES QUE AUTON DEBE SOPORTAR

## 53. «Esto ya lo hace ZCode»

**Respuesta aceptable:** «Sí, ZCode y otros sistemas ya incorporan autonomía. Auton no reivindica haber inventado la planificación o los subagentes. Su contribución propuesta es un protocolo de dirección de ingeniería, evidencia y continuidad que debe demostrar mejoras frente al sistema base».

**Respuesta insuficiente:** «No, ellos solo programan y Auton piensa».

## 54. «Es solo un prompt más largo»

La respuesta deberá encontrarse en el sistema:

- Estado durable.
- Decisiones registradas.
- Criterios ejecutables.
- Verificadores independientes.
- Herramientas y permisos.
- Cambios reales de estrategia cuando fallan las pruebas.

Si esos componentes no funcionan, la crítica sería justa.

## 55. «Más agentes significa más gasto»

Puede ser cierto. Auton debe medir **costo por resultado correcto**, no costo por mensaje ni cantidad de modelos. Una solución que mejora éxito pero multiplica el coste por veinte puede servir para trabajos críticos; no necesariamente para tareas comunes.

## 56. «Un modelo pequeño no puede reemplazar a uno fuerte»

No hay razón para asegurar que pueda hacerlo siempre. La hipótesis es que **el protocolo puede ampliar su rendimiento efectivo en determinados tipos de trabajo**. Los casos en los que falle son tan importantes como los éxitos.

## 57. «El tester también puede estar equivocado»

Sí. La solución no es declarar infalible al Judge. Es combinar pruebas deterministas, análisis estructurados, experimentos, regresiones y reconocimiento explícito de incertidumbre.

## 58. «¿Por qué no contratar a un ingeniero?»

Auton no sustituye a un ingeniero experimentado en todos los contextos. Busca automatizar una parte repetitiva de la coordinación técnica para personas y equipos que no pueden asignar atención humana permanente a cada agente.

---

# PARTE XIV — PRINCIPIOS NO NEGOCIABLES 2.0

1. **La dirección de ingeniería es el producto.** No simplemente la producción de código.
2. **El humano mantiene la intención y la autoridad.**
3. **El orquestador traduce visión en plan ejecutable.**
4. **El programmer es reemplazable.** La calidad del sistema no debe depender de una sola marca de coder.
5. **El tester no es el mismo acto de escribir código.** Debe aportar evidencia independiente y limitada.
6. **Sin evidencia no hay `DONE`.**
7. **Breve para el ejecutor, claro para el usuario.** Brief, no dump.
8. **La planificación debe ser proporcional a la complejidad.** Ni tres pasos genéricos para cien tareas, ni sobreingeniería para cambios triviales.
9. **Causa raíz antes que parche.**
10. **El sistema recuerda decisiones, no el ruido completo de chat.**
11. **Autonomía durable y recuperable.** Reiniciar no debe borrar el oficio realizado.
12. **Las herramientas existentes son activos, no enemigos.** Reutilizar motores probados cuando convenga.
13. **Seguridad proporcional al riesgo.** Delegar no equivale a dar acceso irrestricto.
14. **Medición antes que superioridad declarada.**
15. **Primero un loop fiable, luego varios ejecutores.**
16. **La interfaz debe explicar el oficio.** Ni caja negra ni telemetría interminable.
17. **La capacidad de un modelo no determina por sí sola el resultado final.** Pero tampoco desaparece por tener un protocolo.
18. **No ajustar el problema para que la demo pase.** El benchmark debe resistir condiciones independientes.
19. **Producto por encima de espectáculo.** Demo bonita sin ejecución reproducible no basta.
20. **Si el usuario sigue teniendo que ser el harness, Auton todavía no cumplió su promesa.**

---

# PARTE XV — NORTE, DECISIONES Y PRÓXIMOS EXPERIMENTOS

## 59. North Star Metric

> **Horas de supervisión técnica humana evitadas por unidad de trabajo correctamente terminada, sin deterioro de calidad ni coste desproporcionado.**

Esta métrica conecta el problema humano con el comportamiento de ingeniería. Debe acompañarse de éxito verificado, coste por tarea y límites de riesgo.

## 60. Tres hitos para demostrar la tesis

### Hito 1 — El orquestador realmente dirige

Auton recibe una solicitud ambigua, aclara lo necesario, crea contratos y propone una ruta técnica con riesgos y condiciones de éxito.

### Hito 2 — El sistema realmente se autocorrige

Auton delega trabajo, el tester encuentra un error y el sistema corrige de forma causal sin instrucciones manuales sobre cada paso.

### Hito 3 — El sistema realmente mejora el resultado

Bajo condiciones comparables, el mismo coder produce con Auton mejores tasas de éxito, menos intervenciones o menor costo por trabajo correcto. Sin ese hito hay experiencia de producto, pero aún no hay evidencia suficiente de salto de capacidad.

## 61. Decisiones abiertas que no deben ocultarse

| Decisión | Estado |
|---|---|
| Qué partes concretas de Auton Web ya funcionan | **[POR VERIFICAR]** auditoría del repositorio |
| Qué commit de ZCode se usará | **[POR DECIDIR]** |
| Si Auton Core vivirá dentro del runtime forked o como servicio separado | **[POR DECIDIR]** |
| Modelo Muse principal para orquestación | **[POR DECIDIR]** según pruebas y disponibilidad |
| Modelo/coder de implementación inicial | **[POR DECIDIR]** |
| Alcance exacto del vertical slice de Lunar | **[POR DECIDIR]** según dependencias y entorno |
| Tests externos para evaluar el slice | **[POR CONSTRUIR]** |
| Estado de aceptación en el hackathon | **[POR CONFIRMAR]** |
| Restricciones oficiales sobre fork y código preexistente | **[POR VERIFICAR]** |
| Nivel real de recuperación tras crash | **[POR MEDIR]** |
| Ventaja real frente a ZCode base | **[POR DEMOSTRAR]** |

## 62. La prueba que puede cambiarlo todo

Imagina un ensayo donde:

1. Un usuario describe una parte real de Lunar Móvil.
2. ZCode en configuración base intenta implementarla.
3. Auton intenta la misma tarea, con el mismo ejecutor y límites comparables.
4. Ambos resultados son evaluados fuera de los agentes.
5. Auton termina más correctamente, o requiere menos intervención, o consume menos por tarea válida.
6. La diferencia se repite en tareas adicionales.

En ese escenario, Auton no habría demostrado que inventó la ingeniería autónoma. Habría demostrado algo más útil: **que su disciplina incorporada al sistema modifica favorablemente el rendimiento real de la ingeniería asistida por IA**.

Si no ocurre, la respuesta no es esconder el resultado. Se identifica qué componente no aporta valor, se reevalúa la arquitectura y se conserva lo que sí ayuda.

---

# EPÍLOGO — UN OFICIO, NO OTRO CHAT

Auton nació de una frustración muy concreta: los modelos de programación pueden escribir muchísimo código, pero a menudo el usuario sigue teniendo que planear, corregir, verificar, repetir instrucciones, decidir cuándo continuar y sostener la memoria de un proyecto.

La visión original proponía mecanizar esa disciplina mediante un orquestador, un programmer, un tester, sprints, briefs, evidencia y auto-wake.

La visión 2.0 lleva la tesis un paso más lejos:

**El usuario no debería necesitar convertirse en experto en dirigir agentes de IA para construir software complejo con ayuda de la IA.**

Auton quiere ser ese intermediario técnico: el ingeniero que entiende la visión, estudia el problema, organiza el trabajo, utiliza los motores disponibles, cuestiona resultados y vuelve con algo demostrable.

Lunar Móvil representa el primer escenario real donde esa promesa puede ser puesta a prueba. Auton Desktop, construido sobre una base existente como ZCode, es una oportunidad de transformar rápidamente la tesis en un producto observable. El hackathon de Meta ofrece un marco para demostrar dos dimensiones a la vez: una necesidad personal auténtica y una posible mejora del estado práctico de la autonomía de programación.

Pero hay que sostener dos ideas simultáneamente:

> **La ambición es alta: delegar la dirección técnica para que un creador pueda concentrarse en el producto.**
>
> **La exigencia de evidencia también: sin resultados medibles, la ambición sigue siendo una hipótesis.**

**Auton no será valioso porque haya más agentes. Será valioso si el humano tiene que ser menos agente, menos supervisor y menos harness, mientras el software terminado es mejor o más confiable.**

> **Tú defines el destino. Auton asume la dirección de ingeniería. Los coders ejecutan. La evidencia decide cuándo avanzar.**

Y la frase que nunca debe perderse:

> **Tú apruebas la dirección. El sistema ejecuta el oficio.**

---

# APÉNDICE A — FUENTES Y TRAZABILIDAD

## A.1. Fuente primaria del proyecto

- `AUTON-VISION.md` (documento original proporcionado por el creador). Se conservan su tesis central, caso Lunar Móvil, tres oficios, loop, briefs, evidencia, memoria y prioridad del ciclo 1×.
- Conversación con el creador del 27 de octubre de 2026: Auton como app web existente, intención de crear desktop mediante fork de ZCode y redefinición del orquestador como sustituto funcional de la dirección cotidiana ejercida por el usuario frente a coders.

## A.2. Referencias externas verificadas

- Meta Global AI Developer Hackathon: https://dev.meta.ai/events/global-hackathon — temas **Build for Your World** y **Push the Frontier**, modelos y cronograma.
- Cerebral Valley, evento: https://events.cerebralvalley.ai/e/meta-ai-developer-hackathon — organización y descripción.
- ZCode repository: https://github.com/zai-org/ZCode — código fuente y licencia declarada.
- ZCode README en inglés: https://github.com/zai-org/ZCode/blob/main/README.en.md — organización de paquetes y comandos de desarrollo.

La información externa fue consultada para esta versión el **27 de octubre de 2026** y puede cambiar.

## A.3. Lo que estos documentos NO prueban

- Que el estado actual de Auton Web coincida con toda la arquitectura presentada.
- Que el fork desktop ya compile.
- Que un modelo pequeño pueda superar sistemáticamente a uno mayor.
- Que el sistema sea científico o comercialmente novedoso en términos absolutos.
- Que Auton ya haya mejorado benchmarks.
- Que completar Lunar Móvil entero sea viable antes del fin del hackathon.
- Que el uso de una base open-source esté automáticamente permitido por cada condición particular del concurso.

---

# APÉNDICE B — PITCH CORTO

## Versión en español

**Auton es el ingeniero de IA entre tu idea y tus agentes de programación.**

Hoy los agentes pueden escribir código, pero en muchos proyectos sigues siendo tú quien planifica, vigila, detecta omisiones y les dice qué hacer después. Auton busca asumir esa dirección: entiende tu objetivo, organiza sprints verificables, coordina los motores de programación, comprueba el resultado y continúa o corrige hasta lograr avances demostrables.

Lo estamos poniendo a prueba con un problema real: convertir Lunar, una aplicación web compleja, en una aplicación Android nativa sin tener que supervisar manualmente cien tareas de desarrollo.

Nuestra investigación es si una arquitectura de dirección y verificación puede hacer que los modelos existentes trabajen con más autonomía, calidad y eficiencia. Esa mejora será evaluada frente a los mismos agentes sin Auton.

## English version

**Auton is the AI engineer between your vision and your coding agents.**

Today, coding agents can write code, yet builders often remain responsible for planning, reviewing, fixing omissions, and telling agents what to do next. Auton aims to take on that engineering-management work: translate product goals into verifiable sprints, direct interchangeable coding agents, independently test their output, and continue or correct the work based on evidence.

We are testing it against a real problem: moving Lunar, a complex web application, to native Android without manually supervising one hundred development tasks.

Our technical hypothesis is that a durable orchestration and verification architecture can improve the effective autonomy, quality, and cost efficiency of existing coding models. We intend to measure that claim against comparable baselines rather than assume it.

---

**Fin de AUTON — VISIÓN 2.0.**
