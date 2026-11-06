# Prueba 1 — Muse Code arranque sin interacción

Fecha: 2026-11-03 (re-corrida con CLI instalado). Rama: `feat/b/muse-code`.

## Entorno

```
$ muse --version
Muse Code 1.4.14 (1.4.14-R7309.1)
EXIT=0

$ which muse
/home/jeanpixis/.local/bin/muse
```

## Comando exacto

```
$ mkdir -p /tmp/opencode/muse-probe-01 && cd /tmp/opencode/muse-probe-01
$ timeout 120 muse exec "Crea el archivo hola.txt con el texto hola"

muse: workspace root: /tmp/opencode/muse-probe-01 (cwd default)
muse: Agent delegation: auto unavailable: workspace is untrusted.
Listo, creé [hola.txt](/tmp/opencode/muse-probe-01/hola.txt) con el texto "hola".
EXIT=0

$ ls -la /tmp/opencode/muse-probe-01
hola.txt (4 bytes: "hola")
```

## Veredicto

**PASA** — arranca headless con encargo + carpeta (cwd como workspace por defecto).

## Observación para el adaptador

El CLI avisa `workspace is untrusted` y desactiva `Agent delegation: auto`.
El encargo simple igual se cumple; queda por ver si la falta de confianza
limita herramientas en encargos complejos (ver prueba 3). Flag útil visto en
`muse exec --help`: `--prompt-file`, `--workspace PATH`, `--session-id`,
`--json`, `--max-model-steps`.
