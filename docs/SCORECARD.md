# Auton Scorecard — el goal con creces

Especificación de la feature que convierte el "ya está listo" en un veredicto con
evidencia. Documento de diseño; todavía no implementado.

## 1. El problema

Hoy el orquestador cierra trabajo con una frase. El usuario tiene que creerle o
abrir los archivos. Esa es la misma falla que Auton dice resolver: el juicio
sobre la calidad se queda del lado del humano, que es exactamente el trabajo que
queríamos delegar.

Un **Goal** dice a dónde vamos. El **Scorecard** dice qué tan lejos llegamos, con
qué pruebas, qué falta y qué no sabemos. Es el goal con creces: el mismo objeto
de dirección, más el juicio sobre su cumplimiento.

## 2. Qué es

Un artefacto que el orquestador produce sobre su propio trabajo, con cinco cosas:

1. **Veredicto**: `pass` · `partial` · `fail` · `blocked`.
2. **Notas por dimensión**, cada una de 0 a 100, con la evidencia que la sostiene.
3. **Lo hecho**: por item, la afirmación y la prueba (comando, archivo, URL).
4. **Lo que falta**: por item, el hueco concreto y por qué no se cerró.
5. **Lo que no sabe**: preguntas abiertas y qué items bloquean.

Además: **próxima acción** (`dispatch` · `review` · `ask_human` · `stop`) y una
**autocrítica** de dos párrafos que el usuario pueda leer sin abrir nada.

No es una barra de progreso. Es un juicio con consecuencias: un veredicto
`partial` impide que el plan se marque cerrado.

## 3. Las cinco dimensiones

| Dimensión | Qué mide | Cómo se gana |
| --- | --- | --- |
| **Alcance** | Cuánto del contrato está cubierto | Items `done` sobre items comprometidos |
| **Evidencia** | Qué tan comprobado está lo hecho | Cada item con al menos una prueba reproducible |
| **Calidad** | Si lo entregado resiste una segunda mirada | Verificación del orquestador: build, tests, lectura del código real |
| **Riesgo** | Qué puede romperse o quedó frágil | Cambios fuera de alcance, deuda, dependencias nuevas |
| **Claridad** | Si un extraño entiende el estado | Huecos y decisiones explicados sin jerga |

Una nota sin evidencia se castiga: si el orquestador no puede citar el comando o
el archivo, la dimensión baja. Es la regla anti-inflación.

## 4. Cuándo entra en acción

Cuatro disparadores, con peso distinto:

| Momento | Qué produce | Coste |
| --- | --- | --- |
| **Al cerrar un item** | Una línea: veredicto del item + prueba | Mínimo |
| **Al cerrar el sprint** (todos los items en `done`, `blocked` o `dropped`) | Scorecard completo | Medio |
| **Al fallar dos veces el mismo item** | Re-evaluación forzada antes de reintentar | Bajo |
| **A pedido** ("¿cómo va?", o el botón del panel) | Scorecard completo del estado actual | Medio |
| **Al reanudar una sesión** | Scorecard marcado como `stale` si el plan cambió | Mínimo |

El disparador de fallo es el más valioso: evita el bucle de reintentos ciegos que
hoy depende de que el modelo se dé cuenta.

## 5. Dónde vive

### Datos

Dentro de `plan.json`, para que plan y juicio no se desincronicen:

```json
{
  "version": 1,
  "goal": { "...": "..." },
  "items": [{ "id": "s1", "status": "done", "...": "..." }],
  "assessment": {
    "generatedAt": "2026-11-01T20:00:00Z",
    "verdict": "partial",
    "confidence": 0.72,
    "scores": { "scope": 80, "evidence": 60, "quality": 75, "risk": 40, "clarity": 85 },
    "done": [{ "itemId": "s1", "claim": "...", "evidence": [{ "kind": "test", "label": "..." }] }],
    "missing": [{ "itemId": "s2", "gap": "...", "why": "..." }],
    "unknowns": [{ "question": "...", "blocks": ["s3"] }],
    "nextAction": "dispatch",
    "selfCritique": "Dos párrafos..."
  }
}
```

`assessment` es opcional y se reemplaza entero en cada evaluación. Un plan sin
`assessment` se considera **sin juzgar**: la UI lo muestra en gris.

### Tool

Se suma a `AutonPlan` como `action: "assess"`, con el mismo archivo y la misma
escritura atómica. Una sola tool para plan y juicio evita dos fuentes de verdad;
la tarjeta distinta se resuelve por `input.action`.

### UI

| Superficie | Qué muestra |
| --- | --- |
| Tarjeta del plan en el chat | Fila de veredicto + las cinco notas en miniaturas |
| Panel lateral **Estado** (nuevo tab) | El cuadro completo: veredicto, notas, hecho, falta, desconocido, próxima acción |
| Mensaje del orquestador al cerrar | Tres líneas: veredicto, los dos huecos más caros, qué sigue |

El cuadro es el mismo componente en los tres sitios, en tres tamaños.

## 6. Reglas de conducta

- El veredicto se escribe **antes** de decir "terminado". Sin veredicto no hay
  cierre.
- Toda afirmación de `done` lleva evidencia citable; sin cita, el item vuelve a
  `running` o baja a `partial`.
- `pass` exige: todos los items `done`, evidencia en cada uno y ninguna pregunta
  abierta que bloquee.
- `blocked` y `fail` son respuestas válidas y no se castigan: se premia el
  diagnóstico honesto.
- La autocrítica es explícita: qué haría distinto, qué asumió y no comprobó.
- El orquestador no se pone notas altas para cerrar antes; el usuario ve las
  notas y la evidencia en la misma pantalla.

## 7. Por qué importa para el hackathon

- Convierte la credibilidad en **interfaz**: el jurado ve el veredicto, no una
  promesa.
- Es la métrica del producto: tasa de éxito verificado, intervención humana y
  calidad de evidencia salen de este objeto.
- Diferencia a Auton de un chat con subagentes: el sistema opina sobre su propio
  trabajo y lo sostiene con pruebas.

## 8. Separación de otros agentes (parte del mismo cambio)

Vocabulario único y excluyente en la superficie: **Orquestador** y **Programadores**.
Nada de "subagente", "agente", "actor" ni "coordinador" visible al usuario. Las
tarjetas, paneles y mensajes del plan hablan de trabajo, no de la maquinaria.

Pendiente de auditar: textos de la UI que aún dicen *SubAgent*, *Agent* o
*Coordinator*; vistas heredadas de workflow que no corresponden al producto.

## 9. Orden de implementación

1. Contrato (`assessment` en `auton-plan.ts`) + acción `assess` en el handler.
2. Reglas en la doctrina del orquestador (los cinco disparadores).
3. Tarjeta compacta en el chat.
4. Panel **Estado** con el cuadro completo.
5. Mensaje de cierre del orquestador con el resumen de tres líneas.
6. Métricas derivadas para la demo.
