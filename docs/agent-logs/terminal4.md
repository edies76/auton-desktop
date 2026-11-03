# terminal4 — grok-build (Grok)

Tema: límites que gobiernan el despacho y superficie del espacio del proyecto.
Inicio: 2026-11-03.

## 2026-11-03 — límites: intentos, no evaluable y reportes

Qué: AutonPlan cuenta los intentos, rechaza el despacho sin límites o sin intentos, admite el estado
`not_evaluable` con pregunta obligatoria y registra los reportes de calibración de los workers.
Las cuatro piezas: handler en `core/src/auton/plan-handler.ts`; registro en `builtInTools` con schema de
`attempts`/`needsApproval`/`limitReports` y status `not_evaluable`; línea en
`core/src/auton/contextAuton.ts` (cuándo usarlos) ensamblada por `context/builder.ts`; pruebas 8 y 9 de
`context/PRUEBAS-QUE-PROMETEMOS.md`.
Verificado con: `auton-four-pieces.test.ts` (5), `auton-limits-governance.test.ts` (15),
`auton-plan-tool.test.ts` (10) y `auton-limits-guard.test.ts` (3); 33 en verde.
Prueba de la regla: el test four-pieces comprueba registro, prompt ensamblado y catálogo. La elección
del modelo (prueba 17) necesita una sesión real y no se ejecutó aquí.

## 2026-11-03 — UI del espacio del proyecto (otro checkout)

Qué: pantalla de proyectos, espacio con un compositor, workers en vivo con parada y bloques
Trabajo/Plan/Evidencia en `C:\nueva-carpeta\auton-desktop`. No añade herramienta al orquestador: es
superficie humana; la parada y el envío usan el `answer` existente.
