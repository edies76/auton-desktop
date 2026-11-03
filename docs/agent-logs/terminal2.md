# terminal2 — límites versionados + "no sé decidir"

- Contrato: `limits` y `limitHistory` en el plan; versión vigente + historial con fecha, campo, anterior, nuevo, motivo y quién aprobó.
- Handler: lectura normaliza planes viejos; `write` conserva el historial si se omite.
- Prompt: doctrina de límites en `auton.ts` y bloque "Cuando no sabes decidir" en `orchestrator.ts`; item a `waiting` con pregunta en `questions`.
- UI: la tarjeta muestra versión, reglas vigentes e historial; planes viejos salen "sin versión".
- Tests: round-trip de límites, preservación del historial y lectura legacy; 6/6 en verde con typecheck y lint limpios.
