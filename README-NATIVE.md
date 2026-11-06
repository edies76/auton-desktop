# Auton nativo (GPUI)

Esta rama añade una ventana GPUI en Rust y un puente local con el `IZCodeAgentService` existente. No incluye Electron ni Chromium en la aplicación nueva. El motor de agente, los proveedores, las herramientas y la doctrina Auton siguen en el runtime TypeScript de ZCode, aislado con `~/.auton`.

La interfaz abre el proyecto elegido, crea o reanuda una sesión real, envía mensajes al runtime y lee sus eventos. Muestra el objetivo, los encargos del plan Auton, los workers que el runtime reporta y la evidencia escrita en `.auton/plan.json`. No hay respuestas simuladas.

## Arranque en Linux

Requisitos: Rust estable, Node 24.14.0 según `apps/zcode-cli/package.json`, Corepack/pnpm 10.33.2 y las dependencias de sistema que GPUI necesita para X11/Wayland, fuentes y Vulkan.

Desde la raíz de esta rama:

```sh
corepack pnpm@10.33.2 install --frozen-lockfile
./scripts/run-native.sh /ruta/al/proyecto
```

El primer arranque compila la app en modo release. Al iniciar el runtime, el helper de almacenamiento de ZCode puede copiar a `~/.auton/v2` la configuración de proveedores y credenciales permitidas que encuentre en `~/.zcode/v2`. No migra el historial ni las bases de sesiones de ZCode. Si es una instalación nueva, configura un proveedor con el formato que acepta ZCode antes de enviar un encargo.

Los planes viven en `<proyecto>/.auton/plan.json`; la sesión del agente vive bajo `~/.auton`. Usa un proyecto desechable o una rama de prueba para la primera ejecución.

## Recorrido de aceptación (30–45 minutos)

1. Abre un proyecto pequeño y espera a que el encabezado indique que la sesión está conectada.
2. Pide a Auton un cambio acotado con un criterio de aceptación comprobable.
3. Revisa su propuesta en el chat y responde ahí para aprobar la dirección.
4. Observa el plan y los workers que el runtime reporte en el panel izquierdo.
5. Cuando termine, inspecciona la respuesta y la evidencia que el orquestador guardó en el plan.
6. Cierra y vuelve a abrir la app para comprobar la reanudación de esa sesión.

El recorrido requiere un proveedor con credenciales válidas. En este entorno se verificó el contrato del puente y se compiló GPUI, pero no se pudo ejecutar una corrida con proveedor porque no hay pantalla gráfica ni credenciales de prueba.

## Estado y límites de esta rama

- Verificado: `cargo check --workspace`, `cargo test -p auton-core` (4 pasaron), typecheck del puente y `session.create` hasta el error real de proveedor no configurado, con stdout JSONL limpio.
- No verificado: una conversación real con proveedor, el recorrido visual, la experiencia de composición IME, Windows y el empaquetado instalable.
- El panel muestra workers activos reportados por eventos, pero todavía no abre su conversación individual ni ofrece controles para detenerlos. Tampoco muestra relojes por worker/sprint/goal.
- La app usa la sesión Auton real de ZCode. `auton-core` es la extracción Rust del contrato de plan/registro; el escritor activo de herramientas Auton todavía es TypeScript.
- No se midió rendimiento frente a Electron. La meta de reducción de inicio y memoria sigue pendiente; consulta [PERFORMANCE-NATIVE.md](PERFORMANCE-NATIVE.md).

GPUI 0.2.2 está en desarrollo activo y su documentación upstream indica macOS o Linux. Esta rama solo se compiló en Linux; no promete soporte de Windows.
