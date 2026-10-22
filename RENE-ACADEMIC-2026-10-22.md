# FORMA — coordinated services, courses and enrollment

This release implements the approved course/service separation on the independent FORMA project. Existing services, budgets and banking integration are preserved. No production SQL was executed by the assistant.

## Activation

The source and frontend can be deployed independently. The new database features require the owner to run `forma-education-upgrade.sql` in project `irsuevjqmgpwunvymxbc`, then refresh FORMA. In Matrículas, the owner sees **Activar módulos y correcciones** while the catalog lacks `academic_version: 2`. The connected Supabase integration available during development listed only another project, which was not queried or changed. The owner previously chose to execute Supabase SQL personally.

The installer is generated from maintained canonical SQL by `scripts/build-education-reports.py` and `scripts/build-workspace-upgrade.py`. It is additive and rerunnable. No seed pupils/courses are installed. Existing receipt amounts, bookings and history are not rewritten during installation. New defaults preserve existing teacher/room assignments through fallback to the group's values. A fresh installation and repeat installation are tested in a local Postgres runtime; production activation must still be confirmed.

## René's flow

- **Agendas** contains General, Servicios and Cursos. The default is Servicios. Courses use their own records; a compact occupied indicator prevents a service view from advertising a teacher as free during a course. Availability checks always run on the server across both domains. A second student joins the existing group and does not create another booking.
- **Matrículas → Cursos y grupos** contains the course/module catalog, cohorts, capacity, dates, per-group contracted/received/pending summaries, roster and enrollment actions.
- A course has an editable module list. A cohort retains default teacher/room plus an editable plan and individual teacher/room per encounter. One instructor can teach multiple modules. The module generator replaces that module's proposed rows rather than appending duplicates. All encounters remain editable; a filter keeps the review list compact.
- Enrollment reuses a person, allows individual terms, records an optional confirmed advance and can enable the student portal. Monthly, weekly, per-encounter and custom payment dates are supported. A custom plan must sum to the contract total. Existing contracts adopted into a group keep their original terms and receipts.
- Name/contact corrections use the existing version-checked CRM record. An active portal email cannot be silently changed to reassign access. Contract corrections preserve payments, require a reason and cannot reduce total below received funds. Changes below received funds need a separately resolved refund arrangement.
- A receipt correction voids the mistaken record and emits the replacement in one transaction; invalid replacement rolls the void back. The original remains visible. Reassignment explicitly selects an existing person, records its reason and moves the enrollment and associated receipts/notices while retaining original payer names. Enrollments with legacy booking links require a directed review before reassignment. This release does not automatically merge duplicate contacts.

## Institutional finance

Confirmed receipts feed one unified read-only source. Linked enrollment receipts are categorized as Cursos / matrículas; booking receipts without an enrollment financial link remain Servicios / agendamientos. Unassigned institutional receipts stay Por conciliar. Historical activity names alone are not evidence of an enrollment.

Period reports preserve category/course, group and payment-method breakdowns and add an optional module breakdown. René selects a module on a payment only when applicable; whole-course advances remain Sin asignar a módulo. The system does not invent module allocation or add breakdowns together. Services and course receivables are separate global amounts covering all due dates, distinctly labeled from selected-period money received. Cancellation does not silently waive debt or create a refund. Existing refund/outflow handling remains unchanged.

## Student access and acceptance

The existing FORMA **Mis cursos** portal uses the verified email explicitly enabled for that person's enrollment. It shows course terms, actual per-encounter teachers and rooms, payment dates, remaining debt, receipts and in-app institutional notices. The student may report a payment; only verified staff confirmation counts as money received. Google and email/password access use existing independent FORMA authentication. No Eleva login, database or credentials are involved.

Before inviting a group this week: activate SQL, create/review one actual cohort, link a real student's verified email, and have that student confirm their own course, schedule and receipt. Local tests do not establish that all current student emails are correctly linked in production. Students never receive staff roster access or other students' data. Their personal budgets and banks remain independent of institutional payments.

## Verification

Automated checks cover six-module timetables, repeated instructors, substitution, shared teacher/room conflicts, own-group overlaps, single-reservation group enrollment, capacity, individual pricing, weekly/custom due dates, partial payments, atomic receipt correction and rollback, module income, contract correction, reassignment and old-student access removal. Existing data-preservation, revoked-session, student/staff isolation, financial/refund/closing, frontend recovery and logout cleanup checks are also run. No authenticated live student test or production mutation is claimed before activation.

## Ampliación del catálogo (22 de octubre)

El editor de cursos muestra una fila editable por módulo y un botón «Añadir módulo»; no utiliza una lista fija de dos opciones. Admite hasta 100 módulos por curso, conforme al límite de validación existente en el servidor. El catálogo de cursos queda visible para editarlo sin buscar un panel cerrado.

Al preparar un grupo se puede guardar un módulo nuevo directamente en su curso, sin cerrar el formulario ni perder fechas, alumnos o encuentros existentes. Se utiliza `course_save` con control de versión e identificador de solicitud; si se pierde la respuesta, solo se permite reintentar esa misma operación hasta confirmarla. El módulo queda en el catálogo del curso; el grupo y sus nuevas fechas se guardan aparte con el botón habitual.

Las nuevas especialidades de Servicios se escriben con «Escribir nueva área» y se conservan al guardar la reserva. Curso, módulo y área de un servicio siguen siendo conceptos separados. Esta mejora de interfaz utiliza las funciones ya disponibles y no necesita una migración adicional. No instala ni confirma la actualización académica previamente pendiente.

## Precio acordado y abonos sucesivos

La matrícula de grupo destaca el valor total individual. Escribir ese importe aplica el acuerdo como un único valor del curso, sin sumar otra inscripción; el desglose en cuotas e inscripción adicional sigue disponible en opciones. El adelanto se guarda en la misma operación de matrícula. Cada abono posterior se registra desde la ficha del curso y muestra total acordado, recibido, saldo actual y saldo previsto tras el pago. El precio original no se reduce al cobrar. El saldo aparece explícito en las fichas de René y del alumno.

Se verificó el caso Julio en la interfaz y en Postgres local: R$2.000 contratados, R$200 recibidos al matricular, R$800 después, R$1.000 pendientes; repetición de solicitud sin duplicar, rechazo de importe superior al saldo y liquidación final con comprobantes separados. No se aplicaron operaciones sobre registros reales. Utiliza los RPC existentes; no añade SQL de instalación. La personalización individual sigue requiriendo la activación académica versión 2 previamente preparada.

## Rediseño de una sola página (sustituye los editores académicos anteriores)

Se retiró el diálogo académico y su navegación entre formularios. La pantalla «Cursos y matrículas» reúne un catálogo lateral con botón Editar y un área con tres secciones: curso/grupo/cupos/sala, tabla editable de módulos y encuentros, y matrícula con búsqueda de persona, precio individual y abono. La creación de personas se despliega en la misma página. Los detalles de cuotas, fechas de pago y portal siguen disponibles como opciones. La lista de alumnos del grupo se consulta debajo; sus fichas conservan correcciones, pagos posteriores y comprobantes.

Cada fila admite módulo, instructor, fecha, horas y sala. Un módulo puede tener varios encuentros o quedar sin fecha para programarlo después. Inicio y fin se calculan desde los encuentros. Un curso puede tener varios grupos, seleccionables en la misma página. Los cambios en curso/grupo deben guardarse antes de matricular. La interfaz conserva borradores en memoria al cambiar de curso o grupo y elimina datos personales al cerrar sesión. No usa almacenamiento local de datos de alumnos.

No requiere nuevas tablas ni migraciones: usa los RPC existentes `forma_academic` y `forma_education`. La escritura de curso y grupo sigue siendo secuencial, no una transacción conjunta nueva: si el curso se confirma y el grupo falla, se indica qué quedó guardado y se conservan los horarios editables para corregirlos. Cada paso tiene identificador estable; una respuesta perdida se reintenta sin duplicar cursos, personas, grupos ni matrículas. La matrícula y su adelanto siguen siendo una única transacción del servidor. Se bloquea matricular con cambios sin guardar, cupos agotados, abonos superiores al saldo, dinero no confirmado o una persona ya matriculada en el mismo grupo.

La personalización por alumno y el instructor/sala por encuentro requieren la versión académica 2 ya preparada. En bases anteriores esos controles se deshabilitan en lugar de aparentar que se guardarían. El propietario conserva el acceso a activar esa actualización pendiente. No se instalaron SQL ni datos de prueba en producción.

Validación: flujo de curso nuevo, módulos adicionales, encuentros con varios instructores, edición de fechas, matrícula reutilizando contacto, alta de persona en línea, pago parcial, recuperación tras respuesta perdida, recuperación de paso parcial, bloqueo de cruce, control de duplicados, compatibilidad anterior y limpieza ante respuestas tardías después de salir. Las pruebas de Postgres mantienen 37 escenarios de educación con aislamiento, comprobantes y conservación de registros.

Comprobación adicional en Chromium aislado, sin sesión ni llamadas a producción: edición y matrícula desde la página real, cálculo R$2.000/R$200/R$1.800, ausencia de diálogos académicos, ausencia de errores JavaScript y sin desbordamiento horizontal a 1800, 1440, 1024, 768 y 390 píxeles. Se revisaron capturas de escritorio y móvil. El script reproducible es `tests/ui/academic-browser.cjs`, con dependencias de pruebas externas configuradas mediante `FORMA_PLAYWRIGHT_MODULE` y `FORMA_CHROMIUM_MODULE`. Las capturas y dependencias temporales no forman parte de la app publicada.
