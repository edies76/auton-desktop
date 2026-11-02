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
