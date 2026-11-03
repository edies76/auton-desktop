# terminal1 — grok-build (Grok)

Tema en curso: orquestador continuo, reversión del trabajo de programadores y collaboration protocol.
Inicio: 2026-11-01.

## 2026-11-01 — esfuerzo como parámetro

Qué: `Agent` gana el campo `effort` y el prompt del worker se construye desde ahí; la línea del brief
queda como compatibilidad.
Por qué: el esfuerzo es configuración interna del orquestador, no texto que el modelo tenga que recordar.
Verificado con: `tests/auton-effort-param.test.ts` (5) y `tsc` de core.

## 2026-11-01 — AutonRevert con diario de cambios

Qué: `Write`/`Edit` registran bytes crudos antes y después en `.auton/changes.jsonl`; `AutonRevert`
restaura por agente, item o paths.
Por qué: el humano tiene que poder deshacer el trabajo de un programador sin tocar los cambios ajenos.
Verificado con: `auton-revert.test.ts` (6), `auton-revert-e2e.test.ts` (2) y
`adapters/tests/auton-revert-bytes.test.ts` (4, adaptador real: CRLF, mixtos y no-UTF-8).

## 2026-11-02 — límites: el programador no los toca

Qué: `AutonPlan` rechaza cualquier cambio de `limits` o `limitHistory` hecho desde una sesión
`auton_*`; el programador puede reportarlo en su REPORTE, el orquestador decide.
Por qué: era la única línea del criterio de hecho de los límites que quedaba sin enforcement real.
Verificado con: `tests/auton-limits-guard.test.ts` (3) + `auton-plan-tool.test.ts` (6), typecheck limpio.
Nota: el resto de los límites versionados ya estaba (plan.limits + limitHistory + unknownHandling);
descarté mi implementación paralela para no dejar dos sistemas de límites.

## 2026-11-02 — contrato de notificaciones

Qué: D5 y `docs/CONTRATO-DE-NOTIFICACIONES.md`: el orquestador no cierra el turno, publica cuatro
tipos de salida y abre canales de ejecución dentro del hilo.
Por qué: al delegar se pierde la presencia de ingeniero; el feedback constante es lo que la devuelve.
Verificado con: revisión del documento contra `ARQUITECTURA-ORQUESTADOR.md`.

## 2026-11-03 — REGLA DE LAS CUATRO PIEZAS aplicada al núcleo

Capacidades revisadas y su estado de las cuatro piezas:

1. **AutonPlan** — handler en \core/src/auton/plan-handler.ts\; registrada en
   \uiltInTools\; línea de prompt en \contextAuton.ts\ ("Antes de despachar,
   léelo con AutonPlan action:\"read\"", sección "El plan"); prueba en
   \core/tests/auton-plan-tool.test.ts\ y \uton-four-pieces.test.ts\.
2. **AutonRevert** — handler \core/src/auton/revert-handler.ts\; registrada en
   \uiltInTools\; línea de prompt en \contextAuton.ts\ ("## Deshacer", cuándo
   usarla y cómo: agentId, itemId, paths); pruebas \uton-revert.test.ts\,
   \uton-revert-e2e.test.ts\, \dapters/tests/auton-revert-bytes.test.ts\.
3. **Esfuerzo del worker** — parámetro \ffort\ de la tool Agent (contrato +
   registro); línea en \contextOrchestrator.ts\ ("el esfuerzo va en el campo
   effort de la tool"); prueba \uton-effort-param.test.ts\.
4. **Datos de contexto** — el prompt ahora nombra \.auton/plan.json\,
   \.auton/changes.jsonl\ y \.auton/reverts.jsonl\ (sección "Lo que queda
   escrito"), y \uilder.ts\ incluye \uildAutonSection()\ y
   \uildOrchestratorSection()\. Verificado por \uton-four-pieces.test.ts\.

Prueba de la regla: \uton-four-pieces.test.ts\ comprueba registro, línea de
prompt y ensamblado. La elección del modelo (que LLAME en vez de hacerlo a mano)
queda como prueba 17 de \context/PRUEBAS-QUE-PROMETEMOS.md\, que necesita modelo
real: no se ejecutó aquí.

Pruebas de la etapa 2 añadidas a \context/PRUEBAS-QUE-PROMETEMOS.md\: 2, 3, 4, 8,
14 y 17, con la tabla de cobertura automatizada.

Documentación: pública \docs/public/nucleo-en-vivo.md\; privada
\docs/private/nucleo-bucle-vivo.md\. Ambas registradas en \site/build.mjs\.
