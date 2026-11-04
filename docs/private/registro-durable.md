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

## Nivel 1A — contrato y almacén append-only

Esta capa formaliza el evento durable y su escritura. Todavía **no** incluye
hooks, índice persistente ni UI: solo el contrato y el almacén.

### Contrato

En `contracts/src/auton/registry.ts`, exportado desde `@zcode/contracts`:

- `AUTON_REGISTRY_FILE_VERSION = 1` y `AUTON_REGISTRY_FILE_NAME = "registry.jsonl"`.
- `AUTON_REGISTRY_KINDS`: `goal`, `sprint`, `dispatch`, `report`, `decision`,
  `artifact`, `change`, `revert`.
- `AutonRegistryEventSchema` (estricto): `version`, `id`, `at`, `kind`, `title`,
  `summary`, `refs`, `source`, y opcionales `status`, `agentId`, `itemId`,
  `paths`, `dedupeKey`. Una clave fuera del contrato —por ejemplo `before` o
  `after`— invalida la línea.
- `AutonRegistryAppendInputSchema`: misma forma con `version`, `id` y `at`
  opcionales. A propósito **no** impone los topes de `title`, `summary`, `refs`
  ni `paths`: el almacén los redacta y trunca después de validar la forma.
- `AutonRegistryAppendResultSchema`: `{ appended, record?, reason? }`, con
  `reason` en `duplicate_id` o `duplicate_dedupe_key`.
- `AutonRegistryLogSchema`: `{ version, generatedAt, records, warnings }`; cada
  advertencia es `malformed_line`, `invalid_record` o `duplicate_id`.

### Almacén

En `core/src/auton/registry-store.ts`, sobre `<workspace>/.auton/registry.jsonl`:

1. Valida la entrada y completa `at` (ISO) e `id` cuando faltan.
2. El id autogenerado es `evt:<at>:<sha256 corto>` sobre
   `kind|source|title|summary|dedupeKey`; el mismo contenido produce el mismo id.
3. Redacta secretos antes de medir: `Bearer …`, `sk-…`, `ghp_…`,
   `github_pat_…`, `xoxb-…`, `AKIA…`, pares `password=`, `token=`, `api_key=`,
   `secret=` y bloques `-----BEGIN … PRIVATE KEY-----`.
4. Aplica topes: título 200, resumen 800, 20 referencias de 300, 50 rutas de
   500. Lo que excede se corta con `…`.
5. Es idempotente: si el `id` ya existe devuelve el registro previo con
   `duplicate_id`; si el `dedupeKey` ya existe, con `duplicate_dedupe_key`. En
   ambos casos no escribe.
6. Crea `.auton` si falta y hace `appendFileSync`; nunca reescribe el archivo.
7. La lectura (`readRegistryLog`) salta líneas corruptas o fuera de contrato y
   las reporta como advertencia. `verifyRegistryLog` reutiliza esas
   advertencias para decir si el log es sano.

El registro no guarda el contenido de los archivos ni el par `before`/`after`.
La lectura tampoco lo expone.

### Pruebas del nivel

`core/tests/auton-registry-store.test.ts` cubre: append y lectura; append que no
reescribe la primera línea; idempotencia por `id` y por `dedupeKey`; redacción de
secretos (el texto original no queda en el archivo); truncado de los cuatro
campos; línea corrupta tolerada con advertencia; id determinista; y que el
archivo solo contiene claves del contrato, sin `before`/`after`.

### Lo que falta para cerrar el Nivel 1

El índice persistente (para buscar sin releer el JSONL) y los dos hooks mínimos
en plan-handler y revert-handler. Este bloque no los toca.

## Nivel 1B — lectura del log durable y herramienta AutonRecall

Esta capa conecta el almacén del Nivel 1A con el lector y con el orquestador.
Sigue siendo solo lectura: no agrega hooks, no escribe el plan ni la reversión y
no toca la UI.

### Lectura

`readAutonRegistry` lee, además de `plan.json`, `changes.jsonl` y
`reverts.jsonl`, el archivo `<workspace>/.auton/registry.jsonl` mediante
`readRegistryLog`. Cada evento durable se convierte en la misma ficha
`AutonRegistryRecord`:

- `id`, `at`, `kind`, `title`, `summary`, `refs` y los opcionales `status`,
  `agentId`, `itemId`, `paths` vienen del evento;
- `source` es el origen que declaró el escritor (por ejemplo `dispatch:7`), no
  la línea del archivo.

La fusión es determinista:

1. Primero se arman las fichas derivadas del plan, los cambios y las
   reversiones.
2. Un evento durable con el mismo `id` que una ficha derivada **la reemplaza**.
   El durable gana y no queda duplicado.
3. Un `id` repetido dentro del log conserva la primera aparición, para no
   multiplicar fichas.
4. Las advertencias del log (`malformed_line`, `invalid_record`,
   `duplicate_id`) se copian al snapshot. Una línea corrupta no tumba el resto.

`"dispatch"` se suma a `AUTON_REGISTRY_RECORD_KINDS` y `"invalid_record"` a los
códigos de advertencia del lector, para que ambas capas hablen el mismo
vocabulario.

### Herramienta AutonRecall

Contrato en `contracts/src/auton/recall.ts`, handler en
`core/src/auton/recall-handler.ts`, registrada en el arreglo de herramientas
integradas.

Entrada estricta (`AutonRecallInputSchema`):

| Campo | Regla |
| --- | --- |
| `query` | texto libre, recortado, 1–300 caracteres |
| `id` | id exacto, 1–160 caracteres |
| `kind` | uno de los tipos del registro (`goal`, `sprint`, `dispatch`, `report`, `decision`, `artifact`, `change`, `revert`) |
| `ref` | referencia exacta, 1–300 caracteres |
| `limit` | entero 1–20; 5 por defecto |

Debe venir al menos uno de `query`, `id`, `ref` o `kind`; sin selector la
validación falla en vez de adivinar. La herramienta llama a
`readAutonRegistry` y `searchAutonRegistry`, y devuelve:

```ts
{
  text: string;        // una línea por ficha, con id y fuente
  matches: { id, kind, at?, title, summary, refs, source }[];
  total: number;       // coincidencias antes del tope
  truncated: boolean;  // true si total > limit
}
```

El texto nunca imprime más de `limit` líneas y cada línea tiene la forma
`- <id> [<kind>] <resumen> (<source>)`. Ni la ficha ni el texto incluyen
`before`, `after` ni el contenido de un archivo.

Metadatos de la entrada: `readOnly: true`, `destructive: false`,
`concurrentSafe: true`, `timeoutMs: 10000`, `maxOutputBytes: 12000`,
`sideEffectScope: "workspace"`, `riskLevel: "low"`, `needsApproval: false`.
Permiso `auton.recall` con `denyPriority: "beforeAsk"` y sin aprobación.

### Pruebas del nivel

`core/tests/auton-registry-recall.test.ts` cubre: lectura del evento durable;
el durable reemplaza a la ficha derivada sin duplicar; búsqueda por texto, id,
referencia y tipo; tope de líneas y valor por defecto 5; rechazo de `limit: 50`;
rechazo sin selector; workspace vacío sin recuerdos; advertencias del log
propagadas; ausencia de `before`/`after` y de contenido de archivos; y los
metadatos de lectura/concurrencia segura.

### Lo que falta para cerrar el Nivel 1

El índice persistente y los dos hooks mínimos en plan-handler y
revert-handler. Este bloque no los toca.

## Nivel 1C — índice persistente y hooks mínimos

Esta capa cierra el Nivel 1: agrega una caché derivada del log y conecta los
dos momentos que faltaban (escribir el plan y ejecutar una reversión) con el
registro durable. Sigue sin tocar la UI y sin usar vectores.

### Índice persistente

Contrato en `contracts/src/auton/registry-index.ts`, implementación en
`core/src/auton/registry-index.ts`, sobre `<workspace>/.auton/registry-index.json`:

- `AutonRegistryIndexSchema` (estricto): `version`, `generatedAt`, `sourceBytes`,
  `records` y `warnings`. `sourceBytes` es el tamaño exacto de `registry.jsonl`
  cuando se generó el índice.
- `readRegistryIndex` devuelve `null` si el índice falta, si no valida el
  esquema, si no existe el log o si `sourceBytes` no coincide con el tamaño
  actual. El índice nunca es fuente de verdad.
- `writeRegistryIndex` y `refreshRegistryIndex` escriben de forma atómica: un
  temporal en el mismo directorio y `renameSync` encima, sin dejar `.tmp`.
- `readRegistryLogCached` usa el índice solo si es fresco; si no, lee el log,
  reconstruye el índice como mejor esfuerzo y devuelve el log.
- Un fallo al escribir el índice no invalida un evento ya anexado: el log manda.

Cada `appendRegistryRecord` refresca el índice después de `appendFileSync`,
dentro de un `try/catch`.

### Hooks mínimos

En `core/src/auton/registry-hooks.ts`:

- `recordPlanWrite` compara el plan anterior con el nuevo y anexa solo lo que
  cambió: goal, items (nuevos o distintos), entradas nuevas de `limitHistory` y
  entradas nuevas de `limitReports`. Un item cuyo `attempts` subió o que pasó a
  `running` se registra como `dispatch`; el resto, como `sprint`.
- `recordRevert` refleja el `audit` que ya escribió `reverts.jsonl`: paths,
  resultado y conteos. No reescribe ni duplica la línea del diario.
- Los ids son un SHA-256 corto del JSON canónico de la entrada; el mismo
  contenido produce el mismo id y el mismo `dedupeKey`. No se usa `Date.now()`
  para construir ids.
- Ningún evento incluye `before`, `after` ni el contenido de un archivo.

Los handlers llaman a los hooks después de completar su trabajo:
`plan-handler.ts` tras `writeFile` y `revert-handler.ts` tras calcular el
resultado. `revert-executor.ts` devuelve además `audit` de forma aditiva.

### Pruebas del nivel

`core/tests/auton-registry-index.test.ts` cubre la frescura por tamaño, el
esquema inválido, la caída al log con una línea corrupta, la reconstrucción sin
registros viejos, la ausencia de `.tmp` y de `before`/`after`.
`core/tests/auton-registry-hooks.test.ts` cubre los cuatro tipos de evento del
plan, la idempotencia, la conservación de eventos anteriores, la reversión, la
integración con `AutonPlan`/`AutonRevert`, los ids deterministas y el índice con
los eventos de los hooks. `auton-four-pieces.test.ts` exige `AutonRecall` y los
dos archivos nuevos en el prompt.

## Siguiente nivel (no incluido aquí)

El Nivel 1 agrega contrato versionado, escritura append-only, idempotencia,
topes, redacción, índice persistente y los dos hooks mínimos. El Nivel 0 es
deliberadamente un lector para probar que el modelo de fichas encaja con los
datos reales antes de formalizarlo.
