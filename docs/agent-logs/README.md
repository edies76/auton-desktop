# Registro de agentes

Un archivo por agente, no por tarea: `terminal1.md`, `terminal2.md`, … en orden
secuencial estricto. El siguiente libre es `max(N existentes) + 1`.

## Reglas

1. **Solo escribes en el tuyo.** La autoría se prueba por memoria de esta
   conversación, no por el nombre en la cabecera: dos sesiones del mismo modelo son
   agentes distintos.
2. Si abres un `terminalN.md` y ves sesiones que no recuerdas haber escrito, no es
   tuyo: crea el siguiente número libre y trabaja ahí.
3. Cada entrada son 3–6 líneas: qué cambiaste y por qué. Sin código pegado, sin
   secretos.
4. Al responder al humano, cierra con una línea de firma:
   `— <agente> · terminalN · <tema>`.
5. El log no reemplaza al commit: el commit dice qué cambió; el log dice por qué y
   quién.

## Cabecera sugerida

```markdown
# terminalN — <agente/modelo>

Tema en curso: <una frase>
Inicio: <fecha>

## <fecha> — <cambio>
Qué: …
Por qué: …
Verificado con: …
```
