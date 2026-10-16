# Agenda e ingresos educativos de FORMÁ — 16 de octubre de 2026

Esta actualización pertenece exclusivamente a `jpjoelbruno-cyber/forma-fin` y al proyecto Supabase `irsuevjqmgpwunvymxbc` (FORMA Personal Independiente). No instalar en Eleva Taller, Eleva Moda ni en el antiguo proyecto compartido.

## Publicación y activación son pasos diferentes

El frontend es compatible con la agenda anterior. Las áreas adicionales, el catálogo flexible, la edición de horario sin motivo obligatorio y los ingresos requieren `calendar_version = 4`. Hasta entonces, la interfaz explica la limitación y no registra pagos. La conexión Supabase disponible para el agente no tiene permiso sobre este proyecto. El propietario ejecutó el script desde su SQL Editor el 16 de octubre y las capturas confirmaron la existencia de `forma_agenda_register` y `forma_agenda_income`. El guardado con la cuenta real de René sigue pendiente de verificación directa.

## Activar en la base existente

1. Verificar proyecto exacto `irsuevjqmgpwunvymxbc` y disponer de respaldo según la política del proyecto.
2. Ejecutar `agenda-services-upgrade.sql` en el SQL Editor con privilegios de propietario. Requiere `agenda-setup.sql` ya instalado; sustituye a `agenda-calendar-upgrade.sql`. No ejecutar la actualización anterior después de esta porque volvería a anunciar versión 2.
3. La migración valida la identidad del propietario de FORMA y aborta si no coincide. No cambia usuarios, roles, membresías, presupuestos personales ni datos de otros aplicativos. Conserva reservas y registro de cambios. Amplía los slots existentes sin borrar las reservas. Los contratos/pagos usan tablas privadas nuevas con RLS y sin permisos directos para clientes.
4. Verificar con la sesión de René o del propietario: `forma_agenda_access` devuelve `calendar_version: 4`; abrir Agenda → Ingresos. `forma_agenda_catalog` solo es accesible al gestor y al propietario.
5. Validar entre dos dispositivos con la misma cuenta, usando una reserva de prueba identificada, y después cancelarla conservando auditoría. No considerar estas pruebas locales una validación de sincronización en producción.

## Ruta operativa

`https://forma-fin.vercel.app/agenda.html`

La ruta con `?vista=ejemplo` es una simulación efímera: NO utilizar para datos reales. El acceso de ejemplo se retiró de la puerta de entrada de la agenda. Al abrir la agenda sin sesión, el botón de acceso recuerda en la pestaña que debe regresar a ella; René también se dirige a la agenda al entrar desde el inicio. La autorización sigue verificándose en servidor. El enlace «Presupuesto personal» permite regresar voluntariamente al área personal.

## Uso sencillo

- Actividad: qué atención se realiza. Área: sobre qué tema. Grupo o turma es opcional y permite agrupar ingresos por un curso o cohorte específicos. En versión 4, «+ Agregar área» permite nuevas especialidades sin cambiar código; las áreas guardadas se vuelven a ofrecer en el catálogo.
- Un encuentro confirmado muestra RESERVADO. Las series muestran INICIO, ENCUENTRO N/T y FINALIZA, para cualquier actividad. Si falta confirmar, aparece una etiqueta adicional POR CONFIRMAR sin ocultar el inicio o fin de una serie. No se confirma automáticamente el estado de registros antiguos.
- Todos los bloques comparten el fondo claro de FORMÁ. Solo las invitaciones de podcast o el área Podcast/Eleva Podcast usan naranja. El sello SVG oficial no se modifica.
- El formulario principal contiene los datos esenciales. Contacto, estado y otros instructores quedan en opciones adicionales.
- Los encuentros siguen siendo semanales, lunes a sábado de 13:00 a 18:00. Editar horario o cancelar sigue afectando a toda la serie; la edición individual de una fecha no está incluida en esta entrega. La corrección de asistencia por fecha se mantiene en Mi día.
- Tras guardar, la agenda abre la fecha inicial de la reserva y limpia filtros que podrían ocultarla. Un error al refrescar no vacía las reservas visibles; se avisa que pueden estar desactualizadas.

## Pagos e informes

1. En Nueva reserva, usar el bloque visible «Pago de esta reserva»: definir después, no pagó, pagará presencialmente, adelanto, pagó todo o gratuito. Indicar el valor total y, si se recibió dinero, medio, importe y fecha. El saldo se muestra antes de guardar.
2. En versión 4, la reserva, el valor y el pago inicial se guardan en una sola transacción mediante `forma_agenda_register`. Si falla un componente, se revierte todo. El UUID de registro evita duplicar tanto la reserva como el primer pago al reintentar. Un registro sin respuesta confirmada mantiene los datos y permite únicamente reintentar el mismo contenido hasta obtener confirmación. Cero representa una atención gratuita; sin definir no equivale a cero.
3. Para completar un pago después, abrir la reserva → «Ver pagos y saldo». Registrar cada importe realmente recibido, fecha y medio: Pix, efectivo, tarjeta, transferencia o Bitcoin (importe registrado en reales). Bitcoin se anota por su valor recibido en R$; no se convierte ni se transfiere criptomoneda. Un acuerdo de pago presencial o para una fecha futura no se suma a los ingresos recibidos. No se solicitan credenciales, números de tarjeta ni cuentas bancarias. Es un registro manual: no procesa un cobro ni hace conciliación bancaria.
4. El saldo se calcula con todos los pagos vigentes de esa reserva. No se permite sobrepago ni reducir el total por debajo de lo recibido. Se usa entero en centavos y bloqueo transaccional compartido con la agenda.
5. Un UUID de pago se conserva en reintentos; una respuesta incierta mantiene los campos y solo permite reintentar el mismo pago antes de crear otro. El servidor impide duplicar el identificador y rechaza reutilizarlo con otro contenido. Si se cierra o recarga el navegador durante una respuesta incierta, consultar el historial del servidor antes de registrar otro pago.
6. «Corregir error» anula un registro con motivo; no lo elimina ni realiza una devolución bancaria. Registrar el pago correcto por separado después de verificar el saldo.
7. Ingresos muestra recibido en el mes por fecha de recepción, cantidad de pagos, reservas con inicio en el mes, saldo pendiente de todos los meses y categorías por actividad, área, grupo/turma y medio. Adelantos se cuentan una sola vez; los pagos de otros meses no se suman al mes elegido.
8. Actividad y área se congelan en cada pago al registrarlo para que editar una reserva no cambie silenciosamente informes anteriores. Tarjeta se registra por valor bruto; no calcula comisiones, cuotas ni fecha de liquidación.
9. Anular un error recalcula el mes original del pago. Esto es corrección de registro, no contabilidad de devoluciones, facturación fiscal ni cierre contable.
10. Cancelar una reserva no borra pagos ni extingue automáticamente su saldo pendiente. Se identifica la cancelación. Solo propietario y gestor ven ingresos; alumnos e instructores no tienen acceso.
11. Los informes calculan todas las filas. Los listados muestran hasta 200 reservas/pagos y 500 pagos por reserva, con aviso visible cuando el listado está limitado. Usar Semana para localizar otra reserva. No se incluye exportación ni paginación completa en esta entrega.

## Validación disponible

- 139 pruebas unitarias/regresión del proyecto.
- Pruebas de DOM de agenda, calendario, asistente y cobros: guardado fallido conserva formulario; roles; escape de texto; simulación sin escrituras remotas; saldo parcial; corrección; reintento con el mismo ID tras cerrar y abrir el diálogo.
- Pruebas SQL en PostgreSQL local descartable (PGlite), incluidos permisos, sesión de otro emisor, revocación, preservación al reinstalar con datos, independencia de instructores, pagos parciales y entre meses, duplicados, sobrepagos, cancelación y totales sobre más de 200 recibos.
- No se ha realizado una prueba con credenciales de René en la base alojada ni una prueba en teléfono físico. La sincronización y restauración de registros anteriores siguen pendientes de verificación en producción. No se han eliminado registros reales desde esta actualización.

## Corrección de fecha prevista — 16 de octubre de 2026

La opción presencial permite «El día de la atención», «Otra fecha acordada» y «Sin fecha definida». Elegir el día de atención copia su fecha mientras se completa el formulario. El resumen de Ingresos y el detalle del pago muestran la fecha pactada, identificando cuando coincide con el día de atención.

Es compatible con la base versión 4 ya instalada; no requiere volver a ejecutar SQL ni modifica filas existentes. Para conservar una fecha concreta en el servidor actual, el cobro se envía como `status=pendiente`, `payment_plan=fecha`, con `due_on`. La elección presencial y el modo de fecha se conservan además en el JSON privado de la solicitud y la auditoría (`presentation_status`, `payment_location`, `date_mode`). Sin fecha definida, el plan conserva `presencial` con fecha nula.

La fecha futura es una promesa de pago: no crea un recibo de dinero ni aumenta lo recibido. La fecha real del cobro sigue sin admitir pagos recibidos en el futuro. Se verificó contra las funciones originales v4, sin modificar el SQL del servidor.

Las fechas ya guardadas se conservan; cambiar posteriormente la fecha de atención no reescribe automáticamente el acuerdo de pago. La edición de acuerdos de pago existentes y la opción de moverlos al reprogramar requieren un flujo posterior específico; no se recrean reservas para cambiar esos datos.
