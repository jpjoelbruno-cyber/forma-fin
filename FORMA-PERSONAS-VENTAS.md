# FORMA · Personas y Ventas · 17 de octubre de 2026

## Alcance entregado
Primer incremento, integrado en la agenda existente: Personas, buscador con teléfono/correo/código, creación y edición de ficha, vínculos explícitos con reservas antiguas, reservas nuevas con contacto reutilizado, varios intereses por persona, etapas comerciales, próxima acción/fecha, origen declarado y una respuesta preparada para revisar/copiar. Solo propietario y gestores autorizados. No se crean cuentas de alumno desde un correo escrito por René.

Preparar matrícula es una etapa comercial; NO crea una matrícula formal ni un cobro. No hay API de WhatsApp/TikTok, envío automático, portal nuevo de alumnos, cuotas nuevas, QR, comprobante fiscal ni registro automático de cursos concluidos en este incremento.

## Conservación de datos
`forma-crm.sql` crea tablas y funciones nuevas, no sustituye las funciones de agenda/pagos. No ejecuta DELETE, DROP, TRUNCATE ni UPDATE sobre reservas/pagos existentes. No rellena fichas ni une nombres automáticamente. La instalación puede repetirse. Los vínculos se guardan en una tabla aparte; editar el contacto no reescribe los datos históricos de reservas anteriores.

Nueva reserva vinculada: `forma_crm('reserve',...)` llama al registrador de agenda existente y crea su vínculo en la misma transacción. Conserva su control de horarios, pagos, adelantos y fecha futura acordada. El cliente guarda una solicitud pendiente con el mismo UUID para reintentar sin duplicar. Las fichas/intereses tienen el mismo mecanismo; las ediciones requieren la versión actual.

## Activación real pendiente
Proyecto único: `irsuevjqmgpwunvymxbc` (FORMA Personal Independiente).
El conector de Supabase devolvió falta de permisos para este proyecto el 17-10-2026. No se aplicó SQL en producción ni se inspeccionaron datos reales con ese conector.

El propietario puede abrir Agenda → Personas → Copiar SQL de activación y ejecutarlo en el SQL Editor de ese proyecto. Requiere los instaladores de agenda, asistente y pagos existentes. El script comprueba que la función de autorización de agenda pertenece al proyecto FORMA esperado y que existen esas dependencias antes de crear objetos. No incluye correo personal en el instalador. Termina con `personas_ventas_instalado = true`. Después pulsar Actualizar en Personas.

Antes de activar, Personas permite reutilizar nombre/teléfono desde las reservas cargadas del periodo actual; la pantalla indica que es una consulta limitada y no un historial completo. No se simula persistencia ni se guardan contactos de negocio en localStorage.

## Permisos y seguridad
Tablas en esquema privado con RLS habilitado y sin acceso directo de anon/authenticated/PUBLIC. RPC público invocador y operación privilegiada privada con search_path fijo. Todas las acciones validan el rol de agenda existente, emisor FORMA, sesión vigente, bloqueo del usuario y acceso activo. No usan user_metadata para permisos ni datos del presupuesto personal. Sin endpoints financieros de otros proyectos. Al cerrar o cambiar sesión se limpian fichas y formularios; respuestas asíncronas antiguas se descartan. Al denegar permiso se limpia el módulo.

No se considera verificado un correo agregado por un gestor. No se cuenta una reserva como visita: solo asistencia realizada registrada, sobre vínculos explícitos. Los listados tienen límites/paginación visibles. El origen es manual y no equivale a atribución publicitaria comprobada.

## Pruebas reproducibles
Dependencias temporales de QA (fuera de producción): jsdom 26.1.0, @electric-sql/pglite 0.3.14.

- `FORMA_PGLITE_MODULE=<ruta>/@electric-sql/pglite/dist/index.js node tests/security/forma-crm-database.mjs`
- `FORMA_JSDOM_MODULE=<ruta>/jsdom node tests/ui/forma-crm.cjs`
- Regresión: tests/ui/agenda.cjs, agenda-income.cjs, agenda-assistant.cjs, agenda-calendar.cjs; tests/security/agenda-income-database.mjs y agenda-calendar-database.mjs; `node --test tests/security/*.test.cjs tests/*test.cjs`.

Base temporal: 25 comprobaciones de conservación exacta, instalación repetida, nombres duplicados, vínculos, intereses, concurrencia optimista, reserva/pago atómicos, reintentos, paginación y permisos. Regresión SQL: 39 cobros y 22 calendario. Regresión Node: 137 tests. DOM: cinco suites. No son pruebas con datos de René ni certificación independiente. Falta validar producción con dos sesiones reales después de activar el esquema.

## Prueba de aceptación después de activar
1. René abre Personas, busca un contacto y comprueba que las reservas antiguas siguen presentes en Semana/Ingresos.
2. Revisa si ya existe ficha; crea una ficha desde una reserva o vincula esa reserva a una ficha existente. Nunca unir por nombre solamente.
3. Registra interés, origen declarado, próxima acción y fecha. Verifica en Ventas desde otro dispositivo con una cuenta de gestión autorizada.
4. Desde la ficha crea una reserva en un horario libre y comprueba saldo/fecha futura cuando corresponda.
5. Confirma que un instructor y un alumno no pueden acceder a Personas/Ventas.
6. Para desactivar temporalmente la interfaz, revertir solo los archivos de esta publicación; conservar las tablas nuevas y todos los registros. No borrar tablas como mecanismo de reversión.

## Autorización de publicación
El propietario autorizó expresamente publicar en la app real mediante el repositorio público actual el 17-10-2026. La activación SQL sigue siendo independiente: el conector no tiene acceso al proyecto de producción de FORMA. No se publica información real de personas atendidas por René. El instalador no contiene correo personal.
