# Plan — Modo Auton dentro de ZCode

> Regla de oro (la que pidió el humano y muse no cumplió): **no se rehace la UI ni se inventa un
> design system**. Auton se **encaja** en lo que ZCode ya tiene — su shell, sus componentes, sus
> tokens, su i18n. Si algo se ve distinto, es porque ZCode ya lo tenía así.

Documento central del producto: [`../AUTON-VISION.md`](../AUTON-VISION.md) (Visión 2.0).

## Qué falló antes (para no repetirlo)

Muse clonó ZCode, cambió strings visibles a "Auton", tocó prompts internos (`context/`, `subagent/`)
y añadió una skill. Resultado: la app es ZCode con otro nombre; **no se ve nada de Auton**. Lo pedido
era lo inverso: que el concepto de Auton (goal, sprints, evidencia, decisiones) viva **dentro** de la
experiencia que ya existe.

## Las cinco superficies de la visión, y dónde viven hoy

| Superficie (Visión 2.0) | Dónde se engancha | Qué se reutiliza |
|---|---|---|
| **Goal Workspace** (§17.1) | El chat existente del proyecto | El composer, el stream de mensajes y el header: un goal es una conversación con un ingeniero, no diez bots. No se crea chat nuevo. |
| **Sprint Board** (§17.2) | Entrada nueva "Plan" en `packages/ui/src/project-sidebar/ProjectSidebarNavigation.tsx` + vista nueva `packages/ui/src/auton/SprintBoard.tsx` | Tokens, tipografía, radios y estados de `TaskList.tsx` / `TaskListItem.tsx`. |
| **Activity Feed** (§17.3) | Ya existe: el stream de la tarea | El mismo stream, filtrado a lo que importa (despachos, cierres, avisos). No es una consola aparte. |
| **Evidence Inspector** (§17.4) | Panel lateral derecho, junto a `GitPane` / `command-center` | El patrón de panel y pestañas que ZCode ya usa. Muestra por sprint: comando corrido, salida, archivos y hash. |
| **Decision Inbox** (§17.5) | Las preguntas del orquestador | `global-notice` / `BotsDialog` como superficie: una pregunta, 2-4 opciones, misma estética. |

## Datos: de dónde salen

Un solo archivo de estado por proyecto, escrito por el cerebro y leído por la UI:

```
<proyecto>/.auton/plan.json     goal, sprints[{id,title,status,kind,reviewOf}], evidence[], decisions[]
<proyecto>/.auton/events.jsonl  eventos append-only (despacho, cierre, reporte, aviso)
```

La UI **no** habla con el modelo: solo lee estado y escribe decisiones (respuestas, pausar, revertir).
El cerebro (`packages/auton-brain`) es quien orquesta. **No se copia** el `runtime.ts` del prototipo:
se reimplementa aquí, con sus pruebas.

## Primer cambio pequeño (lo que se hace ahora)

1. `packages/ui/src/auton/SprintBoard.tsx` que lee `plan.json` (si no existe, estado vacío con una
   frase: "este proyecto no tiene plan todavía").
2. Entrada "Plan" en `ProjectSidebarNavigation.tsx`, con el mismo estilo que las demás.
3. Ruta/estado en `app-shell` para abrirla dentro del workspace del proyecto.
4. Nada más: sin tocar el cerebro, sin tocar los prompts, sin renombrar nada.

Criterio de aceptación: abrir la app, entrar al proyecto, ver "Plan" en la barra, abrirlo y ver los
sprints si hay `plan.json` — con la estética de ZCode intacta.

## Orden después

1. Decision Inbox (reusa `global-notice`): es lo que hace visible que Auton te pregunta y obedece.
2. Evidence Inspector: es el 20 % de "profundidad técnica" y el argumento contra "dice listo".
3. Activity Feed filtrado: el reloj y el estado en vivo.
4. Goal Workspace: solo si el chat actual no basta; probablemente baste.
5. Cerebro real: adaptador de **Muse Code** como backend de programmers (25 % de la nota: uso de
   herramientas de Meta).
