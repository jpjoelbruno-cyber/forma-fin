# FORMÁ Financiero

Aplicación personal y educativa: https://forma-fin.vercel.app/.

FORMÁ utiliza exclusivamente el proyecto Supabase `irsuevjqmgpwunvymxbc` (FORMA Personal Independiente), autenticación Google propia y claves de sesión independientes. Eleva Taller y Eleva Modas no participan en este acceso. Los registros históricos del proyecto compartido no se consultan desde esta aplicación y se conservan hasta verificar recuperación y respaldo.

JavaScript, HTML y CSS, Supabase Auth/PostgreSQL con RLS; despliegue Vercel desde GitHub. `?vista=ejemplo` muestra únicamente datos ficticios sin guardar. La conexión bancaria y `/api/pluggy-token` permanecen deshabilitadas.

Estado y activaciones manuales: [correcciones de auditoría](AUDIT-CORRECTIONS-2026-10-09.md). Nunca ejecutar una migración de FORMÁ en proyectos de Eleva.

Pruebas: `node --test tests/security/*.test.cjs tests/security/*.test.mjs tests/*.test.cjs`.
