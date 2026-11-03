# Verificación y pruebas de la pieza de límites

> Documento privado. Comandos ejecutados en `apps/zcode-cli`.

## Cómo correr las pruebas

```bash
cd apps/zcode-cli
npx vitest run \
  packages/core/tests/auton-limits-governance.test.ts \
  packages/core/tests/auton-plan-tool.test.ts \
  packages/core/tests/auton-limits-guard.test.ts \
  packages/core/tests/auton-answer-lock.test.ts \
  packages/core/tests/auton-worker-policy.test.ts \
  packages/core/tests/auton-loop.test.ts
```

Resultado de la última corrida (2026-11-03): **51 pruebas en 5 archivos, todas en verde**.

Typecheck:

```bash
pnpm --filter @zcode/contracts typecheck
pnpm --filter @zcode/core typecheck
```

## Qué cubre cada archivo

| Archivo | Pruebas | Qué demuestra |
| --- | --- | --- |
| `auton-plan-tool.test.ts` | 10 | Lectura/escritura del plan, límites versionados, historial conservado, plan legado, JSON inválido, despacho sin versión |
| `auton-limits-guard.test.ts` | 3 | El orquestador escribe límites; el worker no puede cambiarlos; el worker sí puede actualizar items |
| `auton-limits-governance.test.ts` | 15 | Evaluación pura y gobierno del despacho |
| `auton-answer-lock.test.ts` | 6 | Candado del orquestador: marcar, no marcar, levantar, y encabezado de decisión requerida en la entrega |
| `auton-worker-policy.test.ts` | 14 | Identidad del programador, política de esfuerzo y thinking distinto del esfuerzo |
| `auton-loop.test.ts` | 6 | Prioridades del bucle y latido |

## Casos de la suite de gobierno

Evaluación pura:

1. Sin límites el veredicto es `not_evaluable`.
2. Dentro del tope sigue; al alcanzarlo, `exceeds`.
3. La aprobación pendiente gana sobre el intento.
4. Un cambio sin historial no se acepta; con versión e historial sí.
5. El historial ya escrito no se reescribe.

Handler:

6. Sin límites versionados el orquestador despacha, el plan queda sin versión y cuenta el intento (sin 42201).
7. La aprobación que escribió el orquestador se respeta aunque no haya límites (42203).
8. Los intentos los cuenta el plan y frenan al agotarse (42202).
9. Una aprobación pendiente no arranca ni consume intento (42203).
10. `not_evaluable` exige pregunta (42206) y se cuenta en el resumen.
11. `safe_default` exige la decisión escrita en `detail`.
12. Cambiar límites exige versión nueva y entrada de historial (42204).
13. Omitir `limits` conserva los vigentes.
14. Un worker no puede añadir `limitReports`; el orquestador sí.
15. El historial y los reportes sobreviven a un write que los omite.

## Prueba manual mínima

1. Crea un proyecto vacío y escribe un plan con límites `maxAttempts: 1`.
2. Pon un item en `running`: queda con `attempts: 1`.
3. Pásalo a `blocked` y vuelve a `running`: el write responde 42202.
4. Cambia `maxAttempts` a 3 sin subir versión: responde 42204.
5. Sube a versión 2 y añade la entrada de historial: acepta.
6. Abre la tarjeta del plan: muestra `Limits v2`, `1/3 attempts` y el historial.

## Lo que no se probó

- Integración con el bucle vivo y la flota real (los despachos reales a `Agent`).
- Persistencia tras reinicio con límites ya escritos.
- La UI más allá de las pruebas de render existentes; falta un caso con `not_evaluable` y otro con reportes.

## Honestidad de la evidencia

Las pruebas cubren el handler del plan y la evaluación pura. El comportamiento del orquestador real depende además de la doctrina del prompt, que se verifica por lectura del texto y no por ejecución de un modelo.
