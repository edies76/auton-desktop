# Poda, tanda 1: propuesta con datos de la corrida de Feria

> Esto es una **propuesta**, no una ejecución. Sale de medir una corrida real
> completa, no de opinar. La regla sigue siendo la de `context/PODA-DE-ZCODE.md`:
> primero se esconde, después se borra, y nada se borra sin la app abriendo.

## Qué se midió

La corrida de Feria (proyecto de prueba, 15 de 16 ítems cerrados al medir, el
research final en curso) dejó el registro de llamadas del orquestador: 58 turnos,
74 llamadas a herramientas. Al orquestador se le **ofrecieron 38 herramientas**;
usó **7**:

| Herramienta | Llamadas |
|---|---|
| AutonPlan | 21 |
| Bash | 19 |
| Agent | 15 |
| SendMessage | 9 |
| AutonRevert | 5 |
| Read | 4 |
| Write | 1 |

Los workers, en sus propias sesiones, sí usaron otras (Edit, WebFetch, grep vía
Bash). Esta tabla es solo del cerebro que reparte: es la superficie que le
cuesta contexto en cada turno.

## Lo que el orquestador nunca llamó en una corrida completa

- **Familia Workflow** (10): CreateWorkflow, AmendWorkflow, SaveWorkflow,
  ListSavedWorkflows, ResumeWorkflowRun, GetWorkflowRun, ListWorkflowRuns,
  FillWorkflowHole, EvalWorkflowSnippet, ResolveWorkflowQuestion.
- **Familia Cron** (4): CronCreate, CronList, CronUpdate, CronDelete.
- **Familia OffPeak** (2): OffPeakCreate, OffPeakList.
- **Plan Mode del upstream** (2): EnterPlanMode, ExitPlanMode. Auton ya tiene
  su propio plan vivo; este es el modo plan de ZCode, que nadie invocó.
- **Sueltas** (9): AskUserQuestion (las preguntas fueron al plan, no a esta
  herramienta), Edit (editan los workers), ListModels, ReadSessionContext,
  ReplyToChannel, Skill, TaskOutput, TaskStop (la parada manual prometida va
  por el panel, no por aquí), TodoRead, TodoWrite, WebFetch y
  `mcp__node_repl__js`.

AutonRecall tampoco se llamó, pero **no entra en la propuesta**: su prueba es
el cierre de la corrida (recall desde el registro), que aún no ocurre. Podar
una promesa antes de probarla sería exactamente lo que la poda dice no hacer.

## La propuesta

**Tanda 1 (esconder, no borrar):** dejar de ofrecer al orquestador las
familias Workflow, Cron y OffPeak y el Plan Mode del upstream: 18 herramientas
menos en cada turno. No se toca el registro de los workers, que usan otro
conjunto. Verificación: la app abre, una corrida corta de prueba reparte y
cierra un ítem, y el orquestador no pide ninguna de las escondidas.

**Tanda 2 (solo con otra corrida de datos):** decidir sobre las sueltas. La
duda manda esconder, no borrar, así que ninguna se borra en esta tanda.

**Lo que no se toca:** AutonPlan, Agent, SendMessage, AutonRevert, AutonRecall,
Read, Write, Edit y Bash. Son el circuito que la corrida demostró vivo.

## Riesgo y cómo se deshace

Esconder es quitar una línea de la oferta, no borrar el handler: si una
corrida futura necesita workflows, se vuelve a ofrecer y ya. El costo de
equivocarse es bajo; el costo de no hacerlo es pagar 18 descripciones de
herramientas muertas en cada turno y enseñar una superficie que el producto
no usa.
