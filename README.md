# Auton Desktop

**Le hablas a un orquestador. Él dirige a los programadores.**

Auton es un escritorio para dirigir trabajo de ingeniería delegando de verdad: tú
defines el objetivo y apruebas la dirección, el orquestador descompone el trabajo,
despacha programadores en paralelo, verifica lo que entregan y te devuelve
evidencia, no promesas.

Es un fork de [ZCode](https://github.com/zai-org/ZCode) (Apache 2.0) con Auton
dentro: misma base, mismo motor de agente, otra relación con el usuario.

---

## Estado

Build de hackathon, **alpha privada**. Funciona de punta a punta en local y aún
tiene piezas en obra. La lista de abajo dice exactamente qué está probado y qué
no, para que nadie tenga que adivinarlo.

## Lo que ya funciona

- **Una sola conversación.** El chat es el orquestador. Los programadores no te
  hablan a ti: reportan a él.
- **Plan persistente.** El orquestador escribe el plan en `<proyecto>/.auton/plan.json`
  con objetivo, items, estado (`ready | running | waiting | blocked | done | dropped`),
  esfuerzo, archivos permitidos y evidencia. El plan sobrevive al cierre de la app.
- **Despacho en background.** Un programador arranca como `auton-worker`, corre
  en paralelo y el orquestador sigue disponible para ti mientras trabaja.
- **Política de esfuerzo por encargo.** `minimal | standard | thorough` viaja en la
  primera línea del brief y cambia el alcance real del worker.
- **Identidad y UI propias.** El worker se muestra como *Programador*, no como
  subagente genérico. El panel lateral *Programmers* lista cada uno con su estado
  y abre su sesión al clic.
- **Aislamiento de datos.** Auton vive en `~/.auton` (ajustes, credenciales,
  sesiones, índice de tareas) y usa su propio perfil de Electron (`Auton Dev`).
  Los proveedores se heredan una sola vez desde ZCode; el historial no.
- **Proveedores tal cual.** Lo que ya tengas configurado en ZCode sigue
  disponible: provider config, credenciales y selección de modelo.

## Lo que todavía no

- Reanudación automática de un programador tras cerrar la app: el plan sobrevive,
  el proceso del worker no.
- Auto-apertura del panel de programadores al despachar.
- Separación completa de la casa de CLI del agente (`~/.zcode/cli` todavía se usa
  para plugins y logs).
- Verificación independiente como etapa formal (hoy la hace el propio orquestador).

## Arquitectura en una vista

```text
        TÚ
         │  objetivo, restricciones, aprobación
         ▼
   ORQUESTADOR  ── plan.json (disco) ── superficies de la app
         │  brief corto + política de esfuerzo
         ▼
   PROGRAMADORES (auton-worker, sesiones aisladas, en background)
         │  reporte estructurado
         ▼
   EVIDENCIA → decide: PASS / retry / replan / escalar
```

Reglas que sostienen el diseño:

1. El orquestador es el único que habla con el humano.
2. El plan y los archivos son la fuente de verdad, no la memoria del modelo.
3. Un despacho no bloquea: el orquestador sigue disponible.
4. Sin evidencia no hay item cerrado.
5. El orquestador no termina el trabajo del programador; lo relanza o lo divide.

## Correr en local

Requisitos: Node 24, pnpm 10, Windows/macOS/Linux.

```bash
pnpm install
cd packages/desktop
pnpm dev:runtime      # usa el bundle de agente ya construido
# o, si cambiaste el paquete del agente:
pnpm dev:local-cli    # reconstruye, empaqueta y lanza
```

Los datos quedan en `~/.auton`. Para medir memoria con la app abierta:

```powershell
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" |
  Select-Object ProcessId, @{n='MB';e={[math]::Round($_.WorkingSetSize/1MB,1)}}
```

## Documentación

- [AUTON-VISION.md](AUTON-VISION.md) — la visión completa del producto.
- [docs/PLAN-MODO-AUTON.md](docs/PLAN-MODO-AUTON.md) — cómo se mapea la visión a código.
- [docs/AGENT-BRIEFING.md](docs/AGENT-BRIEFING.md) — protocolo para agentes que colaboran en el repo.
- [docs/INTERNO.md](docs/INTERNO.md) — estado real, decisiones y deuda (interno).
- [CHANGELOG.md](CHANGELOG.md) — qué cambió y cuándo.
- [docs/UPSTREAM-ZCODE.md](docs/UPSTREAM-ZCODE.md) — README original de ZCode.

## Licencia y atribución

Auton Desktop es un fork de ZCode, publicado bajo Apache 2.0. El código upstream
conserva su licencia y sus avisos; las partes nuevas de Auton siguen la misma
licencia salvo que un archivo diga otra cosa. Ver [LICENSE](LICENSE) y
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

---

## English summary

Auton Desktop is a fork of ZCode where you talk to **one orchestrator** that plans,
dispatches background programmers, verifies their work and shows evidence. The
plan lives on disk at `<project>/.auton/plan.json`; the app keeps its data in
`~/.auton`. It is a hackathon alpha: the list above is what works and what does
not.
