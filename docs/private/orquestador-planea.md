# El orquestador que sabe planear

Implementación de la sección B de `context/REPARTO-DE-TRABAJO.md` y de la D7:
el orquestador conversa, propone, planea en proporción y se entera del proyecto
sin explorarlo entero.

## 1. El prompt

`apps/zcode-cli/packages/core/src/auton/contextOrchestrator.ts` añade
`PLANNING_AND_CONVERSATION` antes del procedimiento de tools:

- **Los cinco pasos, en orden**: entender la intención (con la pregunta de
  producto y recomendación), proponer alternativas con ventajas y límites,
  conversar sobre producto sin cargarle las decisiones técnicas al humano,
  construir el plan (resultados, prioridades, dependencias, encargos y "hecho
  cuando" observable), y mantenerlo vivo sin empezar de cero.
- **La proporción**: un botón o un texto es un encargo sencillo; replantear el
  modo de estudio de Lunar merece conversación y plan profundo. Se justifica en
  una línea ("es un archivo, así que un encargo").
- **Compañero**: pregunta una vez con recomendación, dice qué no entra, admite lo
  que no sabe y avisa antes de investigar. La web solo si ayuda a decidir, con
  fuentes marcadas como externas.

`buildOrchestratorSection({ workingDirectory })` recibe el directorio y añade
`## Lo que ya sabes del proyecto`. `context/builder.ts` pasa
`this.config.workingDirectory`, así que la sección se ensambla en el prompt real;
la prueba de las cuatro piezas comprueba esa llamada.

## 2. El registro del proyecto (D7)

`packages/shared/src/auton/projectFacts.ts` (export
`@zcode/shared/auton-project-facts`):

- `scanProject(root)`: escaneo determinista y sin modelo. Stack por manifiestos y
  dependencias, número de archivos, bytes, archivos clave y carpetas de primer
  nivel; ignora `node_modules`, `dist`, `.git`, etc. Ordena todo para que dos
  escaneos del mismo árbol coincidan.
- `.auton/project.json`: el escaneo guardado. `ensureProjectFacts` lo lee; si no
  existe (proyecto anterior a esta capacidad), lo hace una vez y lo escribe.
- `.auton/project-analysis.md`: el resumen del worker de solo lectura, con sus
  rutas. El prompt lo inyecta tal cual y avisa de que ya está en el registro.
- `renderProjectFactsForPrompt(facts)`: el bloque que lee el modelo. Si falta el
  análisis, dice que hay que avisar, mandar un worker de solo lectura y guardar
  el resumen con `Write`; si está, dice que no se vuelva a pedir.

El escaneo se dispara **al crear el proyecto**: `project-repository.ts` llama a
`ensureProjectFacts` después de crear el proyecto y al inicializar su root. Un
fallo del registro no impide crear el proyecto, y un root inexistente no escribe
un registro falso.

El análisis profundo no es un tool nuevo: es el prompt más el archivo. El worker
de solo lectura reporta y el orquestador escribe el resumen en
`.auton/project-analysis.md`; la siguiente sesión lo lee del registro. En la
corrida real el modelo hizo exactamente ese `Write` en el turno del plan.

## 3. Pruebas

| Archivo | Qué ejerce |
| --- | --- |
| `packages/shared/test/autonProjectFacts.test.ts` (5) | Escaneo determinista, stack, archivos clave, escritura e idempotencia, prompt con y sin análisis, proyecto inexistente |
| `packages/services/test/autonProjectFactsOnCreate.test.ts` (2) | El escaneo se escribe al crear el proyecto; un root inexistente no rompe la creación |
| `packages/core/tests/auton-orchestrator-planning.test.ts` (6) | Cinco pasos en orden, proporción y justificación, compañero, escaneo en la sección, análisis guardado, prompt ensamblado por `ContextBuilder` |
| `packages/core/tests/auton-four-pieces.test.ts` (5) | La sección se ensambla con el working directory (registro) |

En `context/PRUEBAS-QUE-PROMETEMOS.md` quedan las pruebas **18 (proporción)**,
**19 (los cinco pasos en orden)** y **20 (el humano no rehace el plan)**, con su
cobertura estructural y la corrida manual.

## 4. Corrida con modelo real (2026-11-03)

Prompt de antes (HEAD `0.5.0`) contra prompt de después (esta rama), mismo modelo
`deepseek-v4.1-flash` vía OpenCode Go. Transcripción completa en
`model-runs.md` (scratch de la sesión).

- **Pequeño** ("cambia el texto del botón"): el de antes describe el cambio en
  3 tareas internas; el de después usa el escaneo ("node + react, 4 archivos") y
  justifica "es un cambio de una cadena, así que va en un solo encargo".
- **Lunar, turno 1**: el de antes se lanza a explorar con `Bash`; el de después
  avisa ("voy a revisar qué guarda Lunar y preparar un plan"), dice que falta el
  análisis, manda el worker de solo lectura y hace **una** pregunta de producto
  con la recomendación primero.
- **Lunar, turno 2**: el de después respeta la decisión ("punto exacto"), dice
  qué no entra y sigue con el worker; no abre una lista de tareas.
- **Plan en texto**: sale con objetivo, hallazgo que cambia el plan, dependencia
  crítica, cierre, "no entra", sprints con "hecho cuando" y encargos por worker.
- **Revisor (prueba 20)**: acepta el corte y pide precisiones (mover un test a
  la entrega donde nace, aclarar de dónde salen los 5 ítems, quitar un criterio
  que no es observable). Es un **parcial**: el corte se sostiene, los criterios
  de dos entregas necesitan una vuelta más.

## 5. Límites conocidos

- La escritura del análisis depende de que el modelo siga la línea del prompt.
  No hay enforcement en el runtime; si se quiere garantía, el siguiente paso es
  que el runner persista el resumen del worker marcado como lectura.
- El escaneo se ejecuta al crear el proyecto y, como respaldo, en la primera
  construcción de prompt de un proyecto antiguo. No se refresca solo cuando el
  proyecto cambia de forma grande; el prompt puede pedir un reescaneo.
- Las pruebas 18-20 son de comportamiento: la estructura está automatizada, la
  corrida con modelo se mide a mano y se anota con fecha.

## 6. El equipo, la autonomía y el tono

`contextAuton.ts` añade tres piezas a la doctrina:

- **El equipo y tú**: "Eres el ingeniero a cargo de un equipo real: un humano que
  responde por el producto y workers que ejecutan". No es un chatbot esperando
  instrucciones ni un asistente que pide permiso para lo obvio.
- **Autonomía con validación**: el humano valida la dirección (plan, alcance, lo
  que no entra y cambios de rumbo); dentro del plan aprobado el orquestador
  decide orden, briefs, reintentos y correcciones. Lo irreversible se pregunta
  siempre. Un plan nuevo es **propuesta** hasta el OK: no se presenta como
  aprobado lo que no lo está.
- **Tono**: ingeniero senior, directo, concreto, en primera persona, frases
  cortas, sin relleno ni "¡Claro! Estaré encantado". Humor seco cuando encaja.
  **Cada delegación se narra**: antes, qué manda a quién y por qué; después, qué
  volvió y qué decide. No hay worker invisible.

Prueba: `core/tests/auton-doctrine-team.test.ts` (4) comprueba identidad,
validación, tono y que la doctrina llega al prompt ensamblado.

Corrida real (`model-doctrine.md`, `deepseek-v4.1-flash`, 2026-11-03): ante
"prepara el plan… ¿arranco?", la versión con la doctrina nueva responde "Arranco
a leer, no a despachar… con eso te preparo el plan como propuesta"; la anterior
se limita a mirar el workspace sin nombrar la aprobación. Ante el cambio de un
botón, la nueva no pide permiso y narra la comprobación; la anterior duda entre
hacerlo o mandarlo.

Límite: la aprobación es conversacional. `AutonPlan` puede escribir el plan antes
del OK; el runtime no bloquea el despacho por falta de aprobación. Si se quiere
garantía, el siguiente paso es un estado `proposed` en el plan y que el despacho
lo exija.
