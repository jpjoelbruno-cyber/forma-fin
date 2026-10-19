# FORMA — actualización de trabajo del 19 de octubre de 2026

## Referencia aprobada

Cabecera compacta fija FORMA Educacional / Mi día / Mi semana / Ventas / Finanzas / lupa / campana / cuenta. El título grande pertenece al contenido y se desplaza. En tablet y celular se conservan las herramientas y una segunda fila fija para las pestañas. Se conserva el sello SVG actual.

Finanzas combina la caja operativa elegida y los análisis del tercer modelo: cuatro tarjetas, períodos Día/Semana/Mes/Año, barras y pizza, evolución observada y resumen por curso y medio de pago. Las imágenes previas contenían importes ilustrativos: ningún importe fue convertido en dato del sistema.

## Comportamiento del código

- Conserva reservas, cobros, devoluciones, historial y presupuesto personal. No importa ni elimina usuarios de otros proyectos.
- Mueve las pestañas originales a la cabecera; conserva sus eventos y permisos. Instructores mantienen su calendario y cuenta, sin herramientas globales.
- Cuatro tarjetas: saldo inicial, cobrado bruto, salida realizada, saldo calculado. Sin cuentas, fechas cubiertas y asignaciones completas, el saldo total es desconocido, nunca cero inventado.
- Diferencia de entradas/salidas y reembolsos visible; período actual parcial, futuro vacío. Comparación anual con el mismo intervalo transcurrido del año anterior cuando existe el servidor de informes.
- Cuentas institucionales con saldo inicial declarado por dirección, asignación de cobros y salidas existentes, tarjeta con crédito/débito, comisión y liquidación. No duplica pagos. Las asignaciones tienen control de versión y auditoría.
- Transferencias entre cuentas propias no cambian ingresos/gastos; conciliación registra saldo observado y calculado sin inventar ajustes.
- Cuentas por pagar: previsión separada del dinero realizado; confirmación de pago crea un gasto y su asignación en una sola transacción. Cancelar una previsión conserva el historial. No realiza pagos bancarios.
- Cierres mensuales guardados por revisión e inmutables, exportación CSV; requieren el servidor de informes. No bloquean correcciones posteriores del libro.
- Personas y Ventas: una persona puede tener varios intereses. Conserva las cinco etapas, incorpora temperatura declarada, fecha/hora São Paulo y resultado de cierre. La búsqueda normaliza tildes y b/v; presenta candidatos, nunca fusiona automáticamente.
- Campana incorpora seguimientos y salidas previstas al consultar las fuentes activadas. Avisos internos; no son push ni mensajes enviados con la app cerrada.
- Dictar seguimiento: reconocimiento del navegador en español/portugués, editable, sin guardado mientras habla. Se puede sugerir fecha explícita/hoy/mañana y debe revisarse. Se detiene al cambiar pestaña del navegador, cerrar o salir de la cuenta. El proveedor del navegador puede procesar el audio. No graba entrevistas ni conserva archivos de audio.
- Guía de atención con preguntas preparadas; no es un diagnóstico de IA. El catálogo contiene respuestas, precio opcional, duración y material HTTPS; solo dirección edita/aprueba, René usa contenido aprobado. Copiar no envía mensajes.

## Activación

El acceso de Supabase de esta sesión no tiene permiso sobre el proyecto independiente `irsuevjqmgpwunvymxbc`. No se aplicó SQL en producción ni se inspeccionaron filas reales.

`forma-workspace-upgrade.sql` reúne CRM actualizado, informes por período/cierres y cuentas en una transacción. Depende de Agenda v4, asistente de agenda y Finanzas v1 previamente instalados. Verifica la identidad del proyecto antes de crear tablas. No ejecutar en Eleva Taller/Modas ni en otro proyecto. En la app, dirección puede copiarlo desde Finanzas → Cuentas y control de caja → Preparar activación.

Después de ejecutar en el proyecto correcto, pulsar Actualizar. Verificar con datos de prueba: una persona con dos intereses, dictado corregido, asignar un cobro existente, transferencia interna, una previsión y su confirmación única, y el cierre de un mes terminado. No cargar saldos ficticios en cuentas reales. Saldo inicial significa el saldo al comienzo de su fecha, antes de los movimientos de ese día. Movimientos anteriores a la primera apertura quedan representados por el saldo declarado; no se importan otra vez.

## Límites y siguientes entregas

No se activan ni simulan WhatsApp, TikTok, conexión bancaria o cobro Pix automático. Se necesitan cuentas oficiales, credenciales servidor y pruebas de integración. El catálogo y la guía no son un asistente de IA conectado ni un servicio 24/7. El dictado depende de compatibilidad/permisos del navegador; siempre hay entrada escrita.

Permanecen como próximas etapas: matrículas/rematrículas/congelamientos y portal formal de alumnos, disponibilidad flexible y salas, asistente de IA con evidencias y validación del cliente, automatizaciones de seguimiento con app cerrada, aprendizaje de preguntas frecuentes con aprobación, evaluación 30/60/90 días, proveedor de pagos y comprobantes fiscales. El presupuesto personal y el dinero institucional continúan separados.

## Verificación

Pruebas Node de seguridad existentes; pruebas DOM con datos sintéticos de agenda, CRM, caja, dictado, catálogo, avisos y períodos; PostgreSQL temporal con el SQL real, conservación exacta de reservas/pagos/historial antes y después, reaplicación del instalador, reintentos idempotentes, permisos y bloqueo de emisores ajenos. La prueba local no acredita una auditoría de producción ni compatibilidad física de todos los dispositivos. No hubo navegador de QA disponible en esta sesión.
