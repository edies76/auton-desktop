# Prueba 2 — Muse Code salida legible de a poco

Fecha: 2026-11-03 (re-corrida). Rama: `feat/b/muse-code`.

## Flags disponibles (`muse exec --help`)

- `--json`: emite eventos JSONL legibles por máquina en stdout.
- `--prompt-file PATH`, `--session-id UUID`, `--max-model-steps N`,
  `--max-tool-output-bytes N`, `--workspace PATH`, `--json`.

## Comando exacto

```
$ cd /tmp/opencode/muse-probe-01
$ timeout 180 muse exec --json "Escribe 5 líneas numeradas, una por una, en pasos.txt" > stream-out.jsonl

EXIT=0
$ wc -l stream-out.jsonl
318
$ cat pasos.txt
1. Primera línea
2. Segunda línea
3. Tercera línea
4. Cuarta línea
5. Quinta línea
```

Los 318 eventos JSONL llegan durante la ejecución (`sequence` 28→38+,
`payload_type`: `task.lifecycle.*`, `tool.result`, `task.stream.linked`),
no solo al final.

## Veredicto

**PASA** — la salida se lee por tramos con `--json`. Sirve para el canal
rápido bidireccional (eventos de progreso en vivo).

## Nota

La primera intentona con `| head -40` mató el pipe (SIGPIPE) y el archivo no
se creó; re-corrido completo a archivo sí cumple. El adaptador debe consumir
el stream sin cerrar el pipe antes de tiempo.
