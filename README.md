# FORMÁ Financiero

Aplicación personal y educativa: https://forma-fin.vercel.app/.

FORMÁ utiliza exclusivamente el proyecto Supabase `irsuevjqmgpwunvymxbc` (FORMA Personal Independiente), autenticación Google propia y claves de sesión independientes. Eleva Taller y Eleva Modas no participan en este acceso. Los registros históricos del proyecto compartido no se consultan desde esta aplicación y se conservan hasta verificar recuperación y respaldo.

JavaScript, HTML y CSS, Supabase Auth/PostgreSQL con RLS; despliegue Vercel desde GitHub. `?vista=ejemplo` muestra únicamente datos ficticios sin guardar. La conexión bancaria y `/api/pluggy-token` permanecen deshabilitadas.

Estado y activaciones manuales: [correcciones de auditoría](AUDIT-CORRECTIONS-2026-10-09.md). Nunca ejecutar una migración de FORMÁ en proyectos de Eleva.

Pruebas: `node --test tests/security/*.test.cjs tests/security/*.test.mjs tests/*.test.cjs`.

### Private bank-provider diagnostic (2026-10-20)

In the personal app, Joel can open Administración → Conexión bancaria · Pruebas and explicitly check the deployed Pluggy credentials. `/api/pluggy-check` validates the independent FORMA user and the live owner role via `forma_agenda_access`, then authenticates server-side and checks for an `isSandbox: true` connector. It returns booleans and a timestamp, never credentials or an API key. `/api/pluggy-token` stays disabled. This diagnostic does not connect an Item, read financial data, import transactions or enable real banks.

See [BANK-SANDBOX-STATUS-2026-10-20.md](BANK-SANDBOX-STATUS-2026-10-20.md) for verification and remaining work.
