# FORMÁ: acceso automático con Google y correo confirmado

Preparado y probado el 12 de octubre de 2026. Pendiente de activación manual por el propietario; no se ha modificado producción.

## Recorrido

Google: elegir cuenta → identidad verificada → entrar como alumno.
Correo/contraseña: crear cuenta → abrir el correo de confirmación → entrar → acceso automático como alumno. En próximas visitas se usa correo/contraseña; no requiere autorización del propietario. La recuperación de contraseña conserva su flujo por email.

La confirmación de correo está habilitada en la configuración pública de Auth consultada: `mailer_autoconfirm=false`, email y Google habilitados. No se ha cambiado SMTP y no se ha verificado entrega real de confirmación/recuperación. Sin confirmar el correo, la cuenta nueva no recibe acceso automático. Cualquier persona que reciba el enlace y cumpla estos requisitos puede registrarse; confirmar identidad no demuestra pertenencia a una clase.

## Activación por el propietario

1. Supabase → **FORMA Personal Independiente**, proyecto `irsuevjqmgpwunvymxbc`.
2. SQL Editor → New query → pegar todo `automatic-account-access.sql` → Run.
3. Debe devolver `acceso_automatico_google_y_correo_instalado=true`.
4. No ejecutar después el archivo antiguo `automatic-google-access.sql`: es la modalidad anterior de solo Google. Si ya lo ejecutaste, este archivo lo sustituye sin borrar datos.
5. Validar una cuenta de prueba real por cada método: registro, confirmación, ingreso, guardar/recargar un presupuesto propio. No debe ver administración. Una cuenta sin confirmar debe quedar fuera. Estas pruebas no están sustituidas por las pruebas de PostgreSQL.

El servidor utiliza la API existente y no necesita nueva publicación de la app para aplicar la regla. Los textos antiguos sobre aprobación manual se ajustarán tras confirmar activación; no cambian permisos de servidor.

## Protección

Solo se activa el usuario actual con sesión válida del proyecto independiente, correo confirmado y método de autenticación verificado en el JWT firmado. Para correo se comprueba identidad email o contraseña configurada en Auth. No se confía en user_metadata para autorizar; los metadatos editables solo proporcionan el nombre visible.

No hay aprobaciones masivas. Los pendientes pueden volver a entrar por el método válido; se registra su activación una sola vez. Las restricciones manuales se conservan. Cuentas baneadas, anónimas, tokens de otros proyectos y sesiones erróneas/caducadas son rechazados. No se crea ningún administrador, se modifican políticas financieras ni se toca Eleva Taller/Eleva Modas.

## Verificación aislada

20 comprobaciones sobre PostgreSQL desechable, incluyendo Google, correo/contraseña confirmado, confirmación de registro, Google con contraseña añadida, bloqueo del correo sin confirmar aun con metadatos falsos, idempotencia, propietarios, sesiones y administración. Se instala el SQL dos veces. Sin cuentas, claves ni registros financieros de alumnos.

`FORMA_PGLITE_MODULE=/ruta/a/@electric-sql/pglite/dist/index.js node tests/security/automatic-account-access.mjs`
