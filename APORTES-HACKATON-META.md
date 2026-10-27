# Aportes para Auton — rumbo hackatón Meta

Fecha: 2026-10-27. Estado verificado del bueno (`auton cat jam zcode`,
`auton-grok-cat-jam` v0.2.0): snake completo en 44,8s, 5 llamadas al modelo,
`S01:done`, `prog-01:done/DONE`, cero `failed`, ~23k tokens. Prompt del
orquestador: 9.454 chars. Rotación: `beam-free` → `longcat-2.5-preview-free`.

## 1. Qué llevar a la hackatón (demo que se ve en 2 minutos)

1. **El número**: pedir un snake desde cero y cronometrar hasta el primer archivo
   en disco (~15s) y hasta tablero completo (~45-78s). Es la prueba visible de
   "la disciplina es el producto".
2. **El orden en pantalla**: fijó → partió → despachó → narró → esperó.
   Cinco tarjetas, cero exploración. Mostrar la traza `[set_goal,
   decompose_goal, dispatch_ready]` como evidencia, no como log.
3. **El tablero**: sprints con status + reloj en vivo. Es el fuerte #1 según la
   propia visión (§6). Si algo se muestra grande, es esto.

## 2. Ángulos de pitch (salen de AUTON-VISION.md, no inventados)

- "En los otros, el límite eres tú. En Auton, esa disciplina es el producto."
- Métrica comparativa: 259k → 23k tokens por corrida al quitar la exploración
  del orquestador (29 llamadas → 5). Menos es más cuando cada char viaja en
  cada llamada.
- Programmers que nunca mueren en silencio: `DONE / DONE_WITH_CONCERNS /
  NEEDS_CONTEXT / BLOCKED` con reporte sintetizado desde su auditoría.
  El peor caso es un `blocked` con motivo escrito, nunca un `failed` mudo.

## 3. Qué construir siguiente (ordenado por valor demo)

1. **Tester dedicado mínimo**: hoy la revisión existe como ciclo de sprints
   (spec-review, quality-review) pero el juez automático creíble (§10.7) es lo
   que separa "dice listo" de "está listo". Un `run_check` obligatorio antes de
   `close_goal` ya cuenta como v1.
2. **Grafo de evidencia**: cada sprint cerrado guarda *por qué cree que está
   terminado* (comando corrido + hash/archivo). Es el §6 "capa siguiente" y se
   demo-ea en 30 segundos.
3. **Wake real**: el loop no debe pedir "sigue". Hoy hay auto-wake parcial;
   Llevarlo a "cierra un sprint → despacha el siguiente sin turno del humano"
   es lo que hace creíble el caso Lunar Móvil (100 sprints).
4. **Presupuesto visible**: tokens y tiempo por sprint en el tablero. En una
   hackatón de Meta, costo por tarea es el slide que más preguntas genera.

## 4. Riesgos que declarar antes de que te los encuentren

- **Cuota del tier free**: `Go usage limit exceeded` en peticiones grandes;
  el fallback existe pero ya no cambia de modelo en silencio (avisa en el hilo).
- **Solo 2 modelos free usables por API** (`beam-free`, `longcat-2.5-free`);
  los otros 7 del catálogo dan 403 fuera del cliente oficial.
- **Un archivo = 1-2 sprints**: la regla de proporción evita inflar planes
  para impresionar; un jurado técnico lo nota al instante.

## 5. Caso de prueba único

Si Auton no puede llevar Lunar Móvil (100 sprints, humano solo en dirección),
el producto aún no es el producto (§10.11). Todo lo demás es secundario.
