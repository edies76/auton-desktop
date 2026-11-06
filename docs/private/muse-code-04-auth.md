# Prueba 4 — Muse Code autenticación y modo solo

Fecha: 2026-11-03 (re-corrida). Rama: `feat/b/muse-code`.

## Auth observada (sin exponer valores)

- `env`: sin `META_API_KEY` ni `MUSE` definidos en esta sesión.
- `~/.config/muse/auth.json`: existe (login por dispositivo previo del humano).
- Headless sin TTY:

```
$ timeout 60 muse exec "Di solo OK" < /dev/null

muse: workspace root: /tmp/opencode/muse-probe-01 (cwd default)
muse: Agent delegation: auto unavailable: workspace is untrusted.
OK
EXIT=0
```

## Veredicto

**PASA** — corre solo con la sesión guardada, sin TTY ni key en env.

## Consolidado go / no-go del adaptador

| Prueba | Resultado |
|---|---|
| 1 arranque headless | PASA (1.4.14, exit 0, `hola.txt`) |
| 2 streaming | PASA (`--json`, 318 eventos en vivo) |
| 3 carpeta | PASA (confinado a `work/`, señuelo intacto) |
| 4 auth | PASA (sesión guardada, sin TTY) |

**Decisión: GO para escribir el adaptador** (etapa 3, Compañero B). Matices:
`workspace untrusted` desactiva `Agent delegation: auto` — el adaptador debe
correr en workspace confiado o documentar la limitación. `META_API_KEY` en
env queda como alternativa CI sin probar (sin key a mano).
