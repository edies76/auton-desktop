# Protocolo de reporte y guard de workers

> Documento privado. Fuente: `apps/zcode-cli/packages/core/src/auton/journal.ts` y `plan-handler.ts`.

## Quién es worker

Un worker corre en una sesión cuyo id sigue el patrón `sess_auton_<agentId>` (el prefijo `sess_` lo añade `createSessionId`).

`isAutonWorkerSession(sessionId)` acepta `^sess_auton_` o `^auton_`. Se usa en el handler del plan; no depende de `runtimeScope`.

## Qué puede y qué no

| Acción sobre el plan | Orquestador | Worker |
| --- | --- | --- |
| Leer | Sí | Sí |
| Actualizar items (`status`, `evidence`, `questions`, `detail`) | Sí | Sí |
| Cambiar `limits` / `limitHistory` | Sí | No — lanza `Error` |
| Añadir `limitReports` | Sí | No — lanza `Error` |

El guard compara por JSON los límites y por longitud el historial y los reportes. Si un worker envía los mismos límites sin cambios, el write de items pasa.

Mensaje del rechazo:

> Un programador no puede cambiar los límites del plan. Puede reportarlo en el REPORTE y el orquestador decide.

## Canal rápido: hablar mientras se trabaja

El REPORTE final sigue siendo el cierre formal del encargo. Además existe el canal rápido:
`RespondToCoordinator` deja que el programador publique avances, dudas o bloqueos a mitad de corrida,
y `SendMessage` deja que el orquestador le responda o le cambie el rumbo sin esperar al cierre.

Cuando el orquestador marca su mensaje como decisión requerida, ese frente contesta antes de seguir;
el detalle completo está en [canal rápido](./canal-rapido.md).

## Cómo reporta un worker un límite mal calibrado

No escribe el plan. Lo cuenta en su REPORTE final; el orquestador lo recoge y lo registra:

```ts
limitReports: [{
  at: "2026-11-02T22:00:00.000Z",
  field: "maxAttempts",
  observed: "me quedé sin intentos en un item de red",
  expected: "5",
  by: "prog-01",
  note: "el fallo era del entorno, no del código",
}]
```

El reporte aparece en la tarjeta del plan y en `formatAutonPlanForModel`. No cambia ningún límite: el cambio exige versión nueva, historial y aprobación según corresponda.

## Por qué el guard vive en el handler

Es el único punto por el que se escribe `.auton/plan.json`. Ponerlo en el prompt habría sido una recomendación; aquí es una negativa del sistema, alineada con la doctrina del proyecto: la disciplina se impone en la arquitectura.

## Riesgos conocidos

- El guard confía en el `sessionId` que entrega el runtime. Un proceso externo que escriba el archivo directamente no pasa por él; el plan no es un mecanismo de seguridad contra el sistema operativo.
- `limitReports` no tiene tope de tamaño. Si crece demasiado, conviene truncar por antigüedad o moverlo a un archivo aparte.
- No hay herramienta dedicada de reporte: el worker depende de que el orquestador transcriba su REPORTE. Si el orquestador lo olvida, el reporte se pierde.
