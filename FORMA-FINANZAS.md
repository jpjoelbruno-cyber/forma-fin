# FORMA · Finanzas y navegación compacta · 17 octubre 2026

## Interfaz
Finanzas reemplaza el rótulo Ingresos. Cuatro indicadores: recibido durante el mes (verde), salidas del mes (morado), movimiento neto del período y por cobrar de todos los meses. Este último no se suma al efectivo ni se usa como porcentaje de un total de caja. Barras de entradas/salidas y una pizza SVG con selector por actividad, medio, área, grupo o composición de salidas. Importes exactos en centavos, agrupación de pequeñas categorías sin perder valores. Detalle por mouse, foco y toque; texto y leyendas acompañan colores. Listados plegables.

Navegación principal: Mi día, Mi semana, Finanzas, Ventas. Buscar persona independiente; no despliega nombres hasta escribir dos caracteres. Pendientes en botón con icono/cuenta real de tareas; Evaluar y mejorar en Más opciones. Se conservan las comprobaciones de acceso de las vistas originales.

## Persistencia y activación
El código de interfaz puede publicarse sin instalar el nuevo registro: presenta salidas como **Por activar** y neto como **—**, nunca cero inventado. Sigue consultando cobros existentes. El proyecto real es solo `irsuevjqmgpwunvymxbc`; el conector disponible no tiene permisos de administración sobre él.

El propietario abre Finanzas → Copiar SQL de activación → ejecuta `forma-finance.sql` en el SQL Editor de FORMA → resultado `finanzas_instaladas = true` → Actualizar. Es independiente del instalador de Personas/Ventas. Requiere agenda/pagos ya instalados. No requiere volver a registrar reservas ni cobros.

## Registro financiero
- Gasto: salida real con importe, fecha pasada/actual, medio, categoría y motivo. Confirmación explícita de dinero ya entregado. No transfiere fondos ni conecta bancos.
- Solicitud de devolución: vinculada a un cobro original, parcial o total. No mueve caja. Pendientes más devoluciones efectuadas nunca pueden superar ese cobro.
- Confirmar devolución: registra una salida una sola vez, conserva el cobro original y guarda decisión/actor/fecha. La fecha no puede ser anterior al cobro ni futura.
- Rechazar/cerrar solicitud pendiente: conserva motivo e historial; no mueve caja.
- Cancelar reserva: conserva cobros y deuda. La cancelación no concede automáticamente reembolso ni perdona importes.
- Ajustar saldo cancelado: perdón explícito y motivado de hasta el saldo pendiente; no produce salida de caja. Los cobros y el acuerdo original se conservan. No hay reversión de ese ajuste en esta versión; requiere revisión antes de confirmar.
- Una devolución no vuelve a crear deuda automáticamente. El saldo por cobrar se calcula como acuerdo original menos cobros válidos y saldo perdonado; los reembolsos se muestran aparte. No debe interpretarse como contabilidad fiscal ni ganancia.
- Corregir gasto: solo errores de registro, no ingreso real de dinero; conserva movimiento y motivo de anulación. No permite anular un reembolso como si fuera un gasto equivocado.

## Conservación y seguridad
Instalación repetible, nuevas tablas privadas con RLS y sin acceso directo. No borra ni actualiza datos antiguos durante la instalación. Copia el motor anterior a un ayudante privado sin permisos directos y mantiene el OID del motor de cobros existente, agregando límites sobre saldos ajustados y protección contra anular cobros con devolución pendiente/realizada. Reserva con adelanto sigue transaccional. Funciones validadas por sesión activa, emisor de FORMA y rol owner/manager; alumno/instructor/anon/otra app rechazados. No toca las finanzas personales ni otros proyectos.

Todas las escrituras usan UUID persistente para reintento incierto, payload/actor inmutables, bloqueo transaccional común con agenda/cobros, auditoría y limpieza al cambiar sesión. El código no depende de claves secretas en navegador.

## Verificación
Pruebas locales con datos ficticios en PGlite y JSDOM, más regresión existente. Se compara antes/después el contenido íntegro de reservas, acuerdos, cobros e historial al instalar dos veces. Casos de reembolso parcial, exceso, solicitud sin salida, pago de devolución una sola vez, corrección protegida, saldos cancelados explícitos, meses distintos, neto negativo, continuidad de reserva/adelanto y permisos.

Pendiente: ejecutar instalador autorizado en proyecto real, comprobar dos sesiones reales y verificar los movimientos completos de René. Las pruebas locales no son una auditoría independiente de los datos productivos.


## Actualización 17 octubre · períodos y cierre mensual

Finanzas abre en Hoy. Día, semana (lunes a domingo), mes y año se consultan individualmente. Entró y Salió usan fechas reales de movimientos; Diferencia no equivale a beneficio ni saldo bancario. Curso/servicio corresponde al área registrada al cobrar, actividad y grupo son desgloses alternativos; los medios de pago son otra lectura del mismo total. Los registros históricos de tarjeta no distinguen crédito/débito.

Por cobrar muestra deudas de todos los períodos por separado, con pago previsto y acceso al detalle. Cancelar no borra cobros ni perdona saldos; reembolsos confirmados aparecen una sola vez como salida.

Activación adicional del servidor: en la cuenta de dirección, Finanzas → Activar cierres copia `forma-finance-periods.sql`. Ejecutar exclusivamente en FORMA Personal Independiente (`irsuevjqmgpwunvymxbc`). Es aditivo, verifica el proyecto y no cambia registros antiguos. Tras el resultado `informes_y_cierres_instalados = true`, pulsar Actualizar. Sin acceso administrativo al proyecto correcto no se aplica automáticamente.

Antes de esa activación, la interfaz consulta la API financiera instalada: mes/año conservan sus agregados completos, día/semana solo se calculan si las listas de movimientos están completas; si exceden los límites, se exige activar informes en lugar de mostrar totales parciales. Por cobrar advierte si su lista está limitada. El resumen mensual permite exportar un borrador; Guardar cierre queda deshabilitado.

Con la actualización: los informes se calculan en el servidor sobre todos los movimientos, aunque las listas sean limitadas. Por cobrar dispone de paginación de 30. Solo se cierra un mes terminado según São Paulo. Los cierres guardados conservan fecha, actor, totales, categorías y medios; una corrección genera una revisión con motivo, nunca sobrescribe. No bloquean registrar movimientos atrasados: estos aparecen en el resumen actual y en la siguiente revisión. Reintentar utiliza el mismo identificador para impedir duplicados. CSV exporta el resumen, no comprobantes fiscales.

Validación: 148 pruebas unitarias, suite SQL adicional con conservación de datos y permisos, y pruebas de interfaz con RPC simulada. No se crearon movimientos de prueba en producción. La visualización en dispositivos físicos y el guardado de cierres en la base real requieren validación posterior a la activación.
