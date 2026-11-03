# Verificación y pruebas de la pieza de límites

> Documento privado. Comandos ejecutados en `apps/zcode-cli`.

## Cómo correr las pruebas

```bash
cd apps/zcode-cli
npx vitest run \
  packages/core/tests/auton-limits-governance.test.ts \
  packages/core/tests/auton-plan-tool.test.ts \
  packages/core/tests/auton-limits-guard.test.ts
```

Resultado de la última corrida (2026-11-02): **23 pruebas en 3 archivos, todas en verde**.

Typecheck:

```bash
pnpm --filter @zcode/contracts typecheck
pnpm --filter @zcode/core typecheck
```

## Qué cubre cada archivo

| Archivo | Pruebas | Qué demuestra |
| --- | --- | --- |
| `auton-plan-tool.test.ts` | 6 | Lectura/escritura del plan, límites versionados, historial conservado, plan legado, JSON inválido |
| `auton-limits-guard.test.ts` | 3 | El orquestador escribe límites; el worker no puede cambiarlos; el worker sí puede actualizar items |
| `auton-limits-governance.test.ts` | 14 | Evaluación pura y gobierno del despacho |

## Casos de la suite de gobierno

Evaluación pura:

1. Sin límites el veredicto es `not_evaluable`.
2. Dentro del tope sigue; al alcanzarlo, `exceeds`.
3. La aprobación pendiente gana sobre el intento.
4. Un cambio sin historial no se acepta; con versión e historial sí.
5. El historial ya escrito no se reescribe.

Handler:

6. Sin límites versionados, un item no puede arrancar (42201).
7. Los intentos los cuenta el plan y frenan al agotarse (42202).
8. Una aprobación pendiente no arranca ni consume intento (42203).
9. `not_evaluable` exige pregunta (42206) y se cuenta en el resumen.
10. `safe_default` exige la decisión escrita en `detail`.
11. Cambiar límites exige versión nueva y entrada de historial (42204).
12. Omitir `limits` conserva los vigentes.
13. Un worker no puede añadir `limitReports`; el orquestador sí.
14. El historial y los reportes sobreviven a un write que los omite.

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
