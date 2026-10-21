# FORMA: matrículas y área del alumno

## Entrega

El botón Matrículas abre la ficha única de la persona y sus cursos. Inscripción y cuotas forman un contrato; los adelantos y pagos parciales son recibos independientes. No se crea una agenda al crear un alumno ni al cobrar. Las fechas y el estado académico pueden corregirse con control de versión; los importes contratados no se reescriben desde esa edición.

El alumno usa su cuenta habitual de FORMA y el botón Mis cursos. Mantiene el presupuesto, metas, material educativo y cuentas personales. La nueva área institucional muestra sus matrículas, saldos, vencimientos, recibos imprimibles/guardables como PDF, clases vinculadas y mensajes. No consulta tablas de presupuesto ni conexiones bancarias personales.

Los avisos de pago enviados por el alumno no cuentan como ingreso. René verifica y registra el dinero recibido; la misma transacción actualiza el recibo, el saldo, el aviso y el mensaje interno. Hay confirmación expresa de recepción y reintentos con identificador estable. El pago completo no equivale a curso concluido.

## Activación pendiente del propietario

No se ejecutó SQL en producción. Según la preferencia del propietario, la actualización se prepara para ejecutar desde su cuenta: Gestión → Matrículas → Preparar activación → Copiar actualización → SQL Editor del proyecto `irsuevjqmgpwunvymxbc` → Run. Después actualizar la app.

`forma-education-upgrade.sql` es el instalador atómico completo sobre la agenda de servicios existente. `forma-education.sql` contiene la ampliación y las integraciones explícitas. Los scripts de construcción mantienen ambos instaladores reproducibles. No hay borrado, semilla ni importación automática de alumnos o pagos. La actualización conjunta finaliza con las consultas que integran los recibos nuevos.

René selecciona una persona, completa condiciones y pulsa Habilitar área del alumno. El correo debe pertenecer al alumno; el servidor solo vincula una cuenta verificada con esa invitación institucional. Una coincidencia editable de nombre, metadata o parámetro de URL no concede acceso. Una persona puede cursar varios cursos sin duplicar su ficha.

## Integridad y seguridad

Tablas privadas con RLS y sin permisos directos para anon/authenticated. RPC pública invoker, funciones privilegiadas privadas con search_path vacío y verificación de sesión independiente vigente. Staff: owner/manager; alumno: solo su ficha invitada y vinculada por el servidor. Se rechazan emisor ajeno, sesión revocada, acceso bloqueado, usuario sin correo verificado y consultas administrativas desde alumnos/instructores.

Una vista de lectura une recibos antiguos y nuevos sin copiarlos. Integra extracto, informes por período, categorías mensuales, cierres, asignaciones de caja y pendientes. El saldo por cobrar no se suma al dinero recibido. Los recibos anulados se conservan y salen de las sumas. No se realizan transferencias bancarias.

Los cobros antiguos se pueden vincular explícitamente: misma persona, contrato coincidente, sin ajustes incompatibles ni exceso sobre el contrato. No se vuelven a registrar; se evita cobrar el saldo simultáneamente desde Agenda y Matrículas. La vista de la reserva conserva el historial y deriva nuevos cobros a Matrículas. Los contratos, recibos y cierres anteriores permanecen guardados.

## Límites explícitos

- Registrar o avisar un pago no procesa PIX ni tarjetas. No se activaron gateway, QR de cobro, domiciliaciones ni webhooks de liquidación.
- Los avisos son dentro de la app, con actualización periódica mientras está abierta; no son notificaciones push, WhatsApp ni correo automático.
- El comprobante es un recibo del registro institucional, no una integración de factura fiscal.
- Las clases se vinculan a series existentes; no se reserva un horario implícitamente. La agenda conserva sus controles de disponibilidad.
- Cursos gratuitos y videos actuales conservan sus permisos; esta entrega no convierte una matrícula en suscripción ilimitada al catálogo.
- La renegociación de contratos y el reembolso de los recibos nuevos necesitan un flujo propio; no se deben simular anulando un ingreso real. La corrección de recibo es solo para errores de registro. Las devoluciones antiguas conservan su circuito existente.
- El instalador no vincula por suposición pagos anteriores ni convierte contactos desconocidos en alumnos.

## Validación

Pruebas locales de base de datos: reinstalación conserva reservas/contratos/pagos/historial y recibos nuevos; inscripción más cuatro cuotas; pagos parciales; años/meses con fin de mes; sumas de extracto, períodos, categorías y caja; avisos no cobrados hasta verificar; reintentos idempotentes; corrección auditada; vinculación de pagos antiguos sin doble deuda; aislamiento de alumnos, sesiones ajenas/revocadas y roles.

Pruebas UI: resumen del alumno, recibos, mensajes, aviso de pago, saldo sin confirmar, errores de red después de guardar, reintento estable y limpieza al salir o cambiar de cuenta. Se ejecuta la suite existente de agenda, CRM, finanzas, voz, presupuesto, bancos de prueba y PWA.
