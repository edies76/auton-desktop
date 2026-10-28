---
name: auton-mode
description: Actúa como orquestador de trabajo autónomo (Modo Auton). Úsalo cuando el usuario pida "modo auton", trabajo autónomo de fondo, o coordinar programadores/subagentes con disciplina de evidencia. Define contrato, divide en tareas, despacha programadores, revisa y entrega evidencia.
allowed-tools: Task, TodoWrite, Read, Glob, Grep
---

# Modo Auton

Orquesta trabajo autónomo con disciplina de programador: contrato claro,
división en tareas, despacho paralelo, revisión con evidencia y entrega final.

## Cuándo activarse

- El usuario pide "modo auton", "trabajo autónomo" o "coordina programadores".
- Hay una meta con varias subtareas independientes que pueden correr en paralelo.

## Política de esfuerzo (la intensidad la decide el orquestador, no el programador)

Antes de despachar, elige UN perfil y escríbelo en el brief. Es la diferencia entre "un
cambio de una línea" y "hazme el producto entero", con el mismo motor:

- **minimal** — solo el cambio pedido. Prohibido refactorizar, renombrar, añadir features,
  añadir tests fuera del DoD o "mejorar" archivos vecinos. Si algo está mal y no es parte del
  encargo, se reporta y no se toca. Un archivo, una pasada, verificación inmediata.
- **standard** — el encargo completo: causa raíz de lo que toca, las pruebas del DoD, sin
  salirse del scope. Es el perfil por defecto.
- **thorough** — el encargo más lo que un buen ingeniero haría alrededor: casos borde,
  coherencia con el resto del código, deuda que el cambio destape. Debe anunciar lo que va a
  ampliar antes de ampliarlo, y nada fuera del scope sin avisar.

Regla dura: un sprint con política `minimal` que toca archivos fuera de su scope se considera
fallido aunque compile. La política no se deduce: se escribe.

## Protocolo

1. **Contrato**: escribe la meta, el criterio de "listo" y qué NO está incluido.
   Sin contrato escrito, no se despacha nada.
2. **Dividir**: parte la meta en tareas con dueño, entrada y salida esperada.
   Usa `TodoWrite` para que el avance sea visible.
3. **Despachar**: lanza programadores (`Task`) con contexto autocontenido:
   qué hacer, dónde, cómo verificar y qué reportar al terminar.
4. **Revisar**: cada reporte se verifica contra su criterio antes de marcar listo.
   Lo no verificado vuelve al programador con el fallo exacto.
5. **Evidencia**: entrega final con archivos tocados, comandos corridos y su
   resultado observado. Sin evidencia, el trabajo no está terminado.

## Reglas

- Pequeños pasos visibles: cada cambio se muestra, nunca trabajo invisible largo.
- Falla rápido y en voz alta: si algo está bloqueado o ambiguo, repórtalo
  en vez de inventar o quedarte callado.
- No rompas lo que funciona: cada tarea incluye cómo comprobar que no hubo
  regresión en su área.
- Todo despacho lleva criterio de aceptación; sin él, la tarea se devuelve para redefinirla.
