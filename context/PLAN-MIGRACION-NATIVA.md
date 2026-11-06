# Plan oficial: Auton nativo y núcleo podado

Estado: aprobado para exploración e implementación en dos ramas locales.  
Base inspeccionada: `edies76/auton-desktop`, rama `auton-desktop`, commit `e565f076`.  
No abrir PR ni fusionar ramas sin indicación de Edi.

## Objetivo

Entregar una versión de Auton de escritorio que se pueda arrancar y probar en menos de una hora desde que Edi retome el chat. La app debe sentirse ligera y rápida, conservar el flujo real del orquestador y mostrar una interfaz nativa, profesional y cercana a ZCode, con el tono visual cálido y claro de Grok Bot.

La prioridad es rendimiento percibido, arranque, consumo de memoria y respuesta de la interfaz. No se adopta una tecnología por su etiqueta: se comparan mediciones del mismo flujo y hardware. La meta no es portar ZCode entero. Se conserva solo lo que Auton necesita.

## Ramas y límites

### `feat/edi/auton-native-ui`

Responsable de la nueva aplicación nativa Rust. Se debe evaluar GPUI como primera opción y comparar alternativas viables si la compatibilidad, licencia, estabilidad, distribución o soporte de Windows no cumplen. La primera entrega debe conectarse al agente real mediante una frontera de proceso estable; no debe simular respuestas para aparentar integración.

Incluye el shell de escritorio Auton, navegación mínima, conversación con streaming, estados del trabajo y workers, visualización del plan/evidencia, selección/configuración mínima de proveedor y manejo legible de errores. Reutiliza los contratos de agente existentes cuando sea práctico.

**El orquestador forma parte de la entrega funcional.** Preferencia: iniciar y supervisar el runtime real existente como proceso hijo desde la app nativa y adaptar su protocolo. Si separar el runtime en el mismo cambio introduce demasiado riesgo, la UI debe llevar una interfaz estable (`OrchestratorHost` o equivalente), un adaptador real para el protocolo existente y una implementación de prueba únicamente para tests. La arquitectura, el punto de entrada y el flujo de eventos deben dejar preparada la integración; no se considera completa una UI que solo sea un mock y deje al usuario la tarea de ensamblar el orquestador después.

### `feat/edi/auton-clean-core`

Responsable de separar el núcleo útil de ZCode y documentar la poda. Contiene dos entregas:

1. **Motor de edición y agente**: extraer a una unidad limpia y modificable, con contratos explícitos, pruebas de comportamiento y dependencias minimizadas. Mantener inicialmente el lenguaje y runtime donde reducir riesgo sea razonable; cambiar lenguaje solo cuando aporte un beneficio medido o facilite una frontera clara.
2. **Inventario de componentes de ZCode**: clasificar cada subsistema como conservar, extraer, reemplazar o eliminar, con dependencia, motivo, coste y riesgo. Conservar el sistema de proveedores y cualquier infraestructura que el agente necesite para operar de verdad.

No se borra ni reescribe a ciegas el motor de edición. El comportamiento que se considera esencial se identifica y se protege antes de podar.

## Principios de producto

- El humano conversa con el orquestador; workers y motores son dirigidos por él.
- El orquestador planifica, delega, observa, decide y cierra con evidencia.
- Una sola conversación principal; los detalles de cada worker se pueden inspeccionar, pero no se convierte al usuario en mensajero entre agentes.
- La UI no inventa estados: consume el estado y los eventos reales del agente.
- Mantener la distinción entre contrato del objetivo, unidad de trabajo del orquestador, encargo del worker y pasos internos del worker.
- Reusar ZCode por valor funcional demostrado, no por costumbre ni por facilidad de mantener el fork.
- Preservar licencias, avisos y atribuciones de dependencias reutilizadas.
- Nada de credenciales, tokens ni datos privados en archivos versionados.

## Fases

### Fase 0 — Mapa verificable

1. Leer `context/EMPIEZA-AQUI.md`, `context/REPARTO-DE-TRABAJO.md`, `context/ARQUITECTURA-ORQUESTADOR.md`, `context/AUTON-VISION.md` y los documentos privados relevantes.
2. Contrastar cada afirmación con la rama y los símbolos actuales; actualizar las discrepancias en el inventario.
3. Trazar el recorrido real de una solicitud: UI → protocolo → runtime del agente → herramienta de edición → resultado/eventos → UI.
4. Identificar qué funciones Auton necesita para la primera versión y separar dependencias de ZCode de funciones prescindibles.

**Salida:** mapa de arquitectura, inventario keep/extract/replace/remove y lista de riesgos con evidencia.

### Fase 1 — Contratos y prueba de rendimiento

1. Definir el contrato mínimo entre UI y agente: iniciar/reanudar sesión, enviar mensaje, streaming, estado de worker, plan, evidencia, detener/cancelar y errores.
2. Preferir el protocolo de proceso existente si sus contratos cubren el flujo; extenderlo de forma versionada si no.
3. Preparar un escenario repetible que mida arranque hasta interactivo, memoria en reposo y durante una tarea, CPU y latencia/fluidez.
4. Fijar la misma máquina, tarea, proveedor/modelo, configuración y carga para cualquier comparación.

**Salida:** especificación de IPC y método de comparación; línea base de la app actual cuando el entorno permita medirla.

### Fase 2 — Rebanada vertical de la UI nativa

1. Crear una ventana Rust que arranque desde instrucciones reproducibles.
2. Implementar identidad visual, navegación principal y conversación.
3. Conectar la conversación al orquestador/agente real, mostrando streaming, eventos de Auton y errores reales.
4. Añadir un flujo demostrable: abrir proyecto → enviar objetivo → observar respuesta/worker → consultar plan o evidencia.

**Salida:** app ejecutable y una tarea real de extremo a extremo, no un mock de interfaz.

### Fase 3 — Extracción limpia del núcleo

1. Inventariar módulos del agente, herramientas, edición, proveedores, filesystem, terminal, contexto y sesión.
2. Aislar el motor de edición con su contrato y matriz de comportamiento: lectura, escritura, edición contextual, aplicación de parches, atomicidad, conflictos/versionado y reversión, según exista en la base.
3. Separar las herramientas que el agente necesita de subsistemas de producto no necesarios.
4. Mantener las pruebas de regresión pertinentes y agregar cobertura para las fronteras extraídas.
5. Documentar lo que todavía depende de ZCode y el coste de reemplazarlo.

**Salida:** núcleo compilable/probable por separado, con instrucciones claras, inventario de dependencia y sin arrastrar UI innecesaria.

### Fase 4 — Completar la experiencia Auton

1. Conversación y sesiones persistentes.
2. Lista y detalle de workers con estado, reloj, transcripción y parada.
3. Plan de trabajo legible, preguntas/decisiones y evidencia.
4. Configuración de proveedores conservada solo donde esté integrada y comprobada.
5. Estados vacíos, fallos, recuperación, cancelación y reinicio de la app.

**Salida:** flujo funcional y usable sin instrucciones manuales de Codex para cada sesión.

### Fase 5 — Estabilizar y preparar la prueba de Edi

1. Ejecutar los chequeos de formato, tipos, arquitectura y pruebas específicas definidas por el repo.
2. Probar instalación/desarrollo limpio según el sistema destino confirmado por el repo y revisar que no dependan de secretos locales.
3. Entregar comandos de una sola ruta, datos de prueba no sensibles y un guion de aceptación de 30–45 minutos.
4. Reportar mediciones reales, fallos conocidos y funciones que todavía no están incluidas.

**Salida:** al volver al chat, Edi puede arrancar con instrucciones cortas y completar una prueba guiada en menos de una hora.

## Criterios de aceptación

### Interfaz nativa

- Ventana nativa inicia desde un entorno limpio siguiendo el README de la rama.
- Se ve y se siente como una herramienta de trabajo profesional; tipografía, jerarquía, densidad, estados y color siguen la dirección visual acordada.
- Conversación conectada al agente real con respuesta incremental.
- El orquestador está incluido como proceso integrado o su adaptador real está conectado y documentado; el usuario no tiene que inventar una capa de ensamblaje.
- Puede crear/abrir un proyecto, solicitar trabajo, observar el estado y llegar a plan/evidencia disponibles.
- Cerrar y volver a abrir no pierde la sesión de forma silenciosa.
- Errores de proveedor, agente y protocolo se explican y permiten continuar o recuperarse.
- Rendimiento comparado con la línea base bajo carga equivalente; toda cifra incluye equipo, escenario y método.

### Núcleo podado

- El motor de edición se puede entender y modificar desde una unidad aislada con límites explícitos.
- Pruebas de regresión cubren el comportamiento heredado que se conserva.
- Cada parte de ZCode queda clasificada con razón; “eliminar” requiere comprobar que no es dependencia transitiva necesaria.
- El agente conserva sus capacidades esenciales y el contrato con Auton, sin UI ZCode superflua.
- Licencias y avisos se conservan.

### Tiempo de Edi

- Preparación y compilación documentadas, preferiblemente automatizadas con un script.
- Guion de prueba con resultado observable en cada paso y sin tener que leer código.
- El recorrido completo de aceptación cabe en 45 minutos, dejando 15 minutos de margen para instalación o inconvenientes menores.

## Qué no se promete antes de medir

- Una cifra exacta de RAM o de velocidad frente a Electron.
- Igualdad de funcionalidades con ZCode.
- Portar a Rust todos los proveedores, herramientas y servicios.
- Compatibilidad multiplataforma completa si no se valida en cada sistema objetivo.
- Que GPUI sea automáticamente la mejor elección por ser el framework del nuevo Discord o de Zed.

## Reglas de trabajo

- Mantener las dos ramas aisladas; no hacer cherry-pick entre ellas hasta que los contratos y el contenido estén revisados.
- Hacer commits pequeños y con propósito; nunca abrir PR sin petición explícita.
- Antes de declarar una fase lista, ejecutar y registrar sus verificaciones reales.
- No afirmar que algo está probado si solo existe una prueba estructural o un mock.
- Actualizar documentación privada cuando cambie el estado real; no copiar al mapa de estado promesas aún sin verificar.
- Si aparece una decisión que cambie la experiencia del usuario o el alcance de producto, formular una recomendación concreta con consecuencias y continuar mientras no dependa de esa respuesta.
