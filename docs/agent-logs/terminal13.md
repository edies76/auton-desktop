# terminal13 — motor de edición aislado

- Creé `extracted/auton-editing-engine` como paquete Node sin dependencias de Electron, React, providers ni runtime ZCode.
- Aislé Read/Write/Edit/ApplyPatch detrás del `FileSystemPort`; los writes usan `expectedRevision`, Edit/Write exigen lectura completa fresca y el patch verifica todos los destinos antes de empezar a mutar.
- Reutilicé el matcher tolerante del upstream y añadí `onFileChange` como seam para conectar el diario/reversión de Auton.
- Documenté explícitamente la poda: texto se conserva; multimedia, notebook, permisos UI, providers y telemetry siguen fuera del paquete y bajo responsabilidad del host.
- Añadí la matriz de conservación/exclusión en `context/DECISION-REUSO-ZCODE.md` y actualicé el inventario.
- Verificación real: `npm test` (12/12) y `npm run check` pasan en Node v24.22.1. Las pruebas nuevas comprueban snapshots CRLF exactos, coerción semántica de `replace_all`, puertos que reportan `kind: "missing"` y que una falla del diario se informa sin fingir que el archivo no se escribió.
- Límite restante: todavía no se conectó este paquete a los handlers de producción de `@zcode/core`; la rama deja el módulo aislado listo para una comparación de paridad antes de integrarlo.
