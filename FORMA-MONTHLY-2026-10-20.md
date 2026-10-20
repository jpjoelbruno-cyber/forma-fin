# Resumen mensual por categorías · FORMA Gestão

## Entrega

Finanzas → Mes presenta un resumen mensual, cuatro indicadores, barras de encuentros por tipo, dona de cobros por tipo y tabla agrupable por tipo de atención o curso/área. Los tipos se desglosan en áreas, incluidas las nuevas áreas registradas. El detalle abre las reservas y sus pagos existentes. La caja anterior, medios de pago, pendientes globales y cierre permanecen en una sola sección desplegable. Día, semana y año conservan su funcionamiento.

## Criterios

- Encuentros vigentes: fechas de la serie semanal dentro del mes, incluyendo series iniciadas antes. Un encuentro con varios instructores u horas cuenta una vez. Las cancelaciones aparecen por separado.
- Asistencia: únicamente los estados explícitos de agenda_attendance; el paso del tiempo no demuestra presencia ni conclusión.
- Personas únicas: DISTINCT de las fichas CRM vinculadas a reservas vigentes del mes. Una reserva grupal vinculada a un contacto no equivale a una lista completa de alumnos. Se informa cuántas reservas carecen de ficha. Sin CRM se muestra —.
- Cobrado: pagos no anulados por paid_on. Se conservan el tipo y área guardados al recibir cada pago. Un anticipo no se mueve a la fecha de clase.
- Por cobrar mensual: saldo actual de contratos con vencimiento acordado dentro del mes, restando pagos no anulados y ajustes de deuda. Cancelar no perdona automáticamente la deuda. No es una foto histórica del saldo al último día del mes.
- Deuda sin fecha se informa fuera del total mensual. Vencidos de otros meses siguen disponibles en Por cobrar.
- Reembolso: salidas confirmadas, no solicitudes. Se atribuyen a la categoría original del pago. Cobrado neto = cobrado bruto − reembolso; no es utilidad ni saldo bancario.
- Los desgloses por tipo y área representan el mismo dinero y no se suman entre sí.

## Activación y límite de esta entrega

El frontend se publica mediante el repositorio y Vercel existentes. El conector disponible denegó acceso al proyecto independiente irsuevjqmgpwunvymxbc; no se ejecutó SQL en producción ni se consultaron los datos privados de René. No se tocó ningún proyecto de Eleva.

`forma-monthly.sql` añade únicamente funciones de lectura; no crea registros, no modifica tablas ni borra filas. Se limita al proyecto independiente por guardia de emisor. La consulta exige rol owner/manager, rechaza sesiones de otros aplicativos y anónimos, y usa search_path fijo. La función pública es SECURITY INVOKER; el agregador privado valida permisos como SECURITY DEFINER. El helper de clasificación no tiene ejecución directa para authenticated.

Si falta la nueva RPC, la app consulta la agenda mensual existente y los agregados financieros completos. Muestra encuentros activos y cobros exactos del mes. Las métricas que esas API no permiten verificar (identidad, asistencia, cancelaciones, deuda mensual) quedan en —, con aviso. Si las listas de pagos están limitadas, no se presentan como desglose completo por tipo y área ni como detalle completo. Un error de permisos o de red no activa una compatibilidad que oculte el error.

El propietario puede pulsar Activar informe completo en el resumen: abre la configuración existente y copia SOLO forma-monthly.sql. El botón no ejecuta SQL. Se pega en SQL Editor del proyecto FORMA Personal Independiente. El instalador general forma-workspace-upgrade.sql también incluye el informe para instalaciones posteriores. Tras ejecutar, Actualizar utiliza la consulta completa automáticamente. No es necesario volver a cargar datos.

## Validación local

- 155 pruebas unitarias aprobadas, incluidas clasificación, series semanales, deduplicación y límites del modo compatible.
- PGlite: instalación repetida, comparación exacta de reservas, pagos, contratos, historial, asistencia, reembolsos, salidas y ajustes; consulta sin cambios en esos registros.
- Series que atraviesan meses, dos instructores, ficha vinculada a varias reservas, asistencia explícita, cancelación, deuda por vencimiento, devolución, más de 200 pagos, categorías históricas y paginación.
- Roles de propietario/gestor, rechazo de profesor/alumno/anónimo y emisor ajeno o acceso revocado.
- Instalador general ejecutado dos veces sobre datos de prueba sin cambios en los registros anteriores.
- DOM: resumen exacto y compatible, cuatro indicadores, agrupación, detalle, caja conservada, ausencia de capas duplicadas, cambio de período, escape de contenido, cierre de sesión y descarte de respuestas tardías.
- Regresión: períodos financieros, cuentas, pendientes, presentación aprobada y hoja de estilos única.

Las pruebas usan datos sintéticos en bases locales. No equivalen a una auditoría de los registros reales de producción ni a una activación confirmada en Supabase.
