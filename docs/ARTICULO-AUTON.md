# Auton: la arquitectura del orquestador

> **Estado de este documento: esqueleto con contenido, no la prosa final.** Cada sección lleva lo
> que debe decir y con qué se sostiene. La prosa se escribe encima en una pasada de redacción.
> Espeja la estructura del artículo de DeepSeek Harness ("Super-agent") **para poder contrastar
> sección con sección**, no para copiarla.

## La tesis, en una frase

**DeepSeek optimiza cuánto trabajo aguanta un sistema sin atención humana. Auton optimiza cuánto
criterio de ingeniería deja de aportar el humano.**

Son ejes distintos, y por eso no somos "un agente más". Su Router es explícitamente un despachador
(*"diseñado para no ejecutar tareas él mismo… un modelo ligero suele bastar"*), y ellos mismos dejan
abierto el problema difícil. Nosotros ponemos ahí un ingeniero.

## Lo que es nuevo para el mundo (y hay que decirlo así)

1. **El orquestador como ingeniero, no como despachador.** Convierte intención en trabajo verificable:
   contrato, descomposición en sprints con criterio de hecho, decisión de scope y paralelismo,
   revisión independiente en dos etapas, y replanificación cuando la realidad contradice el plan.
   El artículo de DeepSeek dice que el trabajo de su Router *"suele ser más simple de lo que se
   espera"* y reserva el ingenio para los Workers. Ahí está el hueco que ocupamos.
2. **Cierre con evidencia, no con declaración.** Un mensaje del modelo diciendo "listo" no cierra
   nada: cierra un artefacto reproducible vinculado al criterio de hecho. Su Watchdog vigila
   **vida y desvío**; nosotros exigimos **calidad verificada**.
3. **Autonomía gobernada.** Los predicados de escalamiento se escriben **en el contrato, antes de
   despachar**, se versionan, y el worker puede **reportar** que están mal calibrados pero nunca
   modificarlos. Y **NO EVALUABLE es un estado de primera clase**: si el sistema no puede decidir,
   escala, porque el fallo silencioso no es que se incumpla un umbral, es que **nadie mira**.
4. **Verificación proporcional al riesgo.** El orquestador **debe** verificar (dirigir exige comparar
   evidencia con el contrato) pero **no puede ser el único juez de su propio plan**.
   *Verificar sí, autocertificarse no.*
5. **Dirige motores que ya existen.** Auton es una capa por encima de Claude Code, Codex o el fork de
   ZCode con Muse Code. No compite con ellos: los manda. Su arquitectura construye el sistema entero.
6. **Una métrica que no se puede maquillar.** Intervenciones humanas **por entregable verificado**,
   contadas **sobre todos los intentos** (incluidos fallidos y bloqueados) con tasa de éxito, de fallo
   y de abandono, y con la calidad como **puerta de entrada**, nunca compensable.

---

## 1. Por qué un agente que resuelve tareas no basta

- El cuello de botella dejó de ser el modelo. Citarlo: *"a medida que las personas participan menos en
  la ejecución de bajo nivel, su rol se desplaza hacia decisiones y aprobaciones de mayor nivel"* y
  *"el cuello de botella se está moviendo hacia la atención humana"*.
- El síntoma que cualquiera reconoce: tres o cuatro sesiones, no puedes seguir más de tres o cinco, y
  acabas copiando errores de una a otra y escribiendo "sigue". Ese trabajo no es ingeniería: es
  coordinación.
- **[DERIVADO] Nuestro desplazamiento es un escalón más**: no solo mover al humano de la ejecución a
  las decisiones, sino de las decisiones de *ingeniería* a las de *producto*.

## 2. Arquitectura de tres niveles

| Nivel | Qué hace | Qué NO hace |
|---|---|---|
| Humano | Define qué construir, restricciones, y aprueba producto/riesgo | No dirige workers ni reparte trabajo |
| **Orquestador** | Contrato, descomposición, scope, revisión, replanificación, cierre | **No escribe el producto** |
| Workers | Programmers (manos) y revisores (jueces), cada uno con su contexto | Nunca hablan con el humano: reportan con estado |

- Comparación honesta con Router/Workers: la separación de niveles es **la misma idea**; lo que cambia
  es el oficio del nivel de arriba.
- **[CORRE en el prototipo]** El orquestador que no escribe producto ya existe: la herramienta de
  shell rechaza heredocs y redirecciones. Los revisores trabajan sobre el mismo directorio del
  implementador. Los reportes traen estado que manda sobre el código de salida del proceso.

## 3. Cómo se vuelve proactivo sin ahogarse

- Eventos con **dueño**: cada evento rutinario va a quien ya tiene el trabajo (el contrato vivo manda),
  no al orquestador. El orquestador ve **arranques, conflictos, bloqueos y desviaciones**.
- **Plano de control mecánico: código, no modelo.** Reglas, no razonamiento.
- **Caso sin regla aplicable**: evento desconocido o malformado **no se reenvía en silencio**: cola
  segura y escalado.
- Contraste con su filtro de dos etapas: su Fast Path descarta ruido; nuestro plano de control además
  **enruta con dueño** y **decide cuándo despertar al ingeniero**.

## 4. Cómo administra el contexto (y por qué es distinto del de un worker)

- El contexto del orquestador **no es una conversación**: es **el estado del trabajo** (contrato, plan,
  evidencia, decisiones). Por eso sobrevive a la compactación mejor que un chat.
- **[CORRE]** Compactación y microcompacto: resumen rodante, se conservan los últimos tramos, se limpian
  resultados viejos. El contexto se trata como caché, igual que ellos proponen.
- La diferencia: **la evidencia no se resume, se enlaza**. Un artefacto que prueba un criterio no se
  comprime; se referencia.

## 5. Autonomía regulada: la intensidad se escribe, no se espera

- Perfiles por sprint: **minimal** (solo lo pedido; prohibido refactorizar o tocar vecinos; un
  `minimal` que se sale del scope se considera fallido aunque compile), **standard** (el encargo con su
  criterio de hecho) y **thorough** (el encargo más lo que un buen ingeniero haría alrededor, anunciado
  antes).
- **[DERIVADO]** El hallazgo que lo justifica: en su experimento, con prompt normal el modelo **no
  delegó ni una vez en 5 corridas**; con prompt que insistía, delegó en 4 de 5 y los casos malos
  siguieron igual. *La disciplina no se pide en un prompt: se impone en la arquitectura.*

## 6. Verificación en dos etapas y cierre con evidencia

- Revisión de **contrato** primero (¿cumple el criterio de hecho?), **calidad** después. El revisor no
  arregla: lee, comprueba y reporta con archivo y línea.
- Prohibido creer el reporte del implementador.
- Un sprint cierra con artefacto reproducible vinculado al criterio, o queda bloqueado con el motivo
  escrito. Nada se cierra con problemas abiertos; las observaciones no bloqueantes se registran como
  *concerns* si el humano acepta el riesgo.

## 7. Gobierno de la autonomía

- El **contrato versiona** los predicados y registra quién y cuándo los cambió. Sin versión no hay
  gobierno.
- Cambio de objetivo, alcance o riesgo → **aprobación humana**; lo demás lo decide el orquestador.
- El worker **reporta** predicados mal calibrados; **nunca** los modifica.

## 8. El vigilante: el que tenemos y el que falta

- **[CORRE]** Reconciliación y explicación: se reciclan instancias muertas, se reabren sprints y se
  responde "por qué está atascado".
- **[PLAN]** Lo que falta y es la mejor idea que le robaría a DeepSeek: un vigilante **independiente**
  que juzgue **progreso** (¿avanza de verdad o da vueltas?) y no solo vida, y al que un humano pueda
  preguntarle en lenguaje natural por qué falló algo.

## 9. Qué hemos demostrado y qué no

- **[CORRE en el prototipo, pendiente de verificación]**: prototipo funcional con orquestador,
  programmers, revisores, reportes y cierre con evidencia. **Hoy no es citable: el prototipo no está
  commiteado.** Es la primera cosa a arreglar antes de presentar.
- **[PLAN]**: Sprint Board, Inspector de evidencia, plano de control, bandeja de decisiones, adaptación
  de Muse Code.
- **[HIPÓTESIS]**: el salto a decisiones de producto; que el orquestador no se convierta en el nuevo
  cuello de botella; que la métrica baje manteniendo calidad, tiempo y costo.
- Y una línea base que **no** es evidencia general: las 5 llamadas y 44,8 segundos del prototipo en un
  snake de un archivo. Sirve como referencia de ese caso, nada más. La comparación de verdad es Lunar
  Móvil, con tareas emparejadas y varias corridas.

## 10. Lo que falta y las preguntas abiertas

- Medir: la métrica sobre Lunar Móvil.
- Construir: Sprint Board, Inspector de evidencia.
- **Pregunta abierta que no quiero esconder**: si el plano de control mecánico crece, **quién audita sus
  reglas**. Hoy la respuesta es "el contrato versionado y el humano", y no basta.
- **Credenciales que el agente usa sin ver**: DeepSeek lo marca como problema abierto serio (si las
  claves entran al contexto, cualquier ejecución puede filtrarlas). Nosotros hoy las tenemos en un
  archivo legible. Hay que decirlo y planearlo.

---

## Cómo se usa este documento

1. **Redacción**: escribir la prosa encima, sección por sección, sin cambiar el contenido.
2. **Referencias**: antes de publicarlo, cada fila `[CORRE]` necesita ruta y commit (del repositorio del
   producto) y las del prototipo necesitan el prototipo commiteado.
3. **Revisión externa**: ChatGPT ya aceptó revisar la versión final verificando referencias, los
   denominadores de la métrica y que los pendientes no aparezcan como capacidades que corren.
