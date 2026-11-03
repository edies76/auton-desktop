# El worker como sesión completa

> Documento privado. Última verificación: 2026-11-03, rama `feat/grok/worker-sesion-completa`.
> Describe cómo funciona hoy, no el código línea por línea.

## Qué cambia

Antes el worker Auton era un subagente: el runner lo lanzaba como hijo, su juego de herramientas se recortaba con la política de subagentes y compartía el entorno del orquestador. Eso le impedía probar lo suyo (interfaz, integración) y lo dejaba sin el navegador.

Ahora hay dos modos y un interruptor:

| Modo | Qué es | Herramientas | Espacio | Navegador |
| --- | --- | --- | --- | --- |
| `session` (por defecto) | Sesión completa de ZCode | El mismo juego que el orquestador, sin los controles de orquestación | Carpeta propia y aislada | Propio del worker |
| `subagent` (vuelta atrás) | El worker de siempre, para un cambio pequeño de archivos | Recortadas por la política de subagente | El del orquestador | El del orquestador |

En modo sesión el worker puede leer, escribir, editar y ejecutar como el orquestador. Lo que no lleva es lo que sirve para dirigir a otros: repartir trabajo (`Agent`/`Task`), mensajear agentes (`SendMessage`) y el modo plan. Eso es una frontera de producto, no un recorte de la política de subagentes.

## El interruptor

Se resuelve en una función pura, antes de tocar el runtime, con este orden:

1. lo que pida el despacho (`worker_mode` en la herramienta Agent);
2. el interruptor del entorno (`AUTON_WORKER_MODE=subagent` para volver atrás) o la configuración del runtime;
3. el modo por defecto: `session`.

El worker nace como sesión completa salvo que se pida lo contrario. Para volver atrás en un despacho concreto basta `worker_mode: "subagent"`; para apagarlo en todo el proceso, `AUTON_WORKER_MODE=subagent`. En ese modo no se construye el puerto de sesión y el despacho usa exactamente la ruta anterior.

## Qué decide el modo

Una sola resolución produce todo lo que depende de él:

- **tipo de sesión**: `auton_worker_session` en modo sesión, `subagent_child` en modo subagente;
- **herramientas**: sin lista de permitidos en modo sesión (juego completo); con la lista de subagente en el otro;
- **carpeta**: `<proyecto>/.auton/workers/<sesión>` en modo sesión, hermana de los demás workers y distinta de la del orquestador. Se resuelve como ruta absoluta y se crea antes de arrancar el runtime, para que el primer comando del worker corra ahí y no en una ruta inexistente;
- **navegador**: del worker en modo sesión; compartido con el orquestador en modo subagente.

## Cómo se dirige

El orquestador usa la misma herramienta para los dos modos: crear, mandar, detener y leer. El puerto del worker de sesión expone ese ciclo y no pasa por el runner de subagentes.

- **Crear**: lanza el turno en segundo plano y devuelve el identificador del worker y el de su sesión.
- **Mandar**: entrega el mensaje como guía del turno en curso; con `requires_answer` el worker recibe el encabezado de decisión requerida y queda marcado esperando respuesta.
- **Detener**: aborta el turno y deja el worker visible como detenido. Si el turno termina después de la parada, no cambia el estado ni emite aviso de cierre: un stop no se convierte en "completado". La parada del orquestador y la del botón del panel resuelven el destino por el puerto que conoce la tarea.
- **Leer**: el estado vive en el registro de tareas, con su carpeta y su marca de aislamiento.

El registro de tareas es compartido con los subagentes. Por eso el puerto de sesión solo reclama como suyas las tareas que él creó: si bastara con que la tarea exista en el registro, cualquier subagente parecería suyo y `SendMessage` o `TaskStop` lo tratarían como worker de sesión. Esa propiedad es la que mantiene intacta la ruta anterior.

El mensaje del orquestador también resuelve el destino: `SendMessage` busca la tarea en el puerto de sesión primero y en el de subagentes después. Por eso el mismo canal sirve para los dos tipos de worker sin que el orquestador sepa cuál es cuál.

## El canal no depende del modo

La condición para registrar la herramienta de respuesta del worker dejó de ser "soy subagente" y pasó a ser "tengo puerto de coordinador". El manejador aplica la misma regla: rechaza cuando falta el puerto, nunca por el tipo de sesión. Así el worker de sesión publica avances, dudas y respuestas igual que el subagente, y el candado de decisión requerida se marca y se levanta con el mismo código.

## Cómo llega al espacio del proyecto

El panel de workers se alimenta de filas de subagente; un worker de sesión no produce esa fila. Para no romper la superficie nueva, se añade una traducción pura del estado real del worker a la misma forma que ya consume el panel: identificador de sesión, identificador para detenerlo, nombre, estado, inicio, última señal, última línea y transcripción. Los estados se traducen a los del panel (trabajando, preguntando, esperando, bloqueado, terminado), un worker ya presente no se duplica y el botón de parada tiene el identificador que necesita.

## Las cuatro piezas

| Pieza | Dónde se cumple |
| --- | --- |
| Handler | El puerto del worker de sesión y la fábrica de runtime con espacio y navegador propios |
| Registro | `worker_mode` declarado en la herramienta Agent con su descripción y valores |
| Línea en el prompt | La doctrina dice cuándo usar `session`: encargos que se construyen y se prueban a sí mismos |
| Prueba | Prueba 17 de `PRUEBAS-QUE-PROMETEMOS.md`; suites de modo, despacho y puerto |

## Lo que no cubre

- Migrar workers ya creados: el modo se decide al despachar.
- Las pantallas nuevas del espacio del proyecto: esta pieza entrega la traducción de datos, no la UI.
- Cambiar el canal, el protocolo de cierre o el motor de edición.

## Dónde vive

- La decisión del modo y la colocación: módulo `worker-mode` del núcleo Auton.
- El ciclo de vida del worker de sesión: módulo `session-worker`.
- La fábrica real del runtime: método `autonSessionWorker` del runtime.
- La traducción al panel: `sessionWorker` dentro de `project-space` en la UI.

El motor se elige aparte con `engine` (`zcode` por defecto, `muse` para Muse Code); el detalle vive en [muse-code.md](./muse-code.md).
