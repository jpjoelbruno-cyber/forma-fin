# Acceso automático con Google — FORMÁ independiente

Preparado y probado el 12 de octubre de 2026. **Pendiente de ejecutar por el propietario en producción.** No se han aprobado usuarios ni modificado la base real.

## Activación

1. En Supabase seleccionar **FORMA Personal Independiente**, ID `irsuevjqmgpwunvymxbc`.
2. SQL Editor → New query. Copiar completo `automatic-google-access.sql` y pulsar Run.
3. El resultado final debe mostrar `acceso_google_automatico_instalado = true`.
4. Un alumno abre `https://forma-fin.vercel.app/` y pulsa Continuar con Google. Si ya estaba en pantalla pendiente, vuelve a intentar o cierra y entra con Google.
5. Verificar con un Google de prueba: entra como alumno, guarda/recarga un presupuesto propio y no ve administración. No se crean datos ficticios en las cuentas reales desde la prueba automatizada.

El cambio de servidor utiliza la API existente: no depende de una nueva publicación de la app. El aviso inicial de validación manual del HTML actual queda pendiente de ajustar tras confirmar la activación; no representa la regla nueva del servidor.

## Regla

La cuenta actual debe tener sesión activa en el Supabase independiente, correo confirmado, identidad Google registrada por Auth y método OAuth en el JWT firmado. Solo ese usuario se activa y se añade una entrada al registro de auditoría. Los pendientes antiguos también pueden activarse al volver a entrar válidamente con Google; no se actualizan en bloque. No se usa user_metadata para autorizar. Nombre visible limitado a 120 caracteres.

Las cuentas activas conservan su acceso. Entradas por correo/contraseña sin aprobación previa siguen pendientes; el pedido actual es acceso automático por Google. Se respetan restricciones manuales con motivo distinto de `explicit_access_request`/`initial_evidence_review`. Cuentas baneadas, anónimas, sesiones inválidas/caducadas y tokens de otros proyectos se rechazan.

La administración sigue limitada por `forma_admin_members`; no se añaden miembros. Se conservan las políticas de propietario y las tablas financieras. No se modifica Eleva Taller ni Eleva Modas, ni se conecta con bancos.

Con acceso automático, cualquier persona con una cuenta Google que obtenga el enlace puede registrarse. Esto valida identidad, no pertenencia a una clase. Si se necesita limitar por alumnos, puede añadirse un código de invitación de curso sin aprobación individual.

## Pruebas

16 comprobaciones de PostgreSQL desechable: acceso de la propia sesión, activación única/idempotente, sin aprobación de otros usuarios ni escalada administrativa, contraseñas/metadatos falsos, otro emisor, sesión errónea/caducada, cuenta baneada/no confirmada, bloqueo manual y anonimato. Se aplica el SQL dos veces para comprobar idempotencia.

`FORMA_PGLITE_MODULE=/ruta/a/@electric-sql/pglite/dist/index.js node tests/security/automatic-google-access.mjs`

Referencia oficial consultada: Supabase JWT Claims Reference y User sessions. El cambio de cifrados TLS de noviembre de 2026 no modifica esta función de acceso en PostgreSQL.
