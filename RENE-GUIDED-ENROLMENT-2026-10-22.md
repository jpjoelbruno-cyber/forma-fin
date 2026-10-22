# FORMA Gestão: cursos, matrícula guiada y ficha compacta

Esta versión sustituye la matrícula larga por tres accesos: **Preparar cursos**, **Matricular alumno** y **Alumnos y pagos**. Los servicios y asesorías conservan su agenda independiente.

## Preparación independiente

El curso conserva su nombre, módulos y cantidad prevista de encuentros. Cada grupo conserva sus fechas, horarios, instructores, sala y cupos. Por ejemplo, un curso de ocho encuentros puede tener un grupo en noviembre y otro en diciembre sin reemplazar las fechas anteriores. La cantidad prevista se copia al crear el grupo: cambiar posteriormente la definición del curso no altera el progreso de grupos anteriores.

Las filas guardadas mantienen su identificador al corregir horarios. No se elimina silenciosamente un encuentro con asistencia confirmada ni se mueve al futuro una asistencia ya registrada. Los cambios se auditan y se comprueban conflictos de instructor y sala.

## Matrícula en cuatro pasos

1. Buscar curso o módulo y seleccionar un grupo disponible. La matrícula corresponde al curso completo del grupo elegido.
2. Buscar y reutilizar una persona, completar sus datos o preparar una nueva ficha.
3. Definir el acuerdo, vencimientos y abono realmente recibido.
4. Revisar el resumen, volver a corregir y confirmar.

Avanzar entre pasos no crea matrículas ni pagos. La confirmación conserva los identificadores de operación al reintentar, para evitar duplicados tras una respuesta perdida. El adelanto forma parte de lo recibido; no se suma dos veces. Los contratos anteriores vinculados se conservan.

## Ficha del alumno

Una vista compacta reúne el curso seleccionado, encuentros, asistencia confirmada, importe contratado, recibido, pendiente, próximos encuentros y comprobantes. Las correcciones y el historial completo siguen disponibles en una sección secundaria.

Los estados combinan texto, iconos y color: verde para asistencia y dinero recibido; violeta para pendientes; rojo para ausencia; gris para cancelado. El paso del tiempo no confirma asistencia automáticamente. Una cancelación no genera por sí sola un reembolso ni perdona una deuda.

La corrección de asistencia está restringida a dirección y gestión autorizada. El portal del alumno muestra sus estados sin conceder permisos administrativos.

## Activación de base de datos pendiente

La publicación web no ejecuta SQL de producción. La definición fija de encuentros y la asistencia requieren instalar la actualización aditiva en el proyecto exclusivo de FORMA: `irsuevjqmgpwunvymxbc`. No se debe ejecutar en Eleva Taller ni Eleva Modas.

En **Preparar cursos → Activar definición de cursos y asistencia**, dirección puede copiar el instalador generado `forma-education-upgrade.sql`. Ejecutarlo en el SQL Editor de FORMA y actualizar el aplicativo. La interfaz comprueba `course_templates: 1` y `attendance_version: 1` antes de habilitar estas funciones. Las bases anteriores conservan los flujos ya disponibles y muestran la activación pendiente.

No se ejecutaron modificaciones en datos reales como parte de esta publicación. El instalador no borra ni reinicia registros de René y se probó su repetición sobre datos sintéticos existentes.

## Validación

- Pruebas de base de datos aislada: permisos, cuotas, abonos, comprobantes, conflictos, asistencia, idempotencia y preservación al reinstalar.
- Pruebas de interfaz: cuatro pasos, correcciones, reutilización de personas, respuesta perdida, cierre de sesión y fichas compactas.
- Chromium con solicitudes interceptadas y datos sintéticos: PC, tablet y celular, sin errores JavaScript ni desbordamiento horizontal.
- Estas pruebas no sustituyen una prueba posterior con las cuentas autorizadas en producción tras activar el SQL. No se usaron registros reales ni credenciales de alumnos.
