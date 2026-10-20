# Ventas: mover tarjetas y confirmar matrícula

## Cambios

El controlador existente `forma-crm.js` conserva el tablero y las fichas existentes. Las tarjetas se pueden arrastrar en PC o mover con un botón accesible en PC, tablet y celular. Los destinos principales son Nuevos, En atención, Seguimiento, Preparar matrícula y Matriculados. Cerrados permanece accesible mediante filtro y botón con contador; no se convierte ningún cierre anterior en una matrícula.

Cada tarjeta sigue siendo un interés vinculado a una persona. Una persona con varios intereses o cursos conserva una sola ficha. Mover no crea personas, reservas, contratos ni pagos. Las tarjetas conservan fuente, notas y próximas acciones. El tablero solo muestra el nuevo destino después de recibir confirmación del servidor.

Matriculados abre una confirmación con el curso ya cargado, fecha inicial opcional y condición de pago (definir después, presencial o acuerdo existente). Se guarda un registro inicial de matrícula, único por interés. La condición es una intención declarada, nunca una confirmación de cobro. Los horarios y cobros se gestionan en Agenda y Finanzas. El portal del alumno, las cuotas automáticas y el proceso formal de congelamiento/cancelación de matrícula no se activan con esta entrega.

Una matrícula ya confirmada se conserva al mover su seguimiento comercial a otra etapa; ese movimiento no la cancela ni anula pagos. Para otro curso se crea otro interés en la misma ficha. El curso de una matrícula confirmada no se puede reemplazar mediante la edición del interés. Volver a Matriculados reutiliza la matrícula anterior.

## Guardado y permisos

La función canónica del CRM añade la acción `interest_move` con idempotencia por solicitud y comprobación de versión. Cada movimiento guarda fecha, actor y etapa anterior/nueva en la auditoría privada. El historial paginado se consulta desde el cuadro de movimiento.

Una respuesta perdida conserva la misma solicitud para reintentar; el formulario queda protegido contra cambios y contra cierre accidental hasta confirmar. Un conflicto de versión exige actualizar y no mueve la tarjeta. Se descartan respuestas tardías y se limpian datos privados al cerrar sesión. No se guardan contactos en almacenamiento local.

La tabla privada `crm_enrolments` tiene RLS y ningún permiso directo para anon/authenticated. Solo la RPC del CRM puede consultarla o escribirla tras verificar el rol owner/manager mediante la sesión del proyecto independiente. El wrapper público sigue siendo SECURITY INVOKER y el controlador privado usa search_path vacío. Profesores, alumnos, anónimos, sesiones revocadas y emisores de otras aplicaciones se rechazan.

## Actualización sin reemplazar datos

`forma-crm.sql` actualiza la implementación existente directamente. Amplía la restricción de etapas para admitir Matriculados, añade una tabla de matrículas y reemplaza la función del CRM. No borra filas ni transforma etapas históricas. El instalador general contiene esta misma implementación una vez; no añade un segundo CRM ni funciones que sobrescriban otra versión al final. La presentación cambia en la hoja única `forma-gestao.css`.

El conector denegó acceso a irsuevjqmgpwunvymxbc. No se ejecutó SQL en producción y no se tocó ningún proyecto de Eleva. La publicación del frontend es independiente de la activación de esta actualización de base de datos.

Si el CRM anterior está activo, los movimientos entre sus etapas siguen funcionando mediante la acción existente `interest_save`, con versión y solicitud idempotente. La confirmación de matrícula y el historial detallado requieren la actualización de CRM; hasta entonces Matriculados muestra — y un aviso, sin afirmar que existe una matrícula. Si falta el CRM completo, se conserva el aviso de activación y no se simula un guardado.

En la sesión del propietario: Ventas → Activar confirmación de matrículas → Copiar actualización → Abrir base de FORMA → pegar en SQL Editor → Run. Se copia únicamente `forma-crm.sql`. También se puede usar el instalador general desde Configurar FORMA, que incluye los informes mensuales anteriores. Después, actualizar la app. No hay que volver a registrar contactos.

WhatsApp y TikTok siguen sin API conectada. Esta entrega no envía mensajes ni sincroniza contactos externos.

## Pruebas locales

- 155 pruebas unitarias existentes aprobadas.
- PGlite: actualización repetida desde la restricción anterior con comparación exacta de personas, intereses, solicitudes, auditoría, vínculos, reservas, pagos, contratos e historial existentes.
- Movimiento con conservación de campos, matrícula única por interés, reintento idempotente, conflicto de versiones, rechazo de matrícula sin confirmación y de sustitución de curso, historial con actor y etapas, varias oportunidades para una persona, sin alteraciones financieras.
- Rechazo de alumno/profesor/anónimo, emisor ajeno, acceso revocado y lectura directa de tablas privadas.
- Regresión completa del CRM y del instalador general con datos sintéticos.
- DOM: arrastre en PC, menú en celular, confirmación de matrícula, cierre conservado, incertidumbre de red y mismo request_id, conflicto, compatibilidad, escape de texto y limpieza privada.
- Regresión de fichas, tablero, estilos canónicos y resumen mensual.

Estas son pruebas locales con datos sintéticos; no son una auditoría de las matrículas reales ni una activación verificada en Supabase.
