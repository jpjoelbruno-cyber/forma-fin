# FORMA Gestão: caja y extracto

La navegación financiera usa tres secciones: Resumen, Extracto y Por cobrar. Se conservan los gráficos por día/semana/mes/año, el cierre mensual versionado, el resumen mensual por categorías, la consulta de cuentas y las notificaciones. Registrar cobros o salidas abre los formularios existentes: no se crea un segundo libro financiero.

Se retiró el antiguo navegador de listas separadas y sus estilos, la duplicación de la diferencia del período y el contenedor mensual que escondía toda la caja. Cuentas y control de caja permanece en Más opciones. Los cuatro indicadores principales muestran entradas, salidas, diferencia del período y deuda global, sin presentar deuda como dinero recibido ni diferencia como saldo bancario.

## Activación de la consulta completa

La interfaz publicada funciona con los movimientos que ya cargan los informes actuales. Si falta la nueva RPC, se indica la compatibilidad y cualquier límite; las búsquedas y subtotales de esa vista no se presentan como exhaustivos. Las salidas aún sin activar permanecen desconocidas, nunca cero.

El propietario puede abrir Finanzas → Extracto → Activar extracto completo → Copiar actualización. Ejecutar el contenido de `forma-statement.sql` solo en el SQL Editor del proyecto independiente `irsuevjqmgpwunvymxbc`. El instalador crea o reemplaza dos funciones de consulta y sus permisos; no crea, elimina ni modifica registros. También está incluido en la actualización conjunta atómica. No se ejecutó SQL en producción desde esta tarea.

## Consulta y conservación

`public.forma_statement(p_data jsonb)` utiliza un wrapper invoker hacia una función privada con search_path vacío. Autoriza exclusivamente owner/manager mediante la sesión independiente vigente de FORMA. Anónimo, alumno, instructor, sesión revocada, acceso bloqueado y JWT de otra aplicación no pueden leerla.

Filtros: from/to (máximo 366 días inclusivos), query (literal, máximo 160 caracteres), kind (`payment`, `gasto`, `reembolso`), method, category, include_void y offset. Respuesta: página de 30 filas en orden estable por fecha, creación, tipo e identificador; conteo, has_more, categorías y totales del conjunto completo filtrado. La fecha corresponde a paid_on. Las categorías de cobro se obtienen de la instantánea del recibo, no del curso cambiado después.

Los cobros provienen de agenda_payments; gastos y reembolsos realizados, de finance_outflows. Las solicitudes de devolución no producen caja. Los reembolsos no se vuelven a sumar desde finance_refunds. Anulados se conservan, pueden consultarse explícitamente y quedan fuera de las sumas. Transferencias propias y compromisos de pago están separados del resultado. Los importes de tarjeta son brutos; la liquidación, comisiones y conciliación siguen en Cuentas.

El extracto no tiene operaciones de escritura. Abrir un movimiento reutiliza el detalle original y sus correcciones auditadas. Los formularios conservan identificadores idempotentes y no permiten cerrar un guardado sin confirmar. No se modificó ninguna tabla ni política de las otras aplicaciones, ni las credenciales, login o conexión bancaria.

## Validación

- 184 pruebas unitarias/de seguridad existentes.
- Prueba Postgres local del extracto: reinstalación doble y consultas conservan todas las tablas privadas idénticas; 242 movimientos vigentes, paginación sin repeticiones, filtros y sumas sobre más de 200 cobros, anulados excluidos, devolución única y rechazo de roles/sesiones ajenos.
- Actualización conjunta repetida: conserva reservas, contratos, pagos e historial.
- Pruebas UI: pestañas y períodos, filtros, paginación, detalles seguros, fallback explícito, notificaciones, cierres, reintentos de guardado y limpieza de respuestas tardías al salir.

La conservación de producción se basa en no ejecutar operaciones de datos allí. No se afirma haber inspeccionado ni comparado todos los datos reales de René. La nueva consulta necesita la activación del propietario antes de validar la integridad del extracto completo con su sesión real.
