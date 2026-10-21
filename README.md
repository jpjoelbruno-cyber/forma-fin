# FORMÁ Financiero

Aplicación personal y educativa: https://forma-fin.vercel.app/.

FORMÁ utiliza exclusivamente el proyecto Supabase `irsuevjqmgpwunvymxbc` (FORMA Personal Independiente), autenticación Google propia y claves de sesión independientes. Eleva Taller y Eleva Modas no participan en este acceso. Los registros históricos del proyecto compartido no se consultan desde esta aplicación y se conservan hasta verificar recuperación y respaldo.

JavaScript, HTML y CSS, Supabase Auth/PostgreSQL con RLS; despliegue Vercel desde GitHub. `?vista=ejemplo` muestra únicamente datos ficticios sin guardar. La conexión bancaria y `/api/pluggy-token` permanecen deshabilitadas.

Estado y activaciones manuales: [correcciones de auditoría](AUDIT-CORRECTIONS-2026-10-09.md). Nunca ejecutar una migración de FORMÁ en proyectos de Eleva.

Pruebas: `node --test tests/security/*.test.cjs tests/security/*.test.mjs tests/*.test.cjs`.

### Private bank-provider diagnostic (2026-10-20)

In the personal app, Joel can open Administración → Conexión bancaria · Pruebas and explicitly check the deployed Pluggy credentials. `/api/pluggy-check` validates the independent FORMA user and the live owner role via `forma_agenda_access`, then authenticates server-side and checks for an `isSandbox: true` connector. It returns booleans and a timestamp, never credentials or an API key. `/api/pluggy-token` stays disabled. This diagnostic does not connect an Item, read financial data, import transactions or enable real banks.

See [BANK-SANDBOX-STATUS-2026-10-20.md](BANK-SANDBOX-STATUS-2026-10-20.md) for verification and remaining work.

### Private owner banking pilot (prepared, activation required)

The personal Administration banking tab now also has a separate read-only pilot: bank-pilot.js, /api/bank-pilot and bank-pilot-setup.sql. It supports fixed Sandbox and gated owner-only real Open Finance authorization, encrypted connection references, account/transaction preview, provider auto-sync pause and explicit disconnect. It never imports into budgets or institutional cash. Production DB installation, a private vault key and provider confirmation/live activation are still required. See [BANK-PILOT-2026-10-20.md](BANK-PILOT-2026-10-20.md) for architecture, prerequisites, recovery and test limits. The legacy /api/pluggy-token remains disabled.

### Install FORMA (2026-10-21)

Open https://forma-fin.vercel.app/ in a normal browser and use Instalar; iPhone/iPad instructions are included. The same PWA retains current FORMÁ accounts and permissions, with a Gestão shortcut. Internet is required for financial data; no offline writes or authenticated-page caching are introduced. See [INSTALLATION-2026-10-21.md](INSTALLATION-2026-10-21.md) for device acceptance tests and delivery limits.
