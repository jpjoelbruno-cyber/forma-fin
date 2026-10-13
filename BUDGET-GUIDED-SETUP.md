# Presupuesto por secciones

La interfaz conserva las categorías, los IDs de los campos y el guardado confirmado existente. Muestra una sección a la vez, navegación lateral en escritorio y selector en móvil, resumen parcial visible y revisión final. No exige ingresos para comenzar.

## Activación de pendientes y revisión guardada

Pendiente de ejecución por el propietario: en el proyecto **FORMA Personal Independiente** (`irsuevjqmgpwunvymxbc`), SQL Editor, ejecutar `budget-planning-state.sql` con la cuenta propietaria. No ejecutar en Eleva Taller ni Eleva Modas.

La migración permite `planned = NULL` (por estimar, distinto de cero), conserva todos los importes existentes y crea revisiones por propietario, mes y sección con RLS. No crea cuentas ni cambia acceso, roles o cursos. Es repetible. El resultado final debe mostrar `pending_enabled = true`.

Antes de activar la migración, los importes normales siguen guardándose; los botones No sé y Revisé esta sección están desactivados. Para indicar que un gasto conocido no existe se escribe 0. Borrar un importe ya guardado requiere el cambio de base de datos: sin él, el servidor rechaza el guardado y el editor permanece abierto mostrando el error, sin borrar el importe almacenado.

Después de ejecutar, cerrar y volver a abrir el presupuesto. Verificar con una cuenta de prueba: importe explícito 0, importe por estimar, importe positivo, cambiar sección, guardar y volver a entrar. La revisión indica una declaración del alumno, no verificación externa ni finalización de cursos.

## Validación

132 pruebas unitarias de seguridad/guardado; pruebas JSDOM del arranque completo y recorrido del nuevo presupuesto; 11 comprobaciones PGlite de la migración repetible, conservación de importes, null frente a cero y aislamiento entre propietarios. Las pruebas de base de datos usan una base desechable; no se aplicó SQL a producción.
