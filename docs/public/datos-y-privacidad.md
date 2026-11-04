# Datos y privacidad

Auton trabaja sobre tu proyecto y tu máquina. Esta página explica dónde vive la información y qué sale de tu equipo.

## Dónde vive tu trabajo

- **Tu código** permanece en tu proyecto, en la carpeta que abres con la aplicación.
- **El plan y su historia** se guardan junto al proyecto, en una carpeta propia de Auton dentro de él. Viajan con el repositorio si tú decides versionarlos.
- **El registro de lo que pasó** (objetivo, despachos, decisiones, reportes y reversiones) también vive junto al proyecto. Cuando Auton consulta ese registro devuelve pocas líneas con identificadores y fuentes; nunca devuelve el contenido de tus archivos.
- **La conversación y la crónica** forman parte de la sesión de trabajo de la aplicación.

Auton no necesita mover tu proyecto a un servicio externo para dirigirlo.

## Qué sale de tu equipo

Auton dirige motores de programación. Cuando uno de ellos trabaja, la petición al modelo correspondiente sale de tu máquina, igual que cuando usas ese motor directamente. Auton no añade un intermediario propio ni reenvía tu proyecto a un servicio distinto del que ya usas para programar.

Las credenciales de los proveedores se configuran en el entorno de la aplicación. La documentación del producto no las incluye y el repositorio no las versiona.

## Qué se guarda y qué no

Auton distingue entre lo que constituye la historia del trabajo y lo que es telemetría de una corrida:

- **Se guarda**: objetivo, plan, piezas, decisiones, evidencia, cambios de límites y el registro durable de eventos.
- **No se guarda como historia**: el detalle efímero de una pieza que ya terminó, cuando pertenece a una ejecución que no se puede reanudar.
- **No se guarda en el registro**: el contenido anterior o posterior de tus archivos. El registro anota qué cambió, dónde y con qué huella, no el texto del cambio.

Al reabrir un proyecto, el sistema prefiere decir "esto quedó a medias" antes que fingir que una pieza terminó.

## Reversibilidad

El trabajo de una pieza se puede deshacer por pieza, por elemento o por rutas concretas. La restauración devuelve los archivos a su contenido anterior y deja rastro de lo que hizo.

## Límites de esta página

Esta es una explicación de producto. Los detalles técnicos de almacenamiento, protocolos y verificación se mantienen en la documentación interna del equipo, que no se publica en este sitio.

## Siguiente lectura

- [Qué es Auton](./que-es-auton.md): la propuesta del producto.
- [Límites y autonomía](./limites-y-autonomia.md): cómo se gobierna el sistema.
