# Contrato del plan (`.auton/plan.json`)

> Documento privado. Fuente: `apps/zcode-cli/packages/contracts/src/auton/plan.ts`.

## Archivo

- Ruta: `<workspaceRoot>/.auton/plan.json`.
- Escritor: el orquestador, mediante la herramienta `AutonPlan`.
- Lectores: la tarjeta de UI, la doctrina del prompt y cualquier consumidor futuro del estado.
- `workspaceRoot` manda sobre `workingDirectory` cuando existe.

## Raíz

```ts
{
  version: 1,                 // versión del FORMATO del archivo
  goal?: { title, statement?, constraints?, done? },
  limits?: AutonLimits,       // versión del CONTRATO de autonomía
  limitHistory: AutonLimitChange[],
  limitReports: AutonLimitReport[],
  items: AutonPlanItem[],
  updatedAt?: string,
}
```

No confundir `version` (formato) con `limits.version` (contrato). Son contadores independientes.

## Item

```ts
{
  id: string,
  title: string,
  detail?: string,
  status: "ready" | "running" | "waiting" | "blocked" | "done" | "dropped" | "not_evaluable",
  effort?: "minimal" | "standard" | "thorough",
  owner?: "orchestrator" | "programmer",
  strength?: "explicit" | "inferred",
  files?: string[],
  evidence?: { kind: "command"|"test"|"file"|"url"|"note", label, ref? }[],
  questions?: string[],
  attempts: number,                    // default 0, contado por el handler
  needsApproval?: AutonApprovalRule[], // deleteMove | outsideProject | pushMergeRebase | installDependencies | outsideScope
}
```

`AutonPlanItemSchema` es `.strict()`: un campo desconocido invalida el plan entero y se cae a plan vacío al leer. Cuidado al añadir campos nuevos: primero el esquema, después el escritor.

## Migración

`normalizeLegacyPlan` rellena:

- `version` si falta;
- `limitHistory` y `limitReports` a `[]`;
- `items` a `[]`.

Un plan sin `limits` se lee y se muestra como "sin versión". No se le inventan límites retroactivamente.

## Resumen

`summarizeAutonPlan` devuelve conteos por estado, incluido `notEvaluable`. La UI cae a contar por item si el resumen no viene.

## Formato para el modelo

`formatAutonPlanForModel` imprime:

- versión de límites, `maxAttempts`, `unknownHandling` y banderas de aprobación;
- historial de cambios;
- items con `attempts/maxAttempts`, `needsApproval` y preguntas abiertas;
- reportes de calibración de los workers.

Hoy esta función no se llama desde ningún punto del runtime; el modelo lee el plan con `action: "read"`. Se conserva como formato canónico para el consumidor que lo necesite.

## Escritura

La escritura reemplaza el archivo completo. Reglas de conservación:

| Campo | Si el write lo omite |
| --- | --- |
| `limits` | Se conservan los vigentes |
| `limitHistory` | Se conserva |
| `limitReports` | Se conservan |
| `items` | Obligatorio (el esquema lo exige) |

Omitir `limits` conserva los vigentes. Un plan que nunca tuvo límites se escribe y se lee como "sin versión": el despacho se permite, el plan cuenta los intentos y respeta el `needsApproval` que el orquestador escribió en el item. El gobierno se gana con el primer cambio versionado, no con un candado de arranque.
