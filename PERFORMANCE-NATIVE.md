# Medición de rendimiento: GPUI frente a Electron

## Qué se busca

La hipótesis aceptada para esta comparación es reducir al menos 50% el tiempo de apertura en frío y la memoria residente en reposo frente al cliente Electron, medidos en la misma máquina. Es una meta pendiente, no un resultado.

La app nueva dibuja la ventana con GPUI y no incluye Chromium. Para conservar el agente actual, ejecuta un proceso Node local con `@zcode/services`; la medición de Auton debe sumar Rust, Node y cualquier worker hijo. En Electron, suma todos los procesos de la aplicación, incluidos renderer y GPU. Comparar solo el proceso principal daría una cifra engañosa.

## Protocolo reproducible

1. Usa el mismo equipo, usuario, proyecto, escala de pantalla y conexión de proveedor.
2. Cierra por completo ambas aplicaciones antes de cada muestra. Alterna el orden para que una no se beneficie siempre del caché del sistema.
3. Haz cinco aperturas en frío por aplicación. Cronometra desde ejecutar el comando hasta que la ventana se puede usar; registra la mediana y las cinco muestras.
4. Tras cinco minutos sin actividad, suma el PSS de todo el árbol de procesos. En Linux, lee `/proc/<pid>/smaps_rollup` y suma `Pss`; RSS duplicaría páginas compartidas.
5. Anota SO, CPU, memoria, GPU, resolución, versión de Rust/GPUI/Node/pnpm, commit y si el proyecto tenía sesiones previas.
6. Publica ambas mediciones y el porcentaje calculado. Si no se alcanza 50%, conserva el resultado y reporta la diferencia.

## Estado de esta comparación

No hay mediciones todavía. El entorno de implementación no tiene `$DISPLAY` ni `WAYLAND_DISPLAY`, por lo que no permite cronometrar una ventana visible. Tampoco se construyó ni ejecutó un baseline Electron equivalente en este entorno. No se publican cifras estimadas de arranque o RAM.
