# Límites versionados — implementación

> Documento privado. No publicar en el sitio público.
> Última verificación: 2026-11-02, rama `feat/edi/limites`.

## Qué existe

| Capa | Archivo | Responsabilidad |
| --- | --- | --- |
| Contrato | `apps/zcode-cli/packages/contracts/src/auton/plan.ts` | Esquemas Zod de límites, historial, reportes e items |
| Evaluación | `apps/zcode-cli/packages/contracts/src/auton/limits.ts` | Predicados puros: `evaluateAttempt`, `evaluateApproval`, `evaluateDispatch`, `validateLimitChange`, `validateNotEvaluableItems` |
| Aplicación | `apps/zcode-cli/packages/core/src/auton/plan-handler.ts` | Rechaza cambios sin registro, cuenta intentos, bloquea despachos, guarda reportes |
| Doctrina | `apps/zcode-cli/packages/core/src/context/sections/auton.ts` | Texto que el orquestador lee antes de despachar |
| UI | `packages/ui/src/auton/plan-card.tsx` | Versión, historial, intentos, aprobaciones, reportes y estado `not_evaluable` |

## Forma de `limits`

```ts
{
  version: number,          // entero positivo, sube con cada cambio
  maxAttempts: number,      // despachos por item antes de bloquear
  approval: {
    deleteMove: boolean,
    outsideProject: boolean,
    pushMergeRebase: boolean,
    installDependencies: boolean,
    outsideScope: boolean,
  },
  unknownHandling: "wait" | "ask" | "safe_default",
}
```

`limitHistory` es append-only:

```ts
{ at, field, from, to, reason, approvedBy: "human" | "orchestrator" }
```

`limitReports` registra lo que un worker reportó sobre un límite mal calibrado:

```ts
{ at, field, observed, expected?, by, note? }
```

## Veredictos de evaluación

`AutonLimitEvaluation` tiene cuatro formas y ninguna es "aprobado por defecto":

| kind | Cuándo | Qué debe hacer el llamador |
| --- | --- | --- |
| `within` | Hay límites y el item tiene intentos | Despachar |
| `requires_approval` | Una regla de `needsApproval` está activa | Dejar en `waiting` con pregunta |
| `exceeds` | `attempts >= maxAttempts` | Bloquear y escalar |
| `not_evaluable` | No hay límites o el dato no se puede leer | Escalar al humano |

`evaluateDispatch` evalúa primero la aprobación y después los intentos. Una aprobación pendiente no consume intento.

## Flujo de un write

```
AutonPlan write
  ├─ leer plan anterior
  ├─ conservar history/reports si el write los omite
  ├─ guard de worker: sessionId auton_* no puede tocar limits/history/reports
  ├─ validateLimitChange(previous, next, previousHistory, nextHistory)
  │    ├─ historial no se acorta ni se reescribe
  │    ├─ cambio exige versión mayor
  │    └─ cada campo cambiado exige una entrada nueva
  ├─ consumirIntentos(items, previousItems, limits)
  │    ├─ attempts nunca baja
  │    ├─ transición a running evalúa approval + maxAttempts
  │    └─ dentro del límite: attempts = previous + 1
  ├─ validateNotEvaluableItems(items, unknownHandling)
  │    ├─ wait/ask: exige questions
  │    └─ safe_default: exige detail con la decisión tomada
  └─ escribir .auton/plan.json
```

## Códigos de fallo

Son resultados de negocio (`{ result: false, errorCode, message }`), no excepciones:

| Código | Constante | Significado |
| --- | --- | --- |
| 42201 | `NotEvaluable` | Se intentó despachar sin límites versionados |
| 42202 | `Exceeds` | Se agotó `maxAttempts` |
| 42203 | `RequiresApproval` | El item exige una aprobación humana pendiente |
| 42204 | `UnrecordedChange` | Cambio de límites sin versión nueva o sin historial |
| 42205 | `AttemptsRegression` | Un item intentó bajar sus intentos |
| 42206 | `MuteNotEvaluable` | `not_evaluable` sin pregunta ni decisión escrita |

El guard de worker sigue lanzando `Error` (comportamiento previo, con test propio).

## Invariantes

1. Un plan sin `limits` no permite poner ningún item en `running`.
2. `attempts` solo sube, y lo cuenta el handler; el modelo puede omitirlo.
3. El historial de límites es append-only; no se acorta ni se reescribe.
4. Todo cambio de límites sube `version` y registra el campo cambiado.
5. `not_evaluable` exige pregunta (`wait`/`ask`) o decisión escrita (`safe_default`).
6. Un worker no escribe límites, historial ni reportes.
7. Los planes legados siguen leyéndose, marcados como sin versión.

## Decisiones y por qué

- **Fail-closed en el despacho**: si no hay contrato, no se arranca. La alternativa (arrancar y evaluar después) reproduce el fallo silencioso que la pieza quiere eliminar.
- **La primera versión no exige historial**: no hay un "antes" que registrar; la entrada inicial sería ruido.
- **Omitir `attempts` significa "lo lleva el plan"**: el modelo no tiene que recordar la cuenta, y un 0 explícito no puede usarse para reiniciar.
- **`safe_default` exige `detail`**: un default seguro sin constancia es indistinguible de no haber decidido.

## Lo que falta

- Límites de tiempo, costo, concurrencia y red (Visión §48): hoy solo `maxAttempts` y las banderas de aprobación.
- Las banderas de aprobación se aplican cuando el item declara `needsApproval`; no hay inferencia automática desde el comando o la ruta.
- Los reportes los escribe el orquestador a partir del REPORTE del worker; no hay herramienta dedicada para que el worker escriba en `limitReports`.
- El estado `not_evaluable` se valida al escribir; no hay un vigilante que lo detecte por tiempo o por telemetría.
