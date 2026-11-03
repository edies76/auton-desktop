# Preguntas frecuentes

## ¿Auton reemplaza al programador?

No. Reemplaza la parte de **supervisión** que hoy haces tú cuando trabajas con agentes: repartir, comprobar, reintentar y recordar restricciones. El criterio de producto sigue siendo tuyo.

## ¿Auton escribe el código?

El orquestador dirige; los programadores escriben. El orquestador no toca el producto. Esa separación es deliberada: quien dirige no debería ser también el único que se autoevalúa.

## ¿Puedo usar mi motor de programación habitual?

Sí. Auton se diseña como una capa por encima de motores existentes. Lo que se garantiza es el contrato: el mismo encargo, el mismo reporte de estado y la misma exigencia de evidencia, venga de donde venga el código.

## ¿Qué pasa si el modelo dice que terminó y no es cierto?

No se cierra. Una declaración no es evidencia. La pieza pasa por una revisión que comprueba el criterio de hecho y deja constancia de lo que falta.

## ¿Qué pasa si Auton no sabe si algo está bien?

Pregunta. Existe un estado explícito para eso: cuando el sistema no puede evaluar una decisión, la deja en espera con la pregunta concreta y la escala a ti. No elige por inercia.

## ¿Puedo hablar con los programadores?

Hablas con el orquestador. Él habla con los programadores mientras trabajan: les pasa datos, les corrige el rumbo, les pide evidencia o los detiene. Cuando una decisión es tuya, el orquestador te la trae con la pregunta concreta y deja esa pieza esperando mientras adelanta otra.

## ¿Puedo detener una pieza?

Sí. Puedes pedirlo en lenguaje natural al orquestador. La pieza se detiene con su motivo visible y el resto del trabajo continúa.

## ¿Puedo deshacer un cambio?

Sí. El trabajo se puede revertir por pieza, por elemento o por rutas concretas, dejando rastro de la restauración.

## ¿Dónde se guarda el plan?

Junto al proyecto, en una carpeta propia de Auton. Si quieres que la historia viaje con el repositorio, puedes versionarla.

## ¿Auton funciona sin conexión?

Los motores de programación necesitan su proveedor de modelo. Auton en sí no añade un servicio propio: dirige los motores que ya tienes configurados.

## ¿Puedo revisar por qué se tomó una decisión?

Sí. El plan conserva su historia: qué cambió, cuándo, con qué motivo y quién lo aprobó. La evidencia de cada cierre queda vinculada al criterio que la exigía.

## ¿Qué documentos son públicos?

Esta sección, pensada para que cualquiera entienda el producto y confíe en él. El equipo mantiene además una documentación técnica interna con el detalle de implementación, que no se publica aquí.
