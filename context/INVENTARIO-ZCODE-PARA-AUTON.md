# Inventario inicial de ZCode para Auton

Estado: mapa de extracción basado en inspección del código fuente de `auton-desktop` (`e565f076`), actualizado el 6 de noviembre de 2026. Se añadió un paquete independiente de edición de texto en `extracted/auton-editing-engine`; todavía no reemplaza handlers de producción ni implica que módulos ajenos al primer flujo se hayan borrado. Las decisiones marcadas como “conservar” son de alcance para Auton, no una afirmación de que cada archivo de esos paquetes ya sea independiente.

## Recorrido funcional identificado

La sesión real no depende solo de los handlers de edición. El CLI crea el runtime del agente; el protocolo de app-server acepta `session/create` y `session/send`, transmite eventos por NDJSON y conserva sesiones; el runtime compone proveedores, herramientas, permisos y almacenamiento; los handlers de archivo usan un puerto de filesystem que aplica revisión esperada/CAS; el host de escritorio selecciona carpeta, configura y supervisa el proceso; la UI proyecta eventos y comandos.

Consecuencia: extraer `write.ts`/`edit.ts` sin sus contratos de filesystem, lectura previa, contexto de herramienta, permisos, trazas y protocolos dejaría un editor que no es el editor probado de ZCode. La primera frontera limpia es el proceso de agente/protocolo; dentro de él, el motor de edición es un módulo que debe permanecer cubierto por sus pruebas.

## Clasificación

| Subsistema | Decisión inicial | Valor para Auton | Evidencia en el repo | Coste estimado | Riesgo / condición |
|---|---|---|---|---|---|
| Runtime del agente y bucle de herramientas | **Conservar; extraer después** | Entiende solicitudes, usa herramientas y reporta resultados al orquestador. | `apps/zcode-cli/packages/core/src/runtime/agent-runtime.ts`; paquete `@zcode/core`. | Alto para aislar; bajo para conservar tras app-server. | Depende de contracts, shared, workflow y CUA. Recortar por grafo, no mover un archivo y llamarlo independiente. |
| Lectura, escritura y edición contextual | **Conservar y aislar** | Es parte del motor de edición requerido. | `tool/handlers/read.ts`, `read-text.ts`, `write.ts`, `edit.ts`; revisión `expectedRevision`, lectura previa y ports inyectados. | Medio para el corte de texto; alto para paridad total. | El comportamiento también vive en filesystem ports, contracts, matcher, display y seguridad. Preservar semántica y regresiones. |
| Apply patch y reversión Auton | **Conservar** | Aplica cambios y posibilita recuperar trabajo delegado. | `tool/handlers/apply-patch.ts`; `core/src/auton/revert-*`; prueba `auton-revert-bytes`. | Alto por atomicidad, byte snapshots y conflictos. | No sustituir por escritura directa; mantener rollback, revisión y restauración exacta donde ya existan. |
| Auton brain, contratos y herramientas | **Conservar e integrar** | Es el producto propio: plan, límites, canal worker, registro, evidencia y reversión. | `core/src/auton`; contracts Auton; `contextOrchestrator.ts` y `contextAuton.ts`. | Alto para cambiar runtime; bajo para proyectar en UI. | El almacenamiento durable manda. La UI solo proyecta estado y envía comandos. |
| App-server y protocolo | **Conservar como frontera inicial** | Cambia la UI sin reescribir agente ni ciclo de sesión. | `shared/src/zcode-protocol/index.ts`; transport y `session/create/send/subscribe`; NDJSON/stdin. | Medio para reducirlo a facade Auton. | Es amplio y conserva vocabulario ZCode; versionar un subconjunto pequeño con pruebas. |
| Providers y selección de modelo | **Conservar; reducir la UI** | Sin ellos el agente no puede inferir. | `provider`, `provider-node`, `services`; `ProviderRegistry` y `ProviderConfigService`. | Alto para reescribir; bajo para reutilizar. | Credenciales fuera del repo. Hace falta completar altas, validación y selección en la UI nativa. |
| Persistencia de sesiones y datos Auton | **Conservar lo necesario; cambiar branding/rutas** | Restaura contexto y conserva plan/eventos al cerrar. | `shared/src/sqlite-migrations`, storage services y `.auton`. | Alto si se migra; medio para auditar. | Separar tablas de producto ZCode antes de podar; no quitar migraciones sin rastrear dependencias. |
| Host de procesos, filesystem, terminal y permisos | **Conservar/extraer por capacidad** | Ejecuta herramientas con límite de seguridad y workspace válido. | `desktop/src/host`, `services/src/process`, contracts y CLI tool executor. | Alto para portar; bajo para mantener bajo el agente. | Reemplazar shell no elimina estas funciones; mantener límites explícitos de workspace. |
| Selección y apertura de proyectos | **Conservar versión mínima** | Identifica el repo y la sesión activa. | `services/src/project-storage`; picker/list y workspace protocol. | Bajo para local; medio para identidad remota. | Reimplementar UI y mantener el contrato de ruta/workspace. |
| UI React/Zustand de ZCode | **Reemplazar** | No hace falta llevar toda la experiencia ZCode. | `packages/ui/src`; `auton/project-space`. | Alto si se replica todo; medio para el flujo Auton. | Portar solo conversación, estado, plan, workers, evidencia y settings necesarios. |
| Electron main/preload/IPC/window lifecycle | **Reemplazar** | Es la capa de escritorio que se quiere aligerar. | `packages/desktop/src/main`, host y `IPlatformService`; Electron 41. | Alto, especialmente distribución y permisos. | Reimplementar ventana, proceso, filesystem, actualización y empaquetado que sí se usen; no asumir reemplazo mecánico. |
| BrowserView/Playwright | **Diferir; incluir solo con caso demostrado** | Worker puede verificar producto sin cargar navegador al orquestador. | `desktop/src/main/browserView`, Playwright. | Alto. | Decidir navegador externo o headless; no meter BrowserView en el cliente mínimo por inercia. |
| MCP, plugins y marketplace | **Conservar MCP necesario; diferir tienda** | El agente puede requerir herramientas externas; marketplace no es esencial al primer cliente. | `core/src/subagent/mcp-*`, paquetes `*-plugin`, marketplace UI/server. | Medio para MCP; alto para tienda. | Separar runtime de catálogo. Eliminar solo tras comprobar descubrimiento, permisos y configuración. |
| Remote control, relays, mobile/web remote | **Diferir** | No hace falta para el desktop local inicial. | `packages/web`, `desktop/src/main/web-remote-relay`, shared relay. | Alto. | Conservar fuera del cliente mínimo hasta decidir el rumbo multidispositivo; revisar su seguridad antes de portar. |
| Bots, Feishu, Cron, recordatorios | **Excluir del primer cliente** | No forman el flujo local de dirección del orquestador. | SDK de Feishu, paquetes bots/automations y herramientas cron. | Medio-alto para mantener/portar. | Revisar dependencias transitivas del agente antes de eliminar paquetes completos. |
| Herramientas de documentos, PDF, hojas, presentaciones e imágenes | **Diferir y seleccionar** | Pueden servir en otros trabajos, pero no todas son necesarias para programar. | Paquetes `*-plugin`, `office-runtime` y servicios. | Alto si se incluyen todas. | Carga modular solo cuando un caso Auton las necesite. |
| Telemetría, updater e instaladores de ZCode | **Reemplazar o conservar infraestructura mínima** | Una distribución necesita errores y actualizaciones, no la lógica comercial de ZCode. | `desktopStabilityTelemetry.ts`, `electron-updater`, build scripts. | Medio. | Definir privacidad, consentimiento y distribución antes de reutilizar servicios externos. |
| TUI, SEA y modo headless | **Conservar como runtime temporal** | Inicia el agente sin Electron y sirve a la app nativa inicial. | CLI, `build:sea`, `app-server --stdio`. | Medio para empaquetar; bajo para arrancar durante desarrollo. | Aún falta un artefacto junto al shell; el protocolo es frontera, no distribución resuelta. |

## Prioridad de extracción

1. **Definir `AutonOrchestratorHost`** como contrato mínimo independiente de cualquier UI: abrir workspace/sesión, iniciar o reanudar conversación, enviar texto, recibir eventos incrementales, consultar el estado Auton, detener y recuperar errores.
2. **Adaptar el app-server real** usando el subconjunto existente `session/create`, `session/send`, `session/subscribe` y sus eventos. El protocolo actual usa mensajes JSON por línea en stdout; los logs van por stderr.
3. **Proteger el motor de edición** a través de sus interfaces existentes: file-system port, revisión esperada, lectura previa, apply-patch, rollback y permisos.
4. **Extraer después el núcleo** a paquetes independientes de UI; mover archivos sin reducir su dependencia no cuenta como poda.
5. **Excluir por defecto del cliente mínimo** tiendas, login comercial, marketplace, bots, integraciones remotas y pantallas administrativas, a menos que un requisito de Auton demostrado los necesite.

## Siguiente investigación necesaria

- Contrato completo y negociación inicial de `app-server --stdio` antes de codificar el cliente Rust.
- Cómo se materializa el provider config y el modelo seleccionado en una sesión iniciada por un host nuevo.
- Qué hooks de seguridad/filesystem ejecuta `packages/desktop/src/host` y cuáles pertenecen al CLI.
- Qué base de datos y migraciones necesita un agente headless.
- Build/distribución del agente junto al nuevo shell en Windows, que es el destino de aceptación prioritario.

## Limitación de esta fase

Este inventario es una clasificación de arquitectura inicial, no una auditoría exhaustiva de cada paquete ni autorización para borrar módulos. La poda concreta se hace solo después de seguir las importaciones y ejecutar las pruebas de la capacidad afectada.

## Resultado implementado en esta rama

- `extracted/auton-editing-engine` contiene un paquete Node independiente de Electron/React/ZCode runtime con `read`, `write`, `edit` y `applyPatch`, usando un `FileSystemPort` inyectado.
- `extracted/auton-agent/README.md` registra por qué se conserva el agente real a través del app-server en vez de copiar `AgentRuntime` sin sus dependencias; también deja el protocolo y la puerta de extracción explícitos.
- Se conserva el matcher tolerante actual de ZCode, lectura completa antes de sobrescritura, detección de contenido obsoleto, `expectedRevision`, parche validado antes de mutar y el callback opcional `onFileChange` para el diario/reversión Auton.
- La poda explícita deja fuera del paquete el lector multimodal (imagen/vídeo/PDF/notebook), la política de permisos, proveedor/modelo, telemetry y UI. La política de permisos pertenece al host; el filesystem adapter debe validar symlinks y permisos efectivos.
- Cobertura de la extracción local: 12 pruebas Node sobre lectura/edición/CAS, escritura desactualizada, ambigüedad, matcher de comillas, truncamiento, snapshots CRLF exactos, coerción semántica de `replace_all`, stat `kind: missing`, fallos del diario, prevalidación de parches y rutas fuera del workspace.
- El inventario de decisiones ampliado está en `context/DECISION-REUSO-ZCODE.md`.
