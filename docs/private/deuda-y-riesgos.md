# Deuda y riesgos abiertos

> Documento privado. Se actualiza cuando una pieza cambia de estado.

## Estado de la pieza de límites

| Requisito de `REPARTO-DE-TRABAJO.md` | Estado | Evidencia |
| --- | --- | --- |
| El contrato guarda versión, quién y cuándo cambió | Hecho | `AutonLimitsSchema`, `limitHistory`, `auton-plan-tool.test.ts` |
| Existe "no se puede evaluar" y escala | Hecho | estado `not_evaluable`, `evaluateDispatch`, gate 42201/42206 |
| El worker reporta, nunca modifica | Hecho | guard de sesión + `limitReports`, `auton-limits-guard.test.ts` |

## Deuda conocida

1. **Cobertura de límites incompleta.** Solo `maxAttempts` y las cinco banderas de aprobación. Faltan tiempo, costo, concurrencia, red y sistema de archivos (Visión §48).
2. **Aprobaciones declarativas por item.** El orquestador debe escribir `needsApproval`; no se infiere del comando ni de la ruta.
3. **`unknownHandling` se aplica al escribir.** No hay vigilante que detecte por tiempo o telemetría que un item debería haber escalado.
4. **Reportes sin canal propio.** El worker los cuenta en su REPORTE y el orquestador los transcribe; si se olvida, se pierden.
5. **`limitReports` sin tope.** Puede crecer sin límite dentro del plan.
6. **Sin UI dedicada de decisiones.** `not_evaluable` se ve en la tarjeta del plan; la bandeja de decisiones sigue pendiente.
7. **Pruebas de integración ausentes.** No se ejecutó el bucle vivo con un despacho real bajo límites.
8. **`formatAutonPlanForModel` sin consumidor.** Se mantiene como formato canónico, pero hoy nadie lo llama.

## Riesgos

| Riesgo | Impacto | Mitigación actual |
| --- | --- | --- |
| Un plan legado no puede despachar hasta que se le escriban límites | Bloqueo visible, no silencioso | Mensaje 42201 explica qué hacer |
| El orquestador puede escribir límites sin aprobación humana real | Gobierno débil en el primer contrato | `approvedBy` queda registrado; falta validar contra una aprobación de UI |
| El guard depende del `sessionId` | Un escritor externo lo evade | El plan no es un límite de seguridad del sistema operativo |
| La doctrina del prompt puede quedar desactualizada | El modelo no usa `not_evaluable` | El handler rechaza el despacho sin límites; el texto vive junto al contrato |

## Próximos pasos sugeridos

1. Conectar `not_evaluable` con la bandeja de decisiones del humano.
2. Añadir límites de tiempo y costo por item.
3. Herramienta de reporte para workers, para no depender de la transcripción.
4. Prueba de integración con un despacho real y su reintento.
5. Límite de tamaño o rotación para `limitReports`.
