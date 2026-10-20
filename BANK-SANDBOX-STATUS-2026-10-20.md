# FORMA: provider diagnostic, not a bank connection

## Delivered
- Private owner-only diagnostic in personal Administration, Conexión bancaria · Pruebas.
- POST /api/pluggy-check with exact origin, fixed independent Supabase project, authenticated user matching the designated director and database-verified current owner role. The existing forma_agenda_access RPC checks issuer, active session, access and staff membership. Fail closed if unavailable.
- Reads PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET only from server environment; no browser storage or response contains them. Deployment must reload updated environment values.
- Only Pluggy POST /auth and GET /connectors?sandbox=true are called. A strict isSandbox boolean determines availability. No Item is created; no bank financial data is fetched or written. No schema migrations. No changes to René records, budgets, CRM or accounting.
- Provider errors are mapped to fixed, non-secret messages. No raw provider responses or credentials logged. Browser ignores delayed responses after user/session changes.

## What the result proves
A successful manual check proves the deployed server credentials were accepted by Pluggy at that time and whether the connector response included a Sandbox connector. It does not verify the application display name, the contracted plan, a real bank connection, consent, import correctness or provider exclusivity. The user must ensure the copied credentials belong to FORMA Conecta.

## Live acceptance
Owner signs in at https://forma-fin.vercel.app/ (not the example view), opens Administración → Conexión bancaria · Pruebas → Comprobar conexión de prueba. No credentials are entered in FORMA. Success explicitly says no account is connected yet. Missing credentials require checking the existing Production environment values and a new deployment. Authentication or connector permission errors require checking the provider application and its enabled plan without automatically subscribing.

The assistant can verify deployed files and unauthenticated rejection, but cannot run the authenticated owner check without the owner session. No successful live authentication is claimed by publication alone.

## Remaining before bank use
1. Sandbox-only connection creation and isolated test persistence; server-enforced connector allowlist, scoped token/Item ownership, cleanup and non-production fixtures.
2. Consent and revocation, encrypted provider-token handling where needed, minimal scopes, export/deletion and retention policy.
3. Authenticated webhook delivery according to provider contract; replay protection, idempotent imports, pagination, duplicate/reversal handling and restore drills.
4. Provider plan and production entitlement review, privacy/security audit and controlled real-bank pilot authorized separately.

Real-bank and import controls stay false; /api/pluggy-token remains hard-disabled with 503. This is not a completed security certification.

## Validation
- node --test tests/security/pluggy-check.test.mjs tests/security/pluggy-admin.test.cjs
- node --test tests/security/*.test.cjs tests/*test.cjs
- Node syntax checks; production deployment and rejection checked separately after release.

## Primary API references
- https://docs.pluggy.ai/en/docs/authentication
- https://docs.pluggy.ai/en/reference/connector/connectors-list
