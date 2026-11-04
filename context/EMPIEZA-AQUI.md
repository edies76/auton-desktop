# EMPIEZA AQUÍ

> **Este es el único documento que hay que leer para ponerse a trabajar en Auton.**
> Si algo aquí contradice a los demás, manda este. Última puesta al día: 2 de noviembre de 2026.

## Qué es Auton, en tres líneas

Un **jefe de obra con IA**: el humano habla con **un solo cerebro** (el orquestador), y los
programadores y revisores trabajan por debajo **bajo su dirección**. El humano deja de dirigir la
ejecución técnica y se queda con las **decisiones de producto**. El centro: *en otras herramientas el
límite es el usuario; en Auton esa disciplina es el producto*.

## Los documentos, y para qué sirve cada uno

| Documento | Para qué |
|---|---|
| **`context/ARQUITECTURA-ORQUESTADOR.md`** | **La spec de trabajo.** Cómo funciona el orquestador: bucle vivo, canales anidados, tres relojes, contexto por etapas, motor por sprint, sprints vs encargos, orden de construcción |
| **`context/DECISIONES.md`** | Las decisiones de fondo ya tomadas, con el porqué y qué las cambiaría. **No se vuelven a discutir sin leer esto** |
| **`ARTICULO-AUTON.md`** | El esqueleto del artículo técnico: la tesis de lo nuevo, sección por sección |
| **`context/POR-QUE-AUTON-GANA.md`** | El análisis del artículo de DeepSeek, el argumento para la hackathon y el pitch por rúbrica |
| **`AGENTS.md`** | Las reglas duras del repositorio (sin credenciales, un commit por cambio, verificar antes de prometer) |
| **`context/PRUEBAS-QUE-PROMETEMOS.md`** | Las 16 pruebas: una por promesa, para no engañarnos y para el día de la demo |
| **`context/UI-ESPACIO-DEL-PROYECTO.md`** | La spec del primer gran cambio de UI: dos pantallas, el panel rehecho como lista de workers, y los bloques anidados |
| **`context/UI-CHAT-INTERCALADO.md`** | La spec de layout: el hilo como crónica intercalada, sin bloque por turno |
| **`context/UI-ESTILO-GROK-BOT.md`** | El estilo cálido y en bloques, **para después** (no se implementa ahora) |
| Trabajo futuro de Edi (UI de workers y el orquestador que planea) | `context/REPARTO-DE-TRABAJO.md`, sección "Features no incluidas inicialmente" |
| **`AUTON-VISION.md`** | La Visión 2.0. Documento central de producto. Es largo: se consulta, no se lee de corrido |

## Qué NO hay que leer (podado)

- **`context/PLAN-MODO-AUTON.md`** → superado por `ARQUITECTURA-ORQUESTADOR.md`. Solo sirve como historia de
  cómo se llegó al plan de las cinco superficies.
- **`context/AGENT-BRIEFING.md`** → su contenido está absorbido en este documento y en la spec. No usar.
- **`docs/VISION-1.0.md`** → archivado. La visión vigente es la 2.0.
- **`context/ARTICULO-AUTON.md`** está **vigente** pese a parecer un plan: es el esqueleto del artículo y
  lleva el contenido, no solo el índice.
- Todo lo de `docs/` de ZCode que no esté listado arriba: **es del upstream**, se ignora salvo que se
  toque el motor.

## Lo que NO se toca

1. **La interfaz de ZCode.** Se reutiliza tal cual. Sí se pueden añadir superficies nuevas **con sus
   mismos componentes y tokens**.
2. **El motor de edición de ZCode.** Funciona y está intacto (CAS por revisión, matchers tolerantes,
   parches con rollback, escritura atómica, checkpoints).
3. **Nada de una UI propia del orquestador** sin la división de proyectos/tareas. Es cambio de rumbo y va
   después.

## Estado real hoy (lo que ya está hecho)

**Del orquestador (lo nuevo, por prioridad):**

1. **Esfuerzo como parámetro: HECHO.** El agente gana `effort` (`minimal` / `standard` / `thorough`), y el
   prompt del worker **se construye desde ese campo**. La línea del brief quedó solo por compatibilidad.
   → *Esto era el punto 1 del orden de construcción: ya está.*
2. **Doctrina del reparto: HECHA.** El orquestador ya no pide la política en el brief; el reparto es
   obligatorio antes de programar; y "no terminas el trabajo del programador".
3. **Reversión total y parcial: HECHA.** `AutonRevert` por agente, por elemento o por rutas; los archivos
   vuelven **byte a byte**:
   - orden inverso al aplicado, conflicto en vez de pisar, borra los archivos creados desde cero,
     idempotente, y deja rastro en `.auton/reverts.jsonl`;
   - **git: nunca reset ni checkout**, y está probado que un cambio ajeno sin commitear sobrevive;
   - diario con **bytes crudos en base64**: CRLF, finales mixtos y archivos no UTF-8 vuelven idénticos;
   - tests: **56 del núcleo + 4 del adaptador real** en verde, y la suite completa con los mismos 68
     fallos de entorno que la base (misma lista de archivos).
4. **Bundle reconstruido**: `--help` dos veces, exit 0 y salida idéntica.

**Del producto:** aislamiento de datos en su carpeta propia, el plugin que importaba sesiones de ZCode
eliminado, y el modo Auton dentro del agente (identidad + procedimiento).

## Lo que sigue, en orden (actualizado 2026-11-04)

Ya están hechos: esfuerzo, doctrina del reparto, reversión, límites base, canal rápido, registro durable, bucle vivo, worker como sesión completa, Muse por MSP, una sola sesión por proyecto y la bandeja de decisiones pendientes en el hilo.

1. **Bandeja de decisiones con opciones cerradas**: hoy muestra la pregunta y prepara la respuesta; falta que la respuesta actualice el item sin pasar por el orquestador.
2. **Aprobación del plan con estado `proposed`**: la aprobación sigue siendo conversacional; falta el estado y el gate de despacho.
3. **Límites completos**: tiempo, costo, concurrencia, red y sistema de archivos, más el vigilante que detecta cuándo un item debió escalar.
4. **Tres relojes**: por worker, por sprint y total, con los solapamientos contados una sola vez.
5. **Crónica visual restante**: mapeo propio de `systemEvent`/evidencia/plan, picker de proyectos vacíos y estilo Grok Bot.
6. **Prueba de elección real de herramientas**: que un modelo real decida usar `AutonPlan`, `AutonReport`, `AutonRevert` o `Agent`, no solo que las tools existan.
7. **Sincronizar la documentación de estado**: este archivo y `docs/private/deuda-y-riesgos.md` son la fuente; `PLAN-MODO-AUTON.md` queda como historia.

## Lo que hay que traer del prototipo (`auton cat jam zcode`)

Tabla completa en `context/ARQUITECTURA-ORQUESTADOR.md`, sección 13. Lo esencial: el prompt del orquestador
probado, el reporte con estado que manda sobre el resultado del proceso, la revisión sobre el mismo
directorio, el despertar automático y el latido de flota, el guardia que impide que el orquestador
escriba producto, los topes de tamaño de plan, la robustez (un error no mata al worker; no hay "fallidos",
hay "bloqueado con motivo") y el control de gasto.

**Pendiente de Edi**: commitear ese prototipo. Sin eso, sus capacidades **no son citables** y quedan
marcadas como no verificadas en el artículo.

## Las cosas nuevas que hay que defender (el diferencial)

Esto es lo que hace que Auton no sea "un agente más", y hay que decirlo en el pitch y sostenerlo en el
código:

1. **El orquestador es un ingeniero, no un despachador.** Contrato, descomposición con criterio de hecho,
   decisión de frentes, revisión en dos etapas, replanificación. El Router de DeepSeek es explícitamente
   lo contrario (no ejecuta, "un modelo ligero basta") y ellos dejan abierto el problema difícil.
2. **Cierre con evidencia, no con declaración.** Un "listo" del modelo no cierra nada.
3. **Autonomía gobernada**: los límites se escriben **en el contrato, antes de despachar**, se versionan, y
   **el caso "no sé decidir → pregunto"** es de primera clase. El fallo silencioso no es que se incumpla un
   umbral: es que nadie mira.
4. **Verificación proporcional al riesgo**: verificar sí, autocertificarse no.
5. **El motor es un enchufe**: Auton dirige motores que ya existen (el de casa, Muse Code, el que venga) y
   lo garantiza con **el contrato** — mismo encargo, mismo reporte, misma evidencia —, no con una promesa
   de paridad de herramientas.
6. **Sensación multiagente de verdad**: una sola conversación con canales anidados, en vez de pestañas y
   sesiones separadas. Es lo que ningún harness tiene.
7. **Métrica que no se puede maquillar**: intervenciones humanas por entrega verificada, **sobre todos los
   intentos** (incluidos fallidos), con la calidad como puerta de entrada.

**Y el argumento que hay que saber contar**: existen repos que prometen convertir tu agente en un director
de ingeniería. **No pueden**: son packs de prompts dentro de un harness hecho para **una sesión**, y le
piden al modelo disciplina donde no hay sitio para guardarla — ni estado, ni canal, ni forma de comprobar
lo entregado. Auton aporta justo eso que les falta: **canales, contrato y evidencia, y un registro que no
pierde la historia.** De esos repos se aprovechan las ideas de procedimiento, no el envoltorio.

## Cómo se presenta

- **La demo no es Lunar Móvil.** Una tarea pequeña, en un repositorio propio, commiteado y **repetible
  delante del jurado**. Lunar queda como segundo caso.
- **La escena**: pedir un arreglo de interfaz mientras otro worker trabaja en otra cosa, **todo en el
  mismo chat**, con el bloque de trabajo anidado y sus relojes.
- **Nada se presenta sin referencia citable**: cada capacidad afirmada, con ruta y commit.
