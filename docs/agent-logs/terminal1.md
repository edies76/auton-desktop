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

## 2026-11-02 — contrato de notificaciones

Qué: D5 y `docs/CONTRATO-DE-NOTIFICACIONES.md`: el orquestador no cierra el turno, publica cuatro
tipos de salida y abre canales de ejecución dentro del hilo.
Por qué: al delegar se pierde la presencia de ingeniero; el feedback constante es lo que la devuelve.
Verificado con: revisión del documento contra `ARQUITECTURA-ORQUESTADOR.md`.
