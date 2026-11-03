# Poda de ZCode: qué se queda y qué se va

> ZCode trae mucho más de lo que Auton necesita. Esto dice **qué se queda, qué se esconde y qué se
> borra**, en qué orden y con qué regla. **No es una lista para ejecutar a ciegas**: es el criterio, y
> cada tanda se verifica antes de pasar a la siguiente.

## La regla que gobierna todo

**Primero se esconde, después se borra.** Y nada se borra sin que la compilación siga en verde y sin que
la app abra. Un ZCode que arranca y hace menos es mejor que un ZCode limpio que no arranca.

## Lo que NO se toca nunca

Son las piezas que hacen que Auton funcione. Si algo de aquí parece innecesario, es que no se entendió:

1. **El motor de edición**: escritura atómica con reintento, comparación por revisión, matchers
   tolerantes, parches con rollback, checkpoints.
2. **El sistema de sesiones y el protocolo** entre la app y el agente.
3. **La interfaz y sus piezas**: componentes, tokens y tipografía. De aquí se reutiliza todo.
4. **El sistema de proveedores y modelos** (la elección de motor depende de él).
5. **El navegador interno** (lo necesita el worker para probar su trabajo).
6. **El motor de trabajo en segundo plano** de los agentes.

## Tanda 1 — Esconder (días, no semanas)

Quitar de la vista lo que confunde y no usamos. **No se borra código**: se desactiva la entrada de menú o
la pantalla, y se verifica que la app abra.

| Qué | Por qué se esconde |
|---|---|
| **Tienda de plugins y marketplace** | No vendemos plugins. Y ver una tienda vacía resta credibilidad |
| **Automatizaciones / tareas programadas de la app** | No es nuestro flujo; el nuestro es el orquestador |
| **Centro de control / paneles de operación de ZCode** | Información de un producto que no estamos presentando |
| **Cualquier pantalla de cuenta, plan o facturación** | No aplica en la hackathon |
| **Ajustes que dependen de servicios de ZCode en la nube** | No los vamos a usar y producen errores |

**Verificación de la tanda**: la app abre, el chat funciona, se puede elegir modelo, y no queda ninguna
entrada visible que no sepamos explicar en una frase.

## Tanda 2 — Borrar de verdad (módulos sin uso)

Solo lo que **no está referenciado** por lo que se queda. Un área por commit, con la compilación verde y
la app abriendo antes de seguir.

| Área | Qué se va | Cuidado |
|---|---|---|
| **Plugins y marketplace** | El registro de plugins, la tienda y los plugins que no usamos | Antes de borrar, mirar si alguno se usa internamente (el de sesiones heredadas ya se quitó) |
| **Remoto y móvil** | El relé externo, el control desde el móvil y sus protocolos | Es mucha superficie; y **no toca** el protocolo app ↔ agente |
| **Cuentas y facturación** | Todo lo de planes y suscripciones | No afecta a proveedores ni modelos |
| **Productos que no son Auton** | Pantallas y flujos de otros productos de ZCode | Revisar que no compartan componentes con la interfaz que reutilizamos |
| **Documentación del upstream** | Los documentos de ZCode que no nos aplican | **No borrar** `DESIGN.md` ni lo que describe la interfaz: eso se sigue usando |

**Regla de oro de la tanda 2**: si dudas, **no borres: esconde**. Borrar es lo último y lo más caro de
deshacer.

## Tanda 3 — Ordenar lo que queda

Con lo de fuera eliminado:

1. **Un solo mapa mental**: los menús y pantallas visibles deben corresponder a Auton: su chat, su tablero,
   su inspector de evidencia y sus ajustes. Nada más.
2. **Nombres**: lo que se ve dice "Auton". Sin restos del nombre anterior en menús, títulos ni diálogos.
3. **Rendimiento**: menos cosas cargando es una app que abre antes. Medir antes y después.
4. **Documentar lo que queda**: un documento corto que diga qué es cada pantalla visible y por qué existe.
   Si no puedes explicar una pantalla en una frase, sobra.

## Cómo se mide que la poda salió bien

- La app **abre** y el chat **funciona** (esto es obligatorio cada vez).
- El **paquete pesa menos** que antes, con el número a la vista.
- **No queda ninguna pantalla sin explicación** (la prueba de la frase única).
- Y el trabajo del orquestador (contrato, plan, despacho, reporte, evidencia) **sigue intacto**: si algo de
  eso se rompió, la poda se pasó de la raya.

## Por qué esto importa para la hackathon

Un producto que enseña la mitad de cosas que no usa se ve como un fork. Uno que enseña **solo lo suyo** se
ve como un producto. La poda no es limpieza: es parte de la presentación, y vale puntos en la rúbrica de
demo.
