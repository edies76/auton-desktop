# terminal7 — A (DeepSeek V4.1 Flash)

Tema en curso: poda de documentación upstream de ZCode sin tocar el producto ni el trabajo de A.
Inicio: 2026-11-03

## 2026-11-03 — primera poda segura de docs

Qué: se borraron 227 documentos de `docs/` que son del upstream de ZCode y no sostienen Auton:
automatizaciones, bots, plugins/marketplace, coding plan/facturación, remoto/móvil, feedback,
marketing, whiteboard y planes/auditorías antiguas. Se conservaron `context/`, `docs/private`,
`docs/public`, `docs/agent-logs`, los docs de UI, chat, escritorio, arquitectura, git, pruebas,
proveedores y motor.
Por qué: es la parte de la poda que no exige abrir la app ni cambia runtime; reduce ruido y deja
el mapa de `docs/` alineado con lo que Auton sí usa.
Verificado con: `git diff --cached --check` limpio; 0 referencias a archivos borrados desde los
archivos que quedan; `git status` confirma que solo se tocó `docs/` (más este log).
Pendiente: la poda de UI y módulos (ocultar tienda, automatizaciones, facturación y remoto) queda
para cuando el entorno tenga Node 24 + pnpm y la app abra, como manda `context/PODA-DE-ZCODE.md`.
