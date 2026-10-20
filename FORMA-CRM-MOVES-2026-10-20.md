# Ventas: movimientos automáticos y Deshacer

## Funcionamiento final

El tablero existente tiene dos vistas, elegidas con un selector: Etapas de atención y Nivel de interés. El nivel (sin evaluar, frío, tibio, caliente, muy caliente) es independiente de la etapa (Nuevos, En atención, Seguimiento, Preparar matrícula, Matriculados). Cerrados conserva su acceso y filtro separados.

En PC, soltar una tarjeta guarda directamente. En celular, Mover a… abre la selección de destino; elegirlo guarda sin otra confirmación. El cambio visual de la tarjeta ocurre después de la confirmación del servidor. Un aviso discreto muestra Guardado y Deshacer. Cada tarjeta sigue siendo un interés asociado a la misma persona: otros cursos, contactos, notas, visitas y pagos se conservan.

Al llevar a Matriculados, se reutiliza el curso de la tarjeta, el contacto y la ficha. La fecha inicial y condición de pago se reutilizan si ya pertenecen a esa matrícula; de lo contrario quedan por definir. Instructor y horarios se completan posteriormente en Agenda. No se exige conocer salario, pagar o tener horarios para registrar esta matrícula inicial. Solo se solicita el curso si está ausente. El formulario de confirmación repetida se retiró; el menú conserva el acceso al historial.

Una matrícula no confirma dinero recibido. Este movimiento no crea contratos, cuotas, pagos, reservas de sala ni mensajes de WhatsApp. El portal del alumno y los procesos formales de cancelación/congelamiento siguen pendientes de sus etapas específicas.

## Deshacer y datos conservados

El CRM ofrece interest_move e interest_undo sobre la misma función canónica, con solicitud idempotente, rol de gestión y control de versión. El resultado de cada movimiento conserva etapa, nivel de interés y motivo de cierre anteriores, además del efecto sobre la matrícula. Deshacer se limita al último movimiento de esa tarjeta efectuado por la misma sesión de usuario, siempre que ninguna edición posterior haya cambiado su versión. El servidor rechaza una reversión sobre cambios posteriores.

Deshacer una matrícula recién creada mantiene la fila, su identidad y su historial con estado revertida. Volver a matricular reutiliza ese registro y lo reactiva. Una matrícula confirmada que ya existía antes del movimiento se conserva. Mover comercialmente una tarjeta a otra etapa no equivale a cancelar una matrícula; el efecto especial de reversión solo corresponde al Deshacer de la creación/reactivación correspondiente. Ninguna de estas operaciones modifica pagos ni reservas.

Se mantienen filas únicas por interés y una sola ficha por persona. Una persona puede tener varios intereses y cursos. El curso de una matrícula no se sustituye editando un interés: otro curso corresponde a otro interés de la misma persona.

## Errores y seguridad

Ante una respuesta perdida, la tarjeta conserva la etapa visible anterior y el aviso permite Reintentar con el mismo request_id. No se crea otra persona o matrícula. El selector de vista y los controles de recarga quedan protegidos mientras ese movimiento esté sin confirmar. Un conflicto de versión no guarda ni sobrescribe y pide actualizar. El cierre de sesión limpia avisos, tarjetas, formularios y tickets de Deshacer, y descarta respuestas tardías. No se guardan contactos en almacenamiento local.

La tabla privada crm_enrolments usa RLS y no tiene permisos directos para anon/authenticated. El controlador privado exige owner/manager, sesión vigente y emisor exclusivo de FORMA. El wrapper público es SECURITY INVOKER y el controlador privado usa search_path vacío. La auditoría registra actor, fecha, etapas, niveles y reversiones. El nivel de interés tiene contadores completos del servidor; con versiones anteriores sin esos agregados se muestra —, nunca un conteo parcial como total.

## Instalación y estado de producción

Se modifica directamente forma-crm.js y la implementación canónica forma-crm.sql, con estilos en la hoja única forma-gestao.css. El instalador general incluye esa misma implementación una vez. La actualización añade estado confirmada/revertida a matrículas y sustituye la función CRM. No borra filas ni convierte cierres históricos en matrículas.

El conector disponible no tiene permiso sobre irsuevjqmgpwunvymxbc. No se ejecutó SQL de producción ni se tocó ningún proyecto de Eleva. El frontend se publica mediante GitHub/Vercel; la actualización completa de base requiere una sola activación del propietario.

Ruta: Ventas → Activar automatización de Ventas → Copiar actualización → Abrir base de FORMA → pegar en SQL Editor → Run. Solo se copia forma-crm.sql. También puede usarse Configurar FORMA para el instalador general, que conserva los módulos mensuales anteriores. Después actualizar la app. No se repiten contactos ni se solicita autorización por cada movimiento.

Compatibilidad: un CRM anterior activo permite movimientos automáticos entre sus etapas mediante interest_save con control de versión y solicitud idempotente. Un CRM con la primera versión de interest_move también permite matricular directamente usando el curso y condiciones por definir. Deshacer matrículas requiere la actualización nueva: no se ofrece una reversión falsa. Si no está activado siquiera el CRM, se mantiene el aviso y no se simula guardado.

WhatsApp y TikTok siguen sin conexión API. La automatización descrita ocurre dentro de FORMA.

## Pruebas locales

- 155 pruebas unitarias existentes aprobadas.
- DOM: soltar para matricular sin confirmación, selección móvil inmediata, nivel independiente de etapa, datos opcionales, Deshacer, conflicto al revertir una edición posterior, reintento del mismo request_id, compatibilidad, texto seguro y limpieza privada.
- PGlite: actualizaciones repetidas y comparación exacta de fichas, intereses, vínculos, solicitudes, auditoría, reservas, pagos, contratos e historial anteriores.
- Matrícula y reversión idempotentes, estado revertida sin eliminación, reactivación sin duplicar, cambios de temperatura sin cambiar etapa, rechazo de reversiones cruzadas o posteriores, contadores completos y conservación financiera.
- Rechazo de profesor, alumno, anónimo, emisor de otra app, sesión revocada y lectura directa de tablas privadas.
- Regresión del CRM completo, instalador general, estilos y resumen mensual.

Pruebas realizadas con datos sintéticos locales. No constituyen auditoría ni activación confirmada de la base real de René.
