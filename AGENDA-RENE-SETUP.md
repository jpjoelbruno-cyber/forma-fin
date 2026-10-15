# Agenda René dentro de FORMÁ

Ruta de uso: `/agenda.html`. Ejemplo separado y sin persistencia: `/agenda.html?vista=ejemplo`. El ejemplo nunca solicita ni escribe reservas del servidor. No introducir datos reales en él.

## Alcance implementado

Conserva el texto del 15/10/2026: nombre, sello existente sin alteraciones, semana lunes-sábado con columnas equivalentes, 13:00-18:00, salto por mes/año 2020-2045, Semana anterior/siguiente/Hoy, cinco franjas de una hora, formulario y todas las áreas/instructores, duración 1-5 horas, 1-52 sesiones cada siete días, series completas, motivo al cambiar horario/cantidad o cancelar, etiquetas INICIO/FINALIZA solo si hay más de una sesión. En celular se conserva el mismo calendario con desplazamiento horizontal y lista de reservas abajo.

El bloqueo es global, independientemente del instructor. Podcast no amplía horarios. No se agregaron estados de asistencia, CRM, cobros, notificaciones automáticas, modificación individual de una sesión ni conexión a bancos.

## Activación por el propietario

No se aplicó SQL al proyecto alojado. La herramienta de lectura de Supabase no permitió consultar el proyecto en esta sesión; por eso tampoco se verificó en producción la instalación ni su esquema actual. Las comprobaciones de base de datos son locales y desechables.

1. Abrir el proyecto **FORMA Personal Independiente**, ID **irsuevjqmgpwunvymxbc**. No usar Eleva Taller/Modas.
2. En SQL Editor ejecutar `agenda-setup.sql`. No cambia presupuestos, movimientos, metas, cursos ni login de alumnos. El administrador existente queda autorizado por su membresía actual.
3. René crea/confirma su cuenta en FORMÁ e inicia sesión una vez. Solicitar el correo exacto; sustituir `RENÉ_CORREO_CONFIRMADO` en `agenda-authorize.sql` y ejecutar. No añadirlo a `forma_admin_members`.
4. Entrar como propietario: Administración → Abrir Agenda René. René usa la misma ruta o su acceso Agenda René una vez autorizado. Alumnos sin membresía no pueden consultar ni modificar reservas aunque conozcan la ruta.
5. En PC y celular crear PRUEBA SIN DATOS REALES y verificar guardado, recarga, actualización al volver a la pestaña y botón Actualizar. No se anuncia actualización instantánea: no hay suscripción Realtime todavía.
6. Verificar dos personas reservando el mismo horario; una debe recibir conflicto. Verificar edición antigua rechazada, cancelación con motivo, conservación del historial y denegación a un alumno no autorizado.

## Seguridad y arquitectura

Mismo proyecto independiente y misma sesión FORMÁ; el módulo no carga app.js ni consulta tablas financieras. Tablas de reservas, franjas, personal e historial en `forma_private`, RLS habilitada y sin acceso directo para anon/authenticated. Funciones privilegiadas privadas con search_path fijo y autorización de cada operación: emisor dedicado, sesión vigente en auth.sessions, usuario no bloqueado, acceso activo y membresía agenda/propietario. Las funciones públicas son invoker. Ningún rol proviene de user_metadata.

Manager puede gestionar agenda y consultar historial. Instructor solo consulta las reservas cuyo instructor coincide con su asignación; no recibe WhatsApp/profesión ni historial. No se incluyen claves secretas. El propietario debe gestionar asignaciones y revocaciones; la revocación se aplica en la siguiente operación del servidor. Datos ya vistos por un usuario autorizado no pueden recuperarse de su memoria/dispositivo mediante revocación.

Operaciones de serie en transacción: bloqueo asesor compartido + clave única día/hora impiden solapamientos. Las ediciones exigen versión esperada para evitar sobrescritura silenciosa. Cancelar conserva reserva e historial y libera las franjas. Historial guarda responsable, fecha de servidor, motivo y snapshots privados.

No se guardan datos personales de agenda en localStorage; la sesión utiliza la clave FORMÁ existente. El formulario permanece abierto ante fallo sin anunciar guardado. Tras volver a una pestaña se actualiza si no hay edición abierta; una edición abierta no se reemplaza con datos nuevos.

## Migración y pendientes

No se importaron ni borraron registros antiguos. Exportar primero el respaldo del navegador original y proporcionar su formato/HTML para diseñar importación con previsualización y deduplicación. No inventar un formato de importación sin ver el respaldo.

Pendiente: ejecución SQL del propietario, correo exacto y autorización de René, prueba real PC/celular y concurrencia en el servidor alojado, revisión de asesores de Supabase después de instalar, recuperación de respaldo y migración validada. El proyecto Floot no se modificó ni auditó directamente.

## Pruebas reproducibles

`node --test tests/security/agenda-model.test.cjs`

`FORMA_PGLITE_MODULE=/ruta/pglite/dist/index.js node tests/security/agenda-database.mjs`

`FORMA_JSDOM_MODULE=/ruta/jsdom node tests/ui/agenda.cjs`

`FORMA_JSDOM_MODULE=/ruta/jsdom node tests/ui/full-demo.cjs`

Dependencias QA fijadas: @electric-sql/pglite 0.3.14 y jsdom 27.0.1. No se añaden al cliente publicado.
