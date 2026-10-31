# Briefing para agentes que trabajan en Auton

> Este documento existe para que cualquier agente (o persona) que entre al repositorio entienda en
> cinco minutos qué es Auton, en qué estado está y cómo se trabaja aquí sin pisar lo que ya hay.
> Si algo de aquí contradice a `AUTON-VISION.md`, manda la visión y hay que corregir este archivo.

## 1. Qué es Auton

**Un jefe de obra con IA.** El humano habla con un solo cerebro (el orquestador); los programmers
(manos) y los revisores (jueces) trabajan en background bajo su dirección. El humano nunca habla con
los subagentes: filtra el ruido y aprueba la dirección.

El centro, que es también el argumento del producto:

> En otras herramientas, el límite es el usuario: su disciplina para planear, verificar y reintentar.
> En Auton, esa disciplina es el producto.

Consecuencia práctica: si al terminar un trabajo el humano tuviera que pegar el siguiente paso,
escribir "sigue" o re-pegar un error, **Auton falló** — aunque el código esté bien.

El documento central es **[`AUTON-VISION.md`](../AUTON-VISION.md) (Visión 2.0)**. Léelo antes de
proponer arquitectura, UI o prioridades.

## 2. Qué es este repositorio

Es **ZCode** (Apache 2.0, agente de código open source) **con el modo Auton encajado dentro**, no una
app nueva. Regla de oro:

> **No se rehace la UI ni se inventa otro design system.** Auton se encaja en lo que ZCode ya tiene:
> su shell, sus componentes, sus tokens, su i18n. Si algo se ve distinto, es porque ZCode ya lo tenía
> así.

- `origin` → `zai-org/ZCode` (para traer actualizaciones del upstream). `auton` → este repositorio.
- La licencia y los avisos de ZCode se mantienen intactos.
- El prototipo del orquestador (`C:\Nueva-carpeta\auton cat jam zcode` en la máquina de Edi) **no es
  este producto**: es una fuente de ideas ya probadas (el prompt del orquestador, el ciclo de
  revisión, el protocolo de reporte). Su código **no se copia aquí**: lo que sirva, se reimplementa
  con sus pruebas.

## 3. En qué estado está (verificado)

| Pieza | Estado |
|---|---|
| Prompt interno "Modo Auton" | hecho: `apps/zcode-cli/packages/core/src/context/sections/auton.ts` (identidad + procedimiento, se inyecta solo) |
| Skill `auton-mode` | hecho, con la política de esfuerzo `minimal/standard/thorough` |
| Plan de las 5 superficies | escrito: [`docs/PLAN-MODO-AUTON.md`](./PLAN-MODO-AUTON.md) |
| Aislamiento de datos | hecho: la app y el runtime del agente usan `~/.auton` (vía `AUTON_STORAGE_DIR`), no `~/.zcode` |
| Plugin `restore-legacy-sessions` | eliminado del bundle (importaba sesiones del ZCode viejo) |
| Motor de edición de ZCode | **intacto** (CAS con `expectedRevision`, matchers tolerantes, apply-patch con rollback, escritura atómica, checkpoints). No tocarlo |
| Sprint Board (UI) | **pendiente**: es el primer cambio visible |
| Política en el brief del programador | **pendiente**: hoy vive en la skill, falta inyectarla por sprint |
| Despertador de mailbox | funcionando (ver §6) |

## 4. Cómo se trabaja aquí

1. **Reusar antes que crear.** Antes de escribir un componente, busca el que ya existe en
   `packages/ui/src` y adáptalo. Tokens, radios y tipografía salen de ahí, no de un gusto nuevo.
2. **La intensidad la decide el orquestador.** Cada sprint se despacha con un perfil escrito:
   - `minimal`: solo el cambio pedido. Prohibido refactorizar, renombrar, añadir features o
     "mejorar" vecinos.
   - `standard`: el encargo completo con su DoD, causa raíz, sin salirse del scope.
   - `thorough`: el encargo más lo que un buen ingeniero haría alrededor, anunciándolo antes.
   Un sprint `minimal` que toca archivos fuera de su scope **se considera fallido aunque compile**.
3. **Evidencia antes de cerrar.** Nada se cierra por declaración: comando corrido, salida, archivos.
   Y las revisiones en dos etapas: primero **cumplimiento del contrato** (contra el DoD, sin creer el
   reporte del implementador), después **calidad**.
4. **Un commit por cambio con sentido**, con mensaje que explique qué y por qué.
5. **Nunca credenciales en el repo**: ni `.env`, ni tokens en código, tests, docs o commits.
6. **No usar `--no-verify`** para saltarse checks; solo si el hook no puede correr, y entonces hay que
   correrlo después a mano y decirlo.
7. **Verificar el host antes de prometer.** Este fork corre sobre ZCode: si dices que algo "despierta
   una sesión", tienes que haberlo probado en este host y esta versión.

## 5. Las cinco superficies (Visión 2.0 §17)

| Superficie | Dónde se engancha |
|---|---|
| Goal Workspace | el chat existente del proyecto (no crear otro) |
| Sprint Board | entrada "Plan" en `packages/ui/src/project-sidebar/ProjectSidebarNavigation.tsx` + vista nueva, reusando los tokens de `TaskList.tsx` |
| Activity Feed | el stream de la tarea, filtrado (no una consola aparte) |
| Evidence Inspector | panel lateral junto a `GitPane`, con el patrón de panel que ya usan |
| Decision Inbox | las preguntas del orquestador, sobre `global-notice` / `BotsDialog` |

Datos: `<proyecto>/.auton/plan.json` + `events.jsonl`. La UI solo lee y escribe decisiones; el
cerebro orquesta.

## 6. Cómo hablar conmigo (grok-build)

- Estoy en el buzón como **`grok-build`** (id `c8aa0de8-4e0f-5257-9c6d-048db2c376f3`, workspace
  `0fd01cc2-564a-4c01-bb3a-c92e8113d0c7`, owner `Edigarlos`).
- Escríbeme por el buzón y **contesto yo, desde la sesión de chat** (no un proceso headless): me llega
  como aviso y respondo. Tardo de 10 segundos a un par de minutos; si hay que verificar algo en el
  repo, más.
- Pídeme cosas concretas: "¿cómo se despacha un sprint?", "¿qué falta para el Sprint Board?", "¿esto
  contradice la visión?". Contesto con lo verificado, y si no lo he comprobado, lo digo.
- No me pidas credenciales: no las paso por el buzón ni las escribo en ningún archivo del repo.

## 7. Prioridades ahora mismo

1. **Compilar el CLI** (`pnpm dev:local-cli`) para que el plugin eliminado deje de existir de verdad
   (el watcher de la app no cubre `apps/zcode-cli`).
2. **Política en el brief**: que el orquestador escriba `minimal|standard|thorough` al despachar.
3. **Sprint Board**: el primer cambio que el humano **ve**.
4. **Adaptador de Muse Code** como backend de programmers: es el 25 % de la nota de la hackathon
   (uso de herramientas de IA de Meta).
