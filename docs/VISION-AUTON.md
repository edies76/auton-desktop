# AUTON — Visión completa

---

# El centro

> En los otros, el límite eres tú: tu disciplina para planear, verificar y reintentar.
>
> En Auton, esa disciplina es el producto.
>
> Tú apruebas la dirección. El sistema ejecuta el oficio.

Esto no es un eslogan al lado. Es el producto. Todo lo demás —orquestador, programmer, tester, board, brief, wake, skills, evidencia— existe para que esa frase sea verdad.

Si Auton no te quita de encima el oficio de planear, verificar y reintentar, es un chat más.
Si te lo quita, y el trabajo sale con prueba, es Auton.

---

## 1. Qué es

**Un jefe de obra con IA.**

Tú le hablas a un solo cerebro (el orquestador). Ese cerebro parte tu idea en sprints, le pasa un brief corto a un programador, manda a un tester a comprobar que de verdad funciona, y solo avanza si hay evidencia. Si falla, reintenta. Si se traba tres veces, te escala a ti.

| | |
|--|--|
| **Qué vende** | Disciplina de uso de IA. No un modelo más grande. |
| **Dónde vive** | Tu terminal, tu máquina, tu repo. |
| **Con quién hablas** | Un solo cerebro. El orquestador. |
| **Qué haces tú** | Apruebas la dirección. |
| **Qué hace el sistema** | El oficio: planear, codear, verificar, reintentar. |

Frase de ingeniería (el *cómo*):

> Mejorar el valor y la calidad del código generado por IA
> convirtiendo a la IA en un **perfecto usuario de IA**.

El modelo puede ser el de siempre. Lo que cambia es que la IA usa a otra IA con método.

Frase de producto (el *por qué*, el centro):

> En los otros, el límite eres tú.
> En Auton, esa disciplina es el producto.

---

## 2. Por qué existe — el caso que lo prueba

Hay un tipo de tarea para la que Auton nació. No es un demo. Es esto:

**Lunar Móvil.** Pasar `chatbot-standalone` (Lunar, web) a una app Android nativa en Kotlin. Paridad de lo que un usuario hace en el navegador: chat con streaming, microchats, espacios, árbol, mapa de estudio, anclas, biblioteca, memoria, cuenta, pagos. 100 unidades de trabajo (P-001 … P-100). Repo nuevo. Backend y web intocables.

Eso es una tarea de semanas. Un founder no puede sentarse a pegar el siguiente prompt, leer el dump, decir “sigue”, pegar el error, pedir tests, volver a pegar. No le puede dedicar el ojo.

En Cursor, Claude Code, ZCode, el límite es exactamente ese ojo. Tú eres el harness:

```
pegar P-001 → esperar → revisar → pegar P-002 → “sigue” → pegar el error → otra vez
```

Por eso se llegó a fabricar un paquete de 100 prompts: para simular a mano lo que Auton debería hacer solo. El pack ya está en forma de Auton (`mobile-kotlin/auton/`): goal, 100 sprints, briefs, skills Android, recetas de evidencia.

Eso es el producto en una foto:

- Tú apruebas: *haz Lunar Móvil, estas son las reglas, no toques la web.*
- El sistema ejecuta el oficio. Sprint a sprint. Brief corto. Tester. Evidencia. Wake. Sin que tú pegues el siguiente.

Si Auton no puede cargar un caso así, no es Auton. Es un chat con disfraz de orquestador.

**Auton es diferente a la competencia porque la competencia te deja el oficio. Auton es el oficio.**

---

## 3. Los tres oficios

```
Humano  →  Orquestador (cerebro)  →  Programmer (manos)
                                   →  Tester (juez)
```

| ID | Oficio | Nombre | Qué hace |
|----|--------|--------|----------|
| 01 | BRAIN | Orchestrator | Piensa, parte la idea en sprints, habla contigo, despierta el loop, decide retry / avanzar / escalarte |
| 02 | HANDS | Programmer | Escribe archivos reales. Recibe un brief corto, no el chat entero. Trabaja en background. Puede haber varios, peers, cada uno con su scope |
| 03 | JUDGE | Tester | Busca fallos de verdad. Build, tests, visual. Pass / fail. Reporta al orquestador, nunca al usuario en crudo |

Cinta:

**PLAN · BUILD · VERIFY · LOOP · EVIDENCE**

El programmer recibe un **brief**, no un dump:

- qué tiene que hacer
- en qué carpetas puede tocar (`scope`)
- lista de “hecho” (DoD)
- reglas del proyecto
- quiénes son sus hermanos y qué están haciendo

Tú no pegas el brief. El orquestador lo arma. Eso es “la disciplina es el producto”.

---

## 4. El loop (la disciplina, mecanizada)

```
idea
  → plan en sprints (reloj + objetivos + todos)
  → [tú apruebas la dirección]
  → brief corto al programmer
  → code (background; tú sigues hablando con el orquestador)
  → tester
  → evidencia
      ✓ pasa     → commit → siguiente sprint
      ✗ falla    → retry con el error (máx 3)
      ✗ 3 fails  → te escala a ti
```

Sin prueba no hay “done”. Un mensaje del modelo diciendo “listo” no cuenta.

Mientras el programmer trabaja, el chat no se muere. Sigues con el orquestador. Puedes pedir estado, redirigir, cancelar. El ruido línea-por-línea se filtra. Tú ves oficio, no telemetría.

UX: charlas las bases, te cruzas de brazos (o piensas la siguiente feature) y el loop corre. Autonomía de sistema: el input sobrevive el crash.

Eso es el centro, en movimiento:

**Tú apruebas la dirección. El sistema ejecuta el oficio.**

---

## 5. La diferencia (el centro, contra el mercado)

En Cursor o Claude Code **tú** eres el orquestador: pides, revisas, dices “sigue”, vuelves a pedir tests, vuelves a pegar el error.

Auton mete esa disciplina en el sistema.

| | Auton | Claude Code / Cursor / ZCode | OpenCode | Lovable / Bolt / v0 |
|---|---|---|---|---|
| Con quién hablas | Solo el orquestador | El coder directo | El coder directo | Un generador visual |
| Quién planea | El orquestador, sprints con reloj y DoD | Tú, o un plan suelto | Tú / plan del agente | Casi no hay sprints |
| Quién escribe | Programmer (motor aparte, background) | El mismo chat | El mismo chat | El generador |
| Quién verifica | Tester dedicado | Tú, o el modelo diciendo “listo” | Tú | Preview |
| Cómo sabe que terminó | Evidencia + DoD | El mensaje del modelo | Igual | “Se ve bien” |
| Si falla | Retry con el error, máx 3, luego tú | Tú pegas el error | Tú | Regeneras |
| Mientras trabaja | Sigues con el orquestador | El chat está ocupado | Similar | Esperas el preview |
| El límite | El sistema (si el loop es real) | **Tú** y tu disciplina | **Tú** | El generador |
| Para quién | Founder que no puede pegar 100 prompts | Dev que ya dirige al agente | Power-user | Quien no quiere terminal |

Frente a cada uno:

- **Claude Code / Cursor / ZCode** — manos excelentes. Auton es el senior que las dirige, les pone DoD y no las cree hasta que el tester pasa. Ellos te dejan el oficio. Auton es el oficio.
- **OpenCode** — host del CLI actual. Ya es enorme. Auton le pone board en vivo, skills, supervisor durable, auto-wake y tester aparte.
- **Lovable / Bolt / v0** — apps en el browser para quien no instala nada. Auton vive en tu repo, para trabajo pesado de verdad.
- **“Multi-agente” genérico** — chats parloteando. Auton son tres oficios fijos: cerebro, manos, juez.
- **autond** — misma tesis, Python + web. Referencia. El producto de hoy es el CLI `auton`.

La diferencia que sí importa, otra vez, porque es el centro:

> En los otros, el límite eres tú: tu disciplina para planear, verificar y reintentar.
>
> En Auton, esa disciplina es el producto.
>
> Tú apruebas la dirección. El sistema ejecuta el oficio.

---

## 6. El foso

OpenCode y Claude Code ya orquestan. El foso de Auton no es “más agentes”. Es que el oficio vive en el sistema:

1. **Sprint Board** — reloj + objetivos + todos que se tachan en vivo. El fuerte #1.
2. **Skill bank** — playbooks first-class. Oficio empaquetado.
3. **Supervisor durable** — veredictos en disco. Reinicias y el juicio sigue.
4. **Auto-wake** — el loop no te pide “sigue”.
5. **Tester dedicado** — y visual de verdad cuando madure.
6. **Live recap + sesiones aisladas + git post-PASS.**

Capa siguiente, cuando el loop 1× sea de verdad fiable:

- el sprint carga **prueba**, no un “done”
- el DoD es ejecutable
- grafo de evidencia: *¿por qué Auton cree que esto está terminado?*
- leases de scope + worktrees
- presupuesto de calidad
- laboratorio de fallos reproducible
- índice de confianza del proyecto
- política de riesgo
- contrato de goal + decision lock
- ledger de aprendizajes

Ninguna de esas features es “otro agente”. Todas empujan el centro: que la disciplina no dependa de tu ojo.

Multi-programmer viene **después** del loop 1×. El orquestador parte por scope de archivos. Cada run: brief corto + skills + recap de hermanos.

---

## 7. Principios no negociables

1. **Causa raíz, no parches.**
2. **El orquestador es el ingeniero.**
3. **El usuario habla solo con el orquestador.** El ruido se filtra.
4. **Validar antes de avanzar.** Sin DoD no hay sprint cerrado.
5. **CLI primero.**
6. **Mejor protocolo > más tokens.**
7. **Brief, no dump.**
8. **Seguridad liviana.** Reglas para lo obvio. El modelo solo en la ambigüedad.
9. **El humano aprueba dirección. La IA ejecuta con disciplina.** (el centro, otra vez)
10. **Si el humano tiene que ser el harness, Auton falló.**
11. **Descomposición por pensamiento largo.** Según el propósito del goal, el orquestador piensa en cadena larga (arquitectura, dependencias, riesgos) y parte el trabajo en MUCHAS tareas pequeñas y verificables. El error de los agentes actuales es encoger el problema: 3 sub-tareas genéricas. Auton hace lo contrario — cuanto más grande el goal, más grande el plan. Nunca menos de 8 sprints para un producto.
12. **Profesionalidad por comparación.** Antes de decidir cómo hacer algo, comparar con cómo lo resuelven los productos maduros de código abierto (ZCode, Grok Build, OpenCode) y adoptar la mejor práctica. Los informes externos (p. ej. de Manus) son insumo de mejora del plan. Este hábito le ahorra al humano junior los errores que otros ya pagaron.

---

## 8. Memoria (cuatro capas)

| Capa | Qué es | Dónde |
|------|--------|--------|
| L1 ventana | tokens del turno | purpose frame, wake, tool results |
| L2 sesión | disco por chat | board, supervisor, notas |
| L3 proyecto | decisiones / arquitectura | `remember`, continuity en el brief |
| L4 skills | playbooks | skill bank |

El producto mejora por uso. No se convierte en un volcado de chat.

---

## 9. Auton en el mundo del creador

Auton es un **medio**. La meta es empresa de IA. Todo lo táctico puede cambiar si no sirve a esa meta.

Dolor de origen: vibe coding a medias. La IA no es autónoma de verdad. El humano termina siendo el harness. Lunar Móvil es ese dolor en concreto: 100 sprints y un ojo que no da.

Ideal: equipo de dev comprimido en la terminal. Un founder técnico que aprueba dirección y se cruza de brazos.

Un sistema de días no destronará a Claude Code ni a Cursor en share. Sí puede ganar en protocolo, si el mismo intent sale visiblemente mejor **sin que tú hayas sido el loop**.

Dos carpetas:

- **`auton`** — TypeScript, fork de OpenCode, CLI. Producto actual. Privado. Rama `dev`.
- **`autond`** — Python + Next. Predecesor. Referencia.

El motor del programmer es pieza reemplazable. La tesis no.

La tesis es el centro.

---

## 10. Norte de producto

1. Calidad de proyectos generados > demos de chat.
2. Sistema de ingeniería alrededor de modelos existentes.
3. Loop que se autocorrige.
4. **Tú apruebas la dirección. El sistema ejecuta el oficio.**
5. Sprint Board es el fuerte #1.
6. Público: founders / vibe técnicos que no pueden pegar 100 prompts.
7. Tester creíble de verdad.
8. CLI-first.
9. Dogfood diario. Lunar Móvil es el dogfood pesado.
10. Primero el loop 1×. Después la flota.
11. El caso de prueba: si Auton no puede llevar Lunar Móvil con el humano en dirección y no en oficio, el producto aún no es el producto.

---

## 11. Cómo se siente

Abres la terminal en el repo.

Dices: *quiero Lunar Móvil. Kotlin. Paridad con la web. No toques el backend. Estas son las reglas.*

El orquestador no se pone a codear. Te devuelve sprints. DoD de cada uno. Pregunta si apruebas.

Dices: *dale.*

Sprint 1 arranca. El programmer está en background. En el panel ves oficio. Tú puedes irte a otra cosa, o hablarle al orquestador: *el composer va abajo, como Claude.* Él anota. No te suelta un dump.

El tester corre. Verde. Commit. Sprint 2. Wake. Sin que escribas “sigue”.

Tú ya estás pensando la siguiente empresa. El sistema está en el oficio.

Eso es Auton.

No un chat más listo.
Un oficio.

Porque:

> En los otros, el límite eres tú: tu disciplina para planear, verificar y reintentar.
>
> En Auton, esa disciplina es el producto.
>
> Tú apruebas la dirección. El sistema ejecuta el oficio.

---

*Este archivo es la tesis. Vive en el escritorio a propósito.*
*El centro se escribe tres veces porque es una sola idea.*
