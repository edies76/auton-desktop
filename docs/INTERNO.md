# Estado interno de Auton Desktop

Documento **privado** de trabajo. El `README.md` es la cara pública; aquí está lo
que de verdad pasa, qué está verificado y qué nos falta. Si algo de aquí se
contradice con `AUTON-VISION.md`, manda la visión para producto y este archivo
para estado técnico.

Última actualización: 2026-11-01.

## 1. Dónde estamos

Auton Desktop arranca, se conecta a los proveedores heredados de ZCode, y la
conversación la lleva el **orquestador**. El orquestador escribe el plan en
`<proyecto>/.auton/plan.json` y despacha **programadores** (`auton-worker`) en
background, con una política de esfuerzo por encargo.

Lo que ya se probó de punta a punta en la app:

- La tarjeta **Auton plan** se dibuja en el chat y actualiza estados
  (`2/4 done · 1 running` visto en vivo).
- El worker se rotula **Programador** y su tarjeta abre la sesión.
- El despacho no bloquea: el worker corre en background.
- Los datos de la app viven en `~/.auton` y el perfil de Electron es `Auton Dev`.

## 2. Decisiones que no se tocan sin discutirlas

| Decisión | Por qué |
| --- | --- |
| El orquestador es el único interlocutor | Es el centro del producto: una conversación, un cerebro. |
| Datos en `~/.auton`, nunca `.zcode` | El usuario pidió separación real del ZCode original. Los proveedores se heredan una vez y ya. |
| El plan vive en disco | Un corte de la app o del modelo no puede borrar la verdad del proyecto. |
| Programadores siempre en background | El orquestador debe seguir disponible; el código lo fuerza, no depende del prompt. |
| Sin evidencia no hay item cerrado | La credibilidad del sistema es el producto. |

## 3. Superficie de código que ya es de Auton

| Pieza | Archivo |
| --- | --- |
| Doctrina del orquestador | `apps/zcode-cli/packages/core/src/context/sections/auton.ts` |
| Tool del plan | `packages/contracts/src/tools/auton-plan.ts`, `packages/core/src/tool/handlers/auton-plan.ts` |
| Tarjeta del plan | `packages/ui/src/ToolCallBlocks/renderers/auton-plan.tsx` |
| Perfil del worker y esfuerzo | `packages/core/src/subagent/worker-policy.ts`, `profile.ts`, `runner.ts` |
| Aislamiento de datos | `packages/services/src/paths.ts`, `packages/desktop/src/main/desktopDataBaseDirBootstrap.ts` |

## 4. Deuda y pendientes, en orden de impacto

1. **Reanudación de programadores.** El plan sobrevive; el proceso del worker no.
   Al reabrir, un item `running` se queda colgado. Siguiente paso: al arrancar,
   leer el plan y relanzar lo que quedó a medias con el contexto del reporte.
2. **Casa de CLI del agente.** Sigue usando `~/.zcode/cli` (plugins, agents, db,
   logs). Eso mantiene viva la lista de plugins ajena y contamina. Mover a
   `~/.auton/cli` y desactivar `computer-use` en esa copia.
3. **Auto-apertura del panel Programmers** al despachar.
4. **Lista de proyectos.** Las filas viejas ya están borradas del índice SQLite y
   el perfil de Electron se limpió; queda confirmar en la app que no vuelven.
5. **Dos `app-server` del agente** (~530 MB entre los dos). Uno debería bastar.
6. **Verificación independiente** como etapa formal (hoy verifica el orquestador).
7. **Documentación de la demo**: guion del video y benchmark contra baseline.

## 5. Cómo medimos

- Memoria: `Get-CimInstance Win32_Process` filtrando `electron.exe` y agrupando por
  tipo (`--type=renderer`, `app-server`, `__zcode-plugin-host`).
- El modo desarrollo suma ~600 MB de `tsup --watch` y Vite que no existen en una
  build empaquetada; al comparar, separar app de tooling.

## 6. Protocolo de trabajo con otros agentes

Vive en `docs/AGENT-BRIEFING.md`. Reglas cortas: un escritor por archivo, avisar
antes de tocar más de un archivo, un commit por cambio, nada de credenciales en
el repo, verificar antes de afirmar. La rama de trabajo es `auton-desktop`;
`origin` es el upstream de ZCode y `auton` es nuestro repo.
