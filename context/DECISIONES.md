# Decisiones y propuestas del orquestador

> Registro corto de decisiones para no volver a discutirlas. Cada una: qué se decide, por qué, y qué
> la haría cambiar.

## D1. El MVP no se demuestra con Lunar Móvil

**Se decide**: la prueba de fuego deja de ser Lunar Móvil. El MVP se demuestra con **una tarea pequeña
y controlada, en un repositorio propio y commiteado**, elegida para que se vea **la arquitectura nueva
del orquestador**, no el tamaño del trabajo.

**Por qué**: Lunar Móvil es un port a Android nativo. Medirlo exige tareas emparejadas y varias
corridas, o sea semanas. Y lo que hay que vender es *lo nuevo*: que el orquestador narra, gobierna,
verifica y pregunta. Eso se ve en una tarea de veinte minutos igual de bien que en un port.

**Qué se muestra en esa tarea** (y cada punto es una capacidad nueva):
1. La narración por sprints, sin huecos: qué propone, a quién manda, qué espera, qué cerró.
2. Los tres relojes: por worker, por sprint y total.
3. Un worker que pregunta a mitad de sprint y el orquestador que responde.
4. **El humano escribe mientras la pregunta está abierta** y la pregunta se reformula o se retira sola.
5. Un cierre con evidencia: el artefacto que prueba el criterio de hecho, en pantalla.
6. La métrica: intervenciones humanas por entrega verificada, con la cifra visible.

**Qué la cambiaría**: que tengamos tiempo y ganas de hacer las dos, y que el jurado pida el caso grande.
Lunar queda como *segundo* caso, no como el único.

## D2. Muse Code entra como motor de los programadores, no como cerebro

**Qué reemplaza**: el motor que **escribe el código** en los workers. Nada más. **No** reemplaza al
orquestador (que sigue pensando con el modelo que le pongamos), **no** reemplaza la interfaz, **no**
reemplaza el motor de edición de ZCode para el trabajo interno.

**Por qué no es difícil**: la forma del trabajo ya existe. En el prototipo hay **tres adaptadores**
intercambiables para el mismo rol —CLI de Grok, OpenCode y el de casa— y el sistema elige uno u otro sin
cambiar nada arriba. Muse Code entra como **un cuarto adaptador**: recibe el encargo escrito, trabaja en
su carpeta, y **cierra con el reporte de estado** que el orquestador ya sabe leer.

**Qué es lo incierto, y hay que verificar antes de prometer**:
1. Si Muse Code se puede lanzar de forma no interactiva con un encargo y una carpeta (lo que en el CLI
   de Grok son `--prompt-file` y `--cwd`).
2. Si su salida se puede leer de a poco (para el canal rápido) o solo al final.
3. Si respeta la carpeta de trabajo que se le indica, sin tocar fuera.
4. Qué necesita para autenticarse y si eso permite dejarlo corriendo solo.

**Orden**: verificar esas cuatro cosas con una prueba mínima, escribir el adaptador, y **enseñar el
reporte**. Si alguna de las cuatro falla, se dice y se busca la forma; lo que no se hace es presentar
"Muse Code dentro" sin haberlo corrido.

**Qué significa para Auton**: que Auton **dirige herramientas de Meta** en vez de competir con ellas. Es
el argumento de la rúbrica (usar herramientas de IA de Meta) y es coherente con la tesis: Auton no es un
motor, es **el ingeniero que manda motores**.

## D3. Prioridad absoluta a lo nuevo e innovador

**Se decide**: todo lo que sea nuevo de verdad se prioriza por encima de lo cómodo, y **se documenta con
referencia citable** (ruta, commit y prueba). El orden queda:

1. **Política de esfuerzo escrita en el encargo** de cada worker (regula la intensidad; hoy solo es
   recomendación).
2. **Límites escritos y versionados**: cuándo escala al humano, y el caso **"no sé decidir → pregunto"**.
   Esto es lo más nuevo que tenemos.
3. **Canal rápido orquestador ↔ worker** con reporte de estado.
4. **Bucle vivo** y narración por sprints.
5. **Tres relojes**.
6. **Preguntas con opciones** y el caso "el humano escribe mientras pregunto".
7. **El programador como sesión completa**, con navegador propio para probar.
8. **Muse Code** como motor (D2).
9. **Tablero e inspector de evidencia**.

## D4. Nada se presenta sin referencia citable

**Se decide**: antes de publicar el artículo o el video, **cada capacidad que se afirme se respalda con
ruta y commit**. El prototipo **se commitea** o sus capacidades quedan marcadas como no verificadas.

**Por qué**: es la regla que nos puso el revisor externo y es la que evita el clásico "lo hicimos y
funciona" que un jurado técnico desmonta en una pregunta.

## D5. El orquestador no termina respuestas: feedback constante y canales dentro del hilo

**Se decide**: el orquestador deja de usar el modelo de dos canales de ZCode (una respuesta final y un
loop de ejecución que se cierra al terminar). Su loop es **variable**: puede hablar, lanzar trabajo,
recibir reportes y volver a hablar sin cerrar el turno. Los programadores corren en canales que se
abren **en medio de una respuesta** y siguen vivos aunque el humano escriba.

**Por qué**: al delegar, el humano pierde la presencia de ingeniero. Si el orquestador se queda
"ocupado" y solo habla al final, el usuario no sabe qué se está haciendo, ni cuándo intervenir, ni qué
pasó por debajo. El feedback constante es lo que devuelve esa presencia, y es el argumento del
producto: no solo hace el trabajo, lo cuenta mientras lo hace.

**Cómo se concreta**: ver [CONTRATO-DE-NOTIFICACIONES.md](./CONTRATO-DE-NOTIFICACIONES.md). Cuatro
salidas (narración, pregunta, evidencia, alerta), cadencia mínima, prioridad de eventos y dos
superficies separadas (hilo y panel de canales).

**Qué la cambiaría**: que el costo de mantener el orquestador a la escucha rompa la latencia del chat;
en ese caso se degrada primero el latido de estado, nunca la narración de despacho y cierre.

## D6. Un orquestador por proyecto, y navegación de dos pantallas

**Se decide** (Edi): **no hay un chat universal**. Cada **proyecto** tiene **su** orquestador y **su**
conversación. Y la navegación es de dos pantallas:

1. **Lista de proyectos** — los proyectos ordenados. Es la pantalla donde se elige en cuál trabajar.
2. **Espacio del proyecto** — la conversación con el orquestador de ESE proyecto, y dentro, los canales de
   trabajo anidados. **Aquí NO existe el panel lateral de ZCode** con su lista de proyectos y tareas.

Para entrar a un proyecto: se sale del actual (**"atrás"**) y se elige otro. Todo lo de ese proyecto —
su plan, sus workers, su evidencia, su gasto — vive ahí y no se mezcla con los demás.

**Al crear un proyecto, el usuario pone dos cosas obligatorias**: el **nombre** y la **ruta** de la carpeta.
Sin eso no se abre: es lo que evita que un proyecto herede cosas de otro.

**Por qué**: con un chat único, el humano no sabe de qué proyecto le están hablando y los planes se
mezclan. Con un orquestador por proyecto, cada conversación tiene su contrato, su tablero y su flota, y el
humano siempre sabe dónde está.

**Qué implica**, y hay que tenerlo claro:
- **Es interfaz nueva**, la primera de verdad. Pero **no diseño nuevo**: se reutilizan los componentes,
  los tokens y la tipografía de ZCode. Lo que se construye son **dos pantallas delgadas** (lista y
  espacio) más las superficies anidadas (plan, trabajo, evidencia).
- **El panel lateral NO se apaga: se transforma.** Deja de ser la lista de proyectos y tareas de
  ZCode y pasa a ser **la lista de workers** de ese proyecto (clicables, en vivo, con control de parada y
  sin campo de texto). Ver `context/UI-ESPACIO-DEL-PROYECTO.md`. *(Corregido: la primera versión de esta
  decisión decía "se apaga", y era la idea anterior.)*
- **Lo que se gana**: el usuario nunca está perdido, y el chat **es** el espacio de trabajo.

**Lo que la cambiaría**: que un proyecto necesite varias conversaciones a la vez (por ejemplo una por
frente grande). Si eso pasa, se añade una segunda conversación **dentro** del proyecto, no un chat global.
