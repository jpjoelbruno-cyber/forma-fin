# FORMÁ — arreglos rápidos de seguridad (2026-10-24)

Resultado de la auditoría del 24/10/2026. Aplica únicamente al proyecto Supabase `irsuevjqmgpwunvymxbc` (FORMA Personal Independiente). Nunca ejecutar en Eleva.

## Base de datos (aplicada el 24/10/2026, migración `forma_security_quickfixes_20261024`)
- `forma_private.admin_report(integer)` era la única función privada con el permiso de ejecución por defecto (PUBLIC). Ahora solo la ejecuta `authenticated`, igual que sus funciones hermanas. Un usuario anónimo ya no puede llamarla. Antes tampoco podía usarla (la función rechaza sesiones nulas y `anon` no tiene acceso al esquema), así que no hubo cambio visible.
- Se eliminaron los índices duplicados `idx_forma_budgets_user_month` e `idx_forma_tx_user_date`. Quedan sus equivalentes `forma_budgets_owner_month_idx` y `forma_transactions_owner_date_idx`.
- Se añadieron índices para claves foráneas sin cobertura: `forma_goals_user_idx`, `forma_goal_events_goal_idx` y `forma_course_progress_lesson_idx`.
- Script: [security-quickfixes-2026-10-24.sql](security-quickfixes-2026-10-24.sql). Reversa: [tests/security/security-quickfixes-rollback.sql](tests/security/security-quickfixes-rollback.sql).

## Aplicación (`vercel.json`)
- La política CSP `img-src` aceptaba imágenes de cualquier sitio `https:`. Ahora solo permite `'self'`, `data:`, `https://cdn.simpleicons.org` (logos de bancos) y `https://i.ytimg.com` (miniaturas de video).
- La prueba `tests/security/csp.test.cjs` impide que vuelva a abrirse esa política y comprueba que los scripts no admitan `unsafe-inline` ni `unsafe-eval`, que `connect-src` solo apunte a FORMÁ y que el proyecto de Eleva no aparezca en la CSP.

## Pendiente (acciones manuales)
- Activar la protección contra contraseñas filtradas en Supabase Auth (Authentication → Password security). No se puede cambiar desde la conexión usada en esta auditoría.
- Decidir cuándo borrar los restos de FORMÁ que aún están en el proyecto de Eleva (respaldo y borrado en unos 30 días).
