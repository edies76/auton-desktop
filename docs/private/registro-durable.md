# Registro durable de Auton — Nivel 0 (lectura)

> Documento privado. Fuente: `apps/zcode-cli/packages/core/src/auton/registry.ts`.
> Esta es la primera capa del expediente de Auton: leer lo que ya existe, sin escribir nada.

## Qué resuelve

El orquestador ya deja tres fuentes en disco:

- `.auton/plan.json`: goal, items, límites, historial de límites y reportes.
- `.auton/changes.jsonl`: cada archivo que tocó un worker.
- `.auton/reverts.jsonl`: cada reversión y su resultado.

El Nivel 0 las convierte en **fichas con identificador y referencias** para poder
buscar sin leer el contenido completo. No reemplaza ninguna de las tres fuentes.

## Qué NO hace

- No escribe archivos.
- No crea hooks en el plan ni en la reversión.
- No registra eventos nuevos.
- No toca la UI, el motor de edición ni el shell de ZCode.
- No devuelve el contenido `before`/`after` de un cambio.

## Ficha

```ts
interface AutonRegistryRecord {
  id: string;          // goal | item:s1 | change:12 | revert:3 ...
  kind: "goal" | "sprint" | "decision" | "report" | "artifact" | "change" | "revert";
  at?: string;         // ISO cuando la fuente lo tiene
  title: string;
  summary: string;     // una línea, sin contenido de archivos
  refs: string[];      // ids de otras fichas, rutas o URLs
  source: string;      // plan.json | changes.jsonl:12 | reverts.jsonl:3
  status?: string;
  agentId?: string;
  itemId?: string;
  paths?: string[];
}
```

### Identificadores

| Fuente | Id |
| --- | --- |
| Goal | `goal` |
| Item del plan | `item:<item.id>` |
| Cambio de límite | `decision:limit:<n>` |
| Reporte de límite | `report:limit:<n>` |
| Evidencia de un item | `artifact:<item.id>:<n>` |
| Cambio de archivo | `change:<línea>` |
| Reversión | `revert:<línea>` |

Los ids de `change` y `revert` usan la línea del JSONL. Es estable mientras el
archivo sea append-only, que es su contrato actual.

## Búsqueda

```ts
searchAutonRegistry(snapshot, {
  id?: string;
  text?: string;       // título, resumen y referencias
  kind?: AutonRegistryRecordKind;
  ref?: string;        // coincidencia exacta de referencia
  limit?: number;      // 5 por defecto, 20 máximo
});
```

Devuelve `{ matches, total, truncated, query }`. El formato compacto imprime
**una línea por ficha y nunca más de `limit` líneas**:

```text
- item:s1 [sprint] running · owner programmer · Leer el diario (plan.json)
- change:12 [change] prog1 cambió src/login.ts (120 B → 160 B, sha ...) (changes.jsonl:12)
```

## Verificación

`verifyAutonRegistry(snapshot)` informa, no corrige:

- `invalid_plan`: el plan no cumple el esquema.
- `malformed_line`: una línea del JSONL no es JSON o no tiene la forma esperada.
- `duplicate_id`: dos fichas con el mismo id.
- `broken_ref`: una referencia con forma de id no existe.

Una línea corrupta no invalida el resto del registro.

## Privacidad

El resumen de un cambio incluye ruta, tamaño antes/después y una huella SHA-256
corta. No incluye `before` ni `after`. Así una búsqueda no filtra secretos que
hayan pasado por el diario.

## Criterio de hecho del Nivel 0

- [x] Lee un workspace vacío sin inventar fichas.
- [x] Convierte plan, cambios y reversión en fichas enlazadas.
- [x] Busca por texto, id, referencia y tipo, con tope duro.
- [x] Tolera plan o líneas corruptas y lo reporta.
- [x] Verifica ids duplicados y referencias rotas.
- [x] No expone el contenido de los cambios.
- [x] No escribe ni integra hooks.

## Siguiente nivel (no incluido aquí)

El Nivel 1 agrega contrato versionado, escritura append-only, idempotencia,
topes, redacción, índice persistente y los dos hooks mínimos. El Nivel 0 es
deliberadamente un lector para probar que el modelo de fichas encaja con los
datos reales antes de formalizarlo.
