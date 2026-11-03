# Reporte final: límites versionados y canal rápido

> Documento privado. Cierra la etapa 1 del orquestador (puntos 2 y 3 del orden de construcción).
> Fecha: 2026-11-03. Rama de la pieza: `feat/edi/limites`.
> Esta página reúne qué se prometió, qué se construyó, cómo se comprobó y qué falta por ver en la app.

## Resumen en una línea

Los límites dejaron de ser texto y ahora **gobiernan el despacho con versión e historial**; el canal rápido dejó de ser un reporte final y ahora **es una conversación de ida y vuelta**, con el candado de respuesta en manos del orquestador.

---

# Parte 1 — Límites versionados

## Qué prometemos

Que la autonomía esté gobernada: el orquestador escribe las reglas antes de repartir, cada cambio queda con versión, motivo y quién lo aprobó, y cuando no sabe decidir deja el trabajo en espera con la pregunta exacta en vez de avanzar a ciegas.

## El problema que había

Los límites vivían solo en el prompt. Si cambiaban a mitad de camino, no quedaba registro; si el plan no tenía reglas escritas, nadie lo notaba; y el caso "no sé decidir" no tenía una salida de primera clase. El fallo silencioso no era incumplir un umbral: era que nadie miraba.

## Cómo funciona hoy

- El plan guarda los límites como datos: versión, intentos máximos, qué pide aprobación humana y qué hacer cuando no se puede decidir.
- Cada cambio sube la versión y agrega una entrada al historial con fecha, campo, valor anterior, valor nuevo, motivo y quién lo aprobó. El historial no se puede acortar ni reescribir.
- El plan cuenta los intentos: un despacho consume uno y el contador nunca baja. Al agotarse, la pieza deja de arrancar.
- Las aprobaciones que el orquestador marca en la pieza se respetan. Sin límites versionados el plan queda "sin versión" y el trabajo arranca igual: **las reglas las pone el orquestador**, no una guardia genérica.
- `not_evaluable` es un estado de primera clase: exige una pregunta (o la decisión escrita, si la regla es "default seguro") y escala al humano.
- Un programador puede **reportar** que un límite está mal calibrado; no puede cambiarlo. El intento se rechaza y su reporte se guarda.

## Las cuatro piezas

| Pieza | Dónde se cumple |
| --- | --- |
| Handler | El plan aplica límites, cuenta intentos, rechaza cambios sin registro y guarda reportes |
| Registro | La herramienta del plan declara los límites, el historial y los reportes en su descripción y en la forma de sus argumentos |
| Línea en el prompt | La doctrina del orquestador ordena leer los límites antes de despachar y registrar cada cambio |
| Prueba | Pruebas 8 y 9 de `PRUEBAS-QUE-PROMETEMOS.md`; suites `auton-limits-governance`, `auton-plan-tool`, `auton-limits-guard` |

## Evidencia automática

Corrida del 2026-11-03: **73 pruebas en 11 archivos, todas en verde** (incluye límites, canal, identidad y bucle). Typecheck de contratos y núcleo sin errores; lint sin avisos.

Casos cubiertos, en corto:

- guardar y leer límites con su historial;
- el historial sobrevive a una escritura que lo omite;
- un plan viejo se lee sin versión y sin inventarle reglas;
- sin versión se despacha y se cuenta el intento;
- la aprobación que escribió el orquestador se respeta;
- al agotar intentos, el despacho se rechaza;
- cambiar límites sin versión nueva o sin historial se rechaza;
- `not_evaluable` mudo se rechaza y con pregunta se acepta;
- un programador no puede tocar límites ni reportes.

## Lo que falta

- Límites de tiempo, costo, concurrencia y red: hoy solo intentos y aprobaciones.
- Las banderas de aprobación se aplican cuando la pieza las declara; no se infieren del comando o de la ruta.
- El reporte de calibración lo transcribe el orquestador desde el cierre del worker; no hay herramienta dedicada del worker para escribirlo.

---

# Parte 2 — Canal rápido

## Qué prometemos

Que los programadores hablen con el orquestador mientras trabajan y que el orquestador les responda, para que dirigir un equipo se sienta como una conversación y no como revisar bandejas.

## El problema que había

El worker solo hablaba al final, con su reporte de cierre. A mitad de encargo, si encontraba un dato nuevo, una duda o un bloqueo, no tenía forma de contarlo sin terminar; y el orquestador no podía corregir el rumbo sin esperar.

## Cómo funciona hoy

- **Worker → orquestador.** El programador publica en texto libre con `RespondToCoordinator`: avance, hallazgo, duda, bloqueo o respuesta. El mensaje entra con prioridad alta, despierta al orquestador y queda registrado en la sesión.
- **Orquestador → worker.** `SendMessage` entrega el mensaje como guía del turno que ya corre. No abre un turno nuevo ni reinicia al worker: se entrega en su siguiente punto de decisión, después de la tanda de herramientas en curso y antes de elegir la siguiente acción. Si el turno ya cerró, pasa a la cola; si el worker terminó, se le reanuda en segundo plano conservando la sesión.
- **El candado es del orquestador.** Cuando pregunta algo que ese frente no puede resolver solo, marca el mensaje como decisión requerida. El worker recibe un encabezado explícito y la orden de contestar antes de seguir, y la pieza queda marcada como esperando respuesta hasta que llega la respuesta.
- **Prioridad.** Mensaje del humano, después pregunta de un programador, después cierre o fallo, después latido. Tu mensaje nunca queda detrás de un formulario.
- **Pausa y adelanto.** Si la decisión es tuya, la pieza pasa a espera con la pregunta escrita y el orquestador sigue con otro frente.

## Las cuatro piezas

| Pieza | Dónde se cumple |
| --- | --- |
| Handler | Entrega de mensajes en los dos sentidos, candado de respuesta y relevo de la espera |
| Registro | Las dos herramientas están declaradas con nombre, descripción y argumentos, y el candado es un argumento explícito del mensaje |
| Línea en el prompt | La doctrina dice cuándo publicar, cuándo contestar y cuándo el orquestador pone el candado |
| Prueba | Prueba 4 de `PRUEBAS-QUE-PROMETEMOS.md`; suites `auton-answer-lock`, `auton-fast-channel-runtime` y la del hilo en la UI |

## Evidencia automática

- Entrega normal sin candado y entrega con encabezado de decisión requerida.
- El candado se marca, no se marca sin pedirlo, y se levanta una sola vez al responder.
- El canal de extremo a extremo sobre el runtime real.
- El hilo muestra los dos canales anidados y los eventos que despiertan al orquestador.
- La tarjeta del plan muestra la versión, el historial y el estado de espera.

## Lo que no garantiza

Que el modelo obedezca al pie de la letra. "Contesta antes de seguir" es una instrucción fuerte, no un bloqueo del runtime. Es deliberado: bloquear el turno hasta la respuesta cuesta autonomía y puede dejar un frente muerto si el modelo nunca contesta.

---

# La prueba real en la app (lo que falta por ver)

Los tests prueban las piezas; esto prueba el producto. Se corre a mano, con la app abierta y un proyecto pequeño.

## Preparación

- Un proyecto de prueba con su repositorio y algo de código real.
- Un encargo con dos frentes independientes y una decisión de producto escondida.
- Cronómetro a la vista: sirve para juzgar la crónica y los relojes.

## Lo que se le escribe al orquestador

```text
Quiero dos arreglos en este proyecto.

1) La lista de proyectos se ve vacía cuando no hay ninguno. Quiero un estado
   vacío con un botón para crear el primero.
2) Revisa por qué la sesión no se restaura al reabrir y dime la causa raíz
   antes de tocar nada.

Reglas: no cambies el esquema de la base de datos, no toques ajustes, y como
mucho un archivo de interfaz y uno de sesión por frente.

Reparte un programador por frente. Antes de repartir, escribe el plan y dime
en una línea qué va a cada uno. Si necesitas una decisión mía, pregúntame y
sigue con el otro frente. Cierra solo con el comando y la salida que lo
prueben. Si algo no se puede comprobar con una máquina, pregúntame en vez de
suponerlo.
```

## Qué tiene que pasar, en orden

| # | Qué haces | Qué tiene que verse | Qué prueba |
| --- | --- | --- | --- |
| 1 | Envías el encargo | Una línea del orquestador con el reparto, antes de tocar archivos | Narración previa y plan |
| 2 | Miras el hilo | Dos bloques de Programador, cada uno con su reloj corriendo | Canales anidados |
| 3 | Esperas el primer mensaje del worker | El worker cuenta qué encontró o qué necesita, sin haber cerrado | Canal en sentido worker → orquestador |
| 4 | Lees la respuesta | El orquestador contesta por el mismo canal o te pasa la decisión | Canal en sentido orquestador → worker |
| 5 | Cuando aparezca tu pregunta | La pieza queda en espera con la pregunta escrita y la otra sigue avanzando | Candado y pausa por frente |
| 6 | Respondes la pregunta | La pieza retoma sin reiniciar su trabajo | Relevo de la espera |
| 7 | Pides “¿cómo va?” | Te responde con el estado real del plan y de cada frente | Control del orquestador |
| 8 | Esperas el cierre | El item pasa a terminado solo con comando y salida; si no hay prueba, queda bloqueado con el motivo | Cierre con evidencia |
| 9 | Revisas el plan en pantalla | Versión de límites, historial y la pieza que esperó, con su pregunta | Límites visibles |

## Cómo se aprueba o se rechaza

- **Aprueba** si los nueve pasos se ven en una sola conversación, sin abrir pestañas ni cambiar de sesión.
- **Rechaza** si hay un tramo mudo de más de un minuto, si la pieza esperó sin pregunta visible, si un cierre apareció sin comando ni salida, o si tuviste que repetir contexto que ya estaba en el plan.
- **Anota** el resultado con fecha en este mismo documento. Lo que no se corre no se promete.

## Lo que sigue sin verificar hasta correrla

- El comportamiento real del modelo al recibir el encabezado de decisión requerida.
- La latencia entre el mensaje del worker y la reacción del orquestador con un modelo real.
- Que el navegador del worker y su espacio de trabajo se comporten como se espera: eso pertenece a la pieza siguiente, el programador como sesión completa.

---

## Dónde está cada cosa

- Límites: contrato y evaluación de límites, el handler del plan y su tarjeta en pantalla.
- Canal: las dos herramientas, el candado de respuesta y el bloque del programador en el hilo.
- Pruebas: suites `auton-*` del núcleo y las del hilo en la interfaz.
- Documentación de producto: “Límites y autonomía” y “Cómo trabaja”.
- Detalle técnico: “Límites: implementación” y “Canal rápido”.
