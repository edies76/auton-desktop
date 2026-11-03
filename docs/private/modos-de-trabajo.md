# Modos de trabajo del worker

> Documento privado. Última verificación: 2026-11-03, rama `feat/grok/worker-sesion-completa`.
> Describe cómo funciona hoy. La decisión de producto está en `context/DECISIONES.md` (D7 y D8).

## Los dos ejes

El **esfuerzo** dice cuánto trabaja un worker: `minimal`, `standard`, `thorough`.
El **modo** dice qué clase de trabajo hace: `build`, `read`, `research`, `debug`, `refactor`.
Son ejes distintos y viajan en campos distintos. Mezclarlos en un solo nombre haría que ninguno de
los dos significara lo que dice.

| Modo | Qué hace | Criterio de hecho | Qué no hace |
| --- | --- | --- | --- |
| `build` (por defecto) | Escribe el código del encargo | El criterio del sprint, con su prueba y evidencia | Salirse del scope; refactorizar lo que no se pidió |
| `read` | Lee y resume qué hay, dónde y cómo está montado | Un resumen con rutas de archivo | **No escribe ni modifica nada**; no propone cambios |
| `research` | Investiga fuera y compara alternativas | Recomendación con razones y fuentes | No toca código; no entrega una lista de enlaces |
| `debug` | Reproduce el fallo y señala la causa raíz | El comando que reproduce y la causa señalada | No arregla: el arreglo va en un `build` |
| `refactor` | Cambia la forma sin cambiar el comportamiento | Los tests siguen en verde y lo observable no cambia | No mezcla features nuevas |

## Cómo viaja

1. El orquestador despacha con la herramienta Agent y su parámetro `mode`.
2. El modo entra en el request del despacho y llega a los dos tipos de worker (subagente y sesión).
3. El prompt del worker se compone con tres piezas: identidad, **sección del modo** y **política de
   esfuerzo**. La sección del modo declara propósito, criterio de hecho y prohibiciones.
4. El item del plan guarda el mismo `mode`, y el plan que lee el modelo lo imprime junto al esfuerzo.

Sin `mode`, el worker recibe `build`. Un valor inventado no pasa el esquema de la herramienta.

## La seguridad no vive solo en el texto

El modo recorta el juego de herramientas **antes** de crear el runtime:

- `read` y `research` pierden toda herramienta que pueda escribir: `Write`, `Edit`, `ApplyPatch`,
  `NotebookEdit`, `Bash`, `AutonRevert`, `AutonPlan` y las que crean o modifican workflows.
- `debug` conserva `Bash` para reproducir, pero pierde `Write`, `Edit`, `ApplyPatch`, `NotebookEdit`,
  `AutonRevert` y `AutonPlan`.
- `build` y `refactor` conservan el juego completo.

En el camino subagente se filtra la lista de permitidos; en el camino sesión se suma a la lista de
prohibidos. El resultado es el mismo: el worker de lectura no puede dejar una entrada en
`.auton/changes.jsonl` porque no tiene con qué escribir.

El límite honesto: `debug` conserva la shell para reproducir, y una shell puede escribir si se le
pide. La prohibición de arreglar es de prompt; si el caso exige ejecutar y escribir, va a `build`.

## La doctrina del orquestador

La sección del orquestador gana un bloque con el cuándo de cada modo:

- `read` cuando necesita contexto para decidir, que es la vía rápida y barata;
- `research` cuando hay que decidir entre alternativas externas;
- `debug` cuando hay un fallo y hace falta el comando que lo reproduce;
- `refactor` cuando hay que cambiar la forma sin cambiar el comportamiento;
- `build` por defecto, cuando hay que escribir o cambiar código.

El mismo bloque aclara que `worker_mode` es otra cosa (cómo se ejecuta: subagente o sesión) y pide
tono de ingeniero maduro: recomendar con razones, decir lo que se deja fuera y preguntar una vez.

## Pruebas

- `auton-worker-task-mode.test.ts`: los cinco modos, las quince combinaciones con esfuerzo, el
  default y el inválido, la política de herramientas, el esquema de la herramienta y el plan.
- `auton-worker-mode-safety.test.ts`: despacho real; `read` sin herramientas de escritura y sin
  diario, en sesión y en subagente; `debug` con shell y sin edición; `refactor` con juego completo.
- `auton-worker-dispatch.test.ts`: el modo viaja en el encargo y no se inventa si falta.
- `context/PRUEBAS-QUE-PROMETEMOS.md`: pruebas 19 a 22, una por modo.

## Lo que no cubre

- Elegir el modo automáticamente: lo decide el orquestador, de forma explícita.
- Modos de diseño visual, migración de datos y auditoría de seguridad: la D8 los deja para después.
- Aislar la shell de `debug` en un sandbox: hoy la garantía de no-arreglar es de prompt.
