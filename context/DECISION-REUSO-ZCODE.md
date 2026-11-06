# Qué conservar de ZCode para Auton

Estado: decisión de primera poda basada en el código y en la visión vigente de Auton. No autoriza borrar el resto del repositorio; cada corte grande requiere revisar importaciones y comportamiento.

## Núcleo que sí se conserva

| Capacidad | Reutilizar | Motivo |
|---|---|---|
| Agente que ejecuta herramientas | Runtime del agente, bucle de turnos, despacho de herramientas y subagentes | Es el programador que queda bajo dirección del orquestador. Rehacerlo aumentaría el riesgo sin acercar la interfaz a Auton. |
| Auton propio | `apps/zcode-cli/packages/core/src/auton`, sus contratos y el estado `.auton` | Contiene plan, encargos, workers, registro, diario de cambios, evidencia y reversión. Es el comportamiento diferencial del producto. |
| Proveedores | Registry/configuración de proveedores, selección de modelo y el runtime de proveedores Node | Sin ellos no existe ejecución real. Los secretos siguen en el almacenamiento local; no van al repo ni al workspace del proyecto. |
| Edición | Read de texto, Write, Edit, ApplyPatch, matcher tolerante, filesystem port y revisiones esperadas | Es la capacidad central que Edi quiere conservar y adaptar. La rama agrega un límite limpio para las operaciones de texto. |
| Recuperación y permisos | CAS de filesystem, autorización de herramientas y reversión byte a byte de Auton | Evita pisar cambios concurrentes y permite recuperar trabajo delegado con evidencia. No se reemplaza por escrituras directas desde la UI. |
| Protocolo de runtime | `app-server --stdio` y el subconjunto de sesión/eventos usado por la app nativa | Frontera temporal comprobable para separar shell y runtime. Después se puede reducir a un protocolo Auton versionado. |
| Herramientas de ingeniería | Bash/terminal, búsqueda de texto, glob, lectura, escritura, parches y el tool de agente | Permiten al worker programar y al orquestador asignarle trabajo. Se cargan según capacidad; no deben forzar todas las funciones de producto en el cliente. |

## Reemplazar en el cliente

- Electron main, preload, IPC y el renderer React/Zustand: el cliente nuevo es Rust y se comunica con el runtime por proceso/protocolo.
- Tienda de plugins, pantallas comerciales/de upgrade y navegación que Auton no usa.
- Pantallas de catálogo, historial administrativo y controles remotos que no formen parte del primer flujo de escritorio local.

## Diferir hasta que exista un caso Auton

- Marketplace e instalación dinámica de plugins; conservar el protocolo/hook mínimo si el agente lo requiere, posponer la tienda.
- BrowserView, Playwright y herramientas de navegación visual: el worker de programación puede usarlas más adelante, pero no justifican cargar un navegador en el shell de Auton hoy.
- Web/mobile remote, relays, bots, Feishu, cron y automatizaciones de terceros.
- Herramientas de documentos, hojas, presentaciones, PDF, imagen y vídeo que no sean parte del trabajo de software solicitado.
- Métricas comerciales, updater de ZCode y lógica de login ligada a planes o cuentas de ZCode.

## Consecuencias técnicas

1. La app nativa no debe duplicar el estado del plan, los permisos ni las credenciales: muestra proyecciones del runtime y manda decisiones por el contrato.
2. El primer corte usa el agente ZCode real y su almacenamiento Auton existente. Esto aporta funcionalidad rápido, pero mantiene dependencias del CLI y del contrato ZCode.
2a. El runtime del agente no se copió a un paquete incompleto: sus proveedores, permisos, filesystem, herramientas, subagentes y ensamblado de contexto son dependencias de ejecución reales. El límite actual es `app-server --stdio`; su decisión y puerta de extracción están en `extracted/auton-agent/README.md`.
3. El paquete `extracted/auton-editing-engine` separa lectura/escritura/edición/parches de texto detrás de `FileSystemPort`. Su hook `onFileChange` es el punto para conectar `journal.ts` y `revert-*` sin acoplar el motor a UI ni a JSONL de Auton. Si `readBinaryFile` devuelve revisiones, adjunta snapshots base64 exactas para preservar CRLF y otros bytes al revertir.
4. El paquete nuevo es un límite integrable, todavía no sustituye los handlers de producción de `@zcode/core`. Antes de conectarlo al runtime hay que comparar sus resultados con los handlers heredados y completar la cobertura de paridad.
5. El paquete deja fuera multimedia, notebook, telemetría y proyección específica de proveedores. Esos componentes no son parte del núcleo de edición de texto.
6. No se deben quitar migraciones ni módulos del monorepo hasta seguir su grafo de dependencias y comprobar los flujos que Auton conserva.

## Fuentes principales del inventario

- `apps/zcode-cli/packages/core/src/runtime/agent-runtime.ts`
- `apps/zcode-cli/packages/core/src/tool/handlers/{read,read-text,write,edit,apply-patch}.ts`
- `apps/zcode-cli/packages/core/src/tool/edit-matchers.ts`
- `apps/zcode-cli/packages/core/src/tool/path-policy.ts`
- `apps/zcode-cli/packages/core/src/auton/`
- `apps/zcode-cli/packages/contracts/src/interfaces/file-system.port.ts`
- `apps/zcode-cli/packages/provider/`, `apps/zcode-cli/packages/provider-node/`
- `apps/zcode-cli/packages/bootstrap/src/zcode-protocol/`
