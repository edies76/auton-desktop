# terminal5 — Grok (grok-build)

Tema en curso: chat vivo, orquestador que planea y orquestador con equipo y tono.
Inicio: 2026-11-02.

## 2026-11-03 — chat vivo: eventos despertadores en el hilo normal

Qué: los tres eventos que despiertan al orquestador (pregunta, latido y cierre) salen del mapeo real
de filas y se pintan centrados dentro de `ConversationTurnGroup`; la pregunta lleva Responder al
compositor y el cierre Abrir. Se retiró el camino paralelo `QuestionWakeBlock`.
Por qué: la evaluación rechazó filas construidas a mano y un latido que solo existía como
notificación `model-only`; el hilo debía ser el único camino.
Verificado con: `autonThreadChannels.test.tsx` (5), `autonQuestionRespond.test.tsx` (2),
`auton-thread-question-projection.test.ts` (3) y `v4ConversationTurnGroup.test.ts` (+1); 115
archivos y 1472 pruebas en el gate limpio. Evidencia en `thread-ui.log` y `affected-clean-b60d.log`.

## 2026-11-03 — versión 0.5.0 y documentación del chat vivo

Qué: corte `0.5.0` con el chat vivo en el changelog; la página pública del núcleo explica que todo
ocurre en la misma conversación, con la fila de pregunta y su acción.
Por qué: el bloque cambió comportamiento y la documentación pública debía prometer lo verificado.
Verificado con: `node site/build.mjs`, publicación en el bucket y comprobación 200 de la página.

## 2026-11-03 — el orquestador que sabe planear y conversar

Qué: prompt con los cinco pasos (intención, alternativas, producto, plan y mantenimiento), proporción
obligatoria con su justificación y comportamiento de compañero; registro del proyecto con escaneo
determinista al crear y análisis de solo lectura guardado en `.auton/project-analysis.md`.
Por qué: la sección B del reparto y la D7 lo exigen, y una sección que no se ensambla no llega al
modelo.
Verificado con: `autonProjectFacts.test.ts` (5), `autonProjectFactsOnCreate.test.ts` (2),
`auton-orchestrator-planning.test.ts` (6) y `auton-four-pieces.test.ts` (5); core 21 archivos y 110
pruebas. Corrida real en `model-runs.md`: antes exploraba y abría tareas; después pregunta con
recomendación, avisa y presenta el plan. Prueba 20 parcial.

## 2026-11-03 — equipo, autonomía validada y tono

Qué: la doctrina declara que es el ingeniero de un equipo real, que el humano valida la dirección y
él decide dentro de lo aprobado, que lo irreversible se pregunta, y fija un tono de ingeniero senior
que narra cada delegación.
Por qué: tenía narración y trato de compañero, pero no sabía de quién era cada decisión ni cómo
hablar; el plan podía presentarse como aprobado sin serlo.
Verificado con: `auton-doctrine-team.test.ts` (4), core 21 archivos y 110 pruebas, `model-doctrine.md`
(antes dudaba y no nombraba la aprobación; después "arranco a leer, no a despachar… plan como
propuesta"). Versión 0.7.0 publicada y documentada.

## 2026-11-03 — estilo del hilo y proactividad

Qué: las filas despertadoras pierden ámbar/verde y usan el lenguaje visual de ZCode; la etiqueta
`auton-worker` deja el azul de la paleta y pasa a texto secundario. El prompt gana proactividad: al
abrir un proyecto saluda, anuncia el worker de lectura, invita a contar la necesidad y ofrece caminos.
Por qué: el color propio rompía el estilo de ZCode y el orquestador no debía esperar a que le pidan.
Verificado con: UI 24 pruebas (wake, hilo y bloque de agente) y `auton-orchestrator-planning.test.ts`
(7). Deuda anotada: el layout sigue separando bloque de trabajo y respuesta; intercalarlos es el
siguiente cambio de UI.

## 2026-11-03 — el aviso del worker y la propuesta de chat intercalado

Qué: el worker ya no aparece preguntando al humano. Su mensaje se marca en la proyección
(`lastWorkerMessageAt`), se pinta como una fila de trabajo sin botón de responder y se limpia cuando
el orquestador contesta; la pregunta al humano sigue en la tool nativa. Las filas pierden la píldora
centrada y el color; la etiqueta `auton-worker` deja el azul. Terminología "worker" en UI y prompt.
Por qué: el worker habla con el orquestador, no con el humano, y el estilo propio rompía ZCode.
Verificado con: proyección 4, UI 29, core 20 archivos/108 pruebas y `v4ConversationTurnGroup` 102.
Propuesta de layout en `context/UI-CHAT-INTERCALADO.md`, pendiente de aprobación.

## 2026-11-03 — la crónica se abre sola y el orden es temporal

Qué: los turnos con canales `auton-worker` abren la crónica por defecto; ZCode conserva su colapso.
La spec de layout queda con los siete tipos, el orden por `rowId` (no por prioridad), el scroll
condicionado y la prueba de orden; `UI-ESPACIO` 2.4-2.6 apuntan a ella.
Por qué: el trabajo del orquestador se escondía tras "Worked for" y la prioridad no debe pintar.
Verificado con: `v4ConversationTurnRenderUnits` 42, `autonThreadChannels` 6 (incluye el caso de
latido anterior y dos eventos con la misma marca). Pendiente: lista plana de siete tipos y bloque
por worker; el estilo Grok se deja para después.

## 2026-11-03 — la narración se intercala con el trabajo

Qué: en turnos con canales `auton-worker`, todos los `assistantText` se pintan en su posición entre
tools y canales; el texto final ya no se dibuja aparte. El turno Auton abre la crónica; ZCode no
cambia. La spec de layout queda con siete tipos, orden por `rowId`, scroll condicionado y prueba de
orden.
Por qué: el orquestador no debe sentirse como un agente que trabaja en silencio y responde al final.
Verificado con: `v4ConversationTurnGroup` 103 (incluye orden narración → canal → narración),
`v4ConversationTurnRenderUnits` 42, `autonThreadChannels` 6. Pendiente: bloque por worker, entradas
propias de systemEvent/evidence/plan y estilo Grok.

