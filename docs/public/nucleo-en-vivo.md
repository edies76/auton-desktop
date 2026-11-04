# El núcleo en vivo

Auton no responde por turnos cerrados: **narra mientras trabaja**. Mientras un
worker está en marcha, el orquestador sigue disponible, cuenta lo que hace
por debajo y puede abrir más trabajo sin cerrar la conversación.

## Qué ves en el hilo

Todo esto ocurre en **la misma conversación** donde hablas con el orquestador:
no hay una pantalla aparte ni un panel nuevo que aprender. Las filas se
intercalan con su narración y con el trabajo de los workers.

- **El canal del worker, en marcha**: su nombre, su estado y un reloj que
  avanza mientras trabaja. Si trabajan dos, ves dos filas, cada una con su reloj.
- **El loop**: el bloque de trabajo se abre con su contador mientras el worker
  corre y queda **cerrado por defecto**; las tools se ven solo si abres el
  detalle. La narración del orquestador y lo que te dice después quedan fuera del
  bloque. Si hay varias narraciones con trabajo entre ellas, ves **varios loops**
  intercalados, y **cada worker tiene su propio bloque**.
- **Puedes escribir siempre**: el turno del orquestador cierra en cuanto termina
  de hablar, aunque un worker siga trabajando. El loop se queda abierto con su
  contador y tú puedes mandar otro mensaje sin esperar ni inyectarlo.
- **Sin barra de acciones**: los mensajes Auton no llevan copiar, reaccionar ni
  fork debajo; la conversación se lee seguida.
- **El aviso del worker**: cuando un worker necesita algo del orquestador, su
  mensaje aparece como una fila más del trabajo. El orquestador decide si lo
  responde él o te lo pregunta; si la decisión es tuya, usa el bloque nativo de
  preguntas del chat.
- **El cierre**: cuando un canal termina, aparece una fila de trabajo con su
  estado final (`terminó`, `falló`, `detenido`), un resumen de lo que pasó, el
  tiempo total y la acción para abrir su conversación.
- **El latido**: si pasan noventa segundos sin noticias y hay trabajo vivo,
  aparece una fila de estado. Nunca te deja sin saber qué pasa.

## El turno no se cierra con trabajo vivo

Cuando el orquestador termina de escribir pero queda trabajo en curso, su turno
**no se da por cerrado**: espera a que el último canal termine. Si el turno se
cancela o pasa demasiado tiempo, se libera solo: nunca se queda colgado.

## El canal rápido

Los workers hablan con el orquestador **mientras trabajan**, y el
orquestador les responde sin cortarlos:

- lo que el worker publica llega al orquestador como **mensaje del worker**,
  no como si lo hubieras escrito tú;
- lo que el orquestador le manda al worker entra en su siguiente paso, sin
  reiniciar el encargo.

## Deshacer

Puedes pedir que se deshaga el trabajo de un worker: por worker, por
item del plan o por archivos concretos. Los archivos vuelven **exactamente** como
estaban, los que se crearon desde cero desaparecen, y un archivo que cambió
después **no se pisa**: se reporta como conflicto. Repetir la orden no hace nada y
todo queda anotado en el registro del proyecto.

## Qué no promete

- No promete que el trabajo esté bien: para eso está la evidencia y el cierre con
  pruebas.
- No promete magia con archivos binarios: si un archivo no se puede restaurar con
  exactitud, lo dice en vez de arriesgarse.
