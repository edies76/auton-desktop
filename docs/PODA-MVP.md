# Poda para el MVP

Plan para quitar de Auton Desktop todo lo que no sostiene la demo y sí añade
superficie, riesgo y RAM. El criterio es uno: **¿esto ayuda a que una persona
dirija trabajo y vea evidencia?** Si no, fuera.

Tres niveles de poda, del más barato al más caro:

- **Ocultar**: quitar la entrada de la UI. Reversible en un minuto.
- **Apagar**: dejar el código y apagar el valor por defecto. Reversible con un flag.
- **Borrar**: eliminar el paquete o la ruta. Solo cuando nada la use.

## Inventario

| Superficie | Qué cuesta | Nivel | Nota |
| --- | --- | --- | --- |
| **New remote connection** | Onboarding entero, protocolo, estados de conexión, UI condicional | Ocultar → borrar | Nadie del jurado va a conectar un host remoto. Fuera de la nav y del arranque |
| **Web remote control** | Relay, device id, ajustes, servidor propio | Apagar | Deja de anunciarse y de abrir conexiones |
| **Remote project entries** | Tablas, diálogos, estados offline | Ocultar | Ya no hay entrada para añadir remotos |
| **Source servers / connection profiles** | Ajustes avanzados | Ocultar | Solo aparece si vienes de ZCode |
| **Conversation share / web-share** | Paquete entero, rutas públicas, permisos | Borrar (hecho) | Compartir un chat no es el producto; paquete `web-share` retirado |
| **Automations** | Vistas, cron, ejecuciones, tabla propia | Ocultar → apagar | Ya fuera de la navegación; el motor sigue dormido |
| **Off-peak tasks** | Programación diferida | Apagar | Nadie programa trabajo a las 3 AM en una demo |
| **Plugin marketplace** | Catálogo, permisos, actualizaciones, caché | Ocultar → apagar | Ya fuera de la navegación; la caché sigue en disco |
| **Rewards / marketing touch** | Llamadas de red al arrancar, UI | Apagar | Ruido y latencia en cada boot |
| **Android / iOS emulator plugins** | Plugins MCP, toolchains, imágenes | Apagar | Pesado y ajeno al producto |
| **Computer use (CUA)** | Helper nativo, permisos, panel | Apagar | Arrastra `node-repl-host` (~150 MB) |
| **Office (pdf, docx, xlsx, pptx)** | 4 hosts MCP | Apagar | Ya apagado por defecto |
| **Dynamic workflow** | Motor completo, runs, actores, vistas | Ocultar | Potente y complejo; no es el MVP |
| **Memory** | Servicio, indexado, ajustes | Apagar | El plan en disco ya es la memoria útil |
| **Telemetry / ARMS** | Subida de eventos | Apagar | Nada que medir en una demo |
| **Bots** | Diálogo, estados, config | Ocultar | Superficie muerta en Auton |

## Fases

### Fase 1 — Ocultar (una tarde)

1. Quitar de la navegación y del arranque: remote connection, source servers,
   bots, automations, marketplace, rewards.
2. Dejar el código detrás de un flag único `AUTON_MVP=1` cuando la superficie sea
   difícil de desenganchar.

Riesgo: bajo. Todo sigue compilando; simplemente no se ve.

### Fase 2 — Apagar por defecto (un día)

1. `computer-use`, `android-emulator`, `ios-simulator`, `browser-use` (si el
   navegador embebido no se usa) y los cuatro de ofimática: `defaultEnabled: false`.
2. Desactivar el relay de web remote control y la telemetría.
3. Quitar off-peak y los cron de arranque.

Riesgo: medio. Hay que probar que el chat, los programadores y el plan siguen
funcionando sin esos hosts.

### Fase 3 — Borrar (cuando haya tiempo)

Solo lo que la Fase 1 y 2 dejaron sin uso: paquetes de share, rewards, remote,
emuladores. Cada borrado va con su commit y su prueba de que la app arranca.

## Lo que NO se toca

- Motor del agente, tools base, sesiones, proveedores, git, panel lateral,
  terminal, navegador embebido si se usa en la demo.
- El plan, los programadores y el Scorecard: son el producto.

## Cómo se mide que la poda sirvió

- Procesos al arrancar: bajar de 9 a 5 o menos.
- RAM de la app: objetivo < 900 MB en desarrollo, < 600 MB empaquetada.
- Tiempo de arranque en frío: objetivo < 6 s.

## Estado 2026-11-03 — primera mitad de la poda media

Aplicado en la rama `chore/poda/zcode`, detrás de `packages/ui/src/lib/autonMvp.ts`
(`AUTON_MVP = true`). Todo el código queda para restaurarlo con un cambio de una línea.

- Navegación: fuera Automations y Plugin Marketplace del sidebar.
- Ajustes: fuera Remote devices, Memory, Usage/billing y Computer use.
- Cuenta: fuera el resumen de plan/usage y el acceso a Rewards del menú de perfil.
- Remoto: apagadas las entradas de conexión remota y el web remote control.
- Marketing/rewards: los providers dejan de montarse, así que no hay llamadas al arrancar.
- Compartir conversación: se oculta el botón de share en la cabecera.
- Automations y Plugin Store: sus rutas ya no se abren aunque otro punto de la UI
  emita la intención.
- Pruebas ajustadas a la UI podada; `pnpm typecheck` completo en verde.

Pendiente para la segunda mitad: apagar defaults de módulos pesados, telemetría y
off-peak; borrar los módulos que queden sin uso cuando la app abra y el chat funcione.

## Estado 2026-11-03 — segunda mitad de la poda media

- Se integró `auton-desktop` (`7815c2a3`, con el chat único/vivo de Edi) en la rama de poda.
- Se borró el módulo de Rewards de la UI: `RewardsProvider`, `RewardsWebview`, su prueba
  unitaria, su E2E, el doc `docs/rewards-embedded.md` y las referencias de arranque.
- Off-peak queda apagado por defecto en el scheduler; cron y el resto del motor siguen
  vivos. Para recuperarlo: `AUTON_OFF_PEAK=1`.
- Telemetría: sin `config/private/build-defaults.json`, los endpoints de ARMS y reporte
  ya quedan vacíos y no se envían eventos. No se tocó el código de diagnóstico local.
- Los defaults pesados ya estaban apagados en el código: emuladores Android/iOS, CUA y
  los cuatro plugins de ofimática. No se volvieron a tocar.
- Verificado con `pnpm typecheck` y las pruebas de scheduler, marketing y credenciales E2E.

No se borró nada del motor de edición, sesiones, proveedores ni del trabajo de A. La app
sigue sin abrir por el error de versión `0.0`, así que no se borraron rutas de UI que
dependan de una verificación visual.
