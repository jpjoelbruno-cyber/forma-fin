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
