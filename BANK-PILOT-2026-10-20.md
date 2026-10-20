# FORMA: private, read-only banking pilot

## Scope and current activation state
This release prepares a pilot for Joel only (owner UID 776893e1-f940-437c-94a7-40a83bccc013). It adds no access for students, René or Eleva applications. The user verified live provider credential acceptance and Sandbox availability in the previous diagnostic. That is not proof of real-bank entitlement or of this new end-to-end pilot.

No production SQL has been run by the assistant. The owner runs the additive installer in the independent FORMA project. Live access remains blocked until prerequisites below are completed. No successful real-bank connection is claimed by release.

The pilot reads a snapshot of accounts and the last 30 days of transactions. It does not import them into budgets, goals, student financial records, institutional cash, CRM, or reports. It does not initiate payments, Pix, transfers or investments. Bank connection references are encrypted; financial preview data is not persisted by FORMA. Pluggy stores the connection/data under its own service terms and the bank consent remains governed by the provider/bank.

## Architecture
- Browser → POST /api/bank-pilot → fixed independent Supabase Auth and live owner-role RPC → fixed Pluggy API host.
- Exact same-origin requests and bearer required. No generic HTTP proxy, arbitrary owner, connector or Item retrieval accepted.
- Owner UID is pinned, and public.forma_agenda_access checks independent JWT issuer, live session, account access, bans and current role. New banking RPC repeats that authorization and checks Origin independently.
- Private schema: bank_pilot_links and bank_pilot_limits, RLS enabled, all direct public/anon/authenticated table privileges revoked. Invoker public RPC delegates to an explicitly authorized definer in private schema with empty search_path. No new service-role secret needed.
- Provider Item reference encrypted using AES-256-GCM, random IV and fixed application AAD, bound to owner/link/mode. Key is a separate FORMA_BANK_VAULT_KEY server variable, never returned by an API.
- Each attempt uses server HMAC identity in Connect Token options.clientUserId. Browser-provided Item ID is fetched from provider and must match the expected marker and allowed connector before use. A stored encrypted reference by itself cannot authorize a foreign Item. Tampered or copied ciphertext fails closed.
- Scoped temporary Connect Token is the only provider token exposed to widget. Default options and widget request only ACCOUNTS and TRANSACTIONS. Widget-side filters are not treated as a security boundary: server verifies ownership and connector on every access.
- Sandbox fixed to fictitious connector 2. Live requires Brazilian PERSONAL_BANK with isSandbox=false, isOpenFinance=true and oauth=true. No password-style live connectors are accepted by the server.
- One active connection per owner; at most six connection starts and 60 reads per Sao Paulo day. Quotas use database transaction locking and are committed before token/provider calls.
- Requests have per-call and total deadlines and refuse redirects. Provider secrets/errors are never logged or relayed. Raw CPF, account numbers, account-owner and paymentData fields are excluded from preview response. Descriptions can themselves contain personal information; preview remains owner-only.
- Transactions use /v2/transactions and sealed expiring cursors bound to account/link/owner. Account membership is verified from the Item account list. Repeated rows are rejected within provider pages and deduplicated across displayed pages. No transaction importer exists in this release.
- Provider auto-sync is checked/disabled after binding and before preview. Pause failure is shown rather than claiming success. Last provider update time is displayed; refreshing the UI is not a bank resynchronization.
- Disconnect deletes the exact verified/encrypted Item in Pluggy, then marks only the pilot reference revoked and clears its ciphertext. Failed deletion never marks disconnected. Retry after remote deletion succeeds with provider 404 and retries DB revocation.

## Owner activation, one step at a time
1. In personal FORMA → Administración → Conexión bancaria · Pruebas → Prueba tu conexión paso a paso → Preparación del piloto, copy the banking update and run it in https://supabase.com/dashboard/project/irsuevjqmgpwunvymxbc/sql/new. Installer checks designated FORMA owner identity and existing session-validation function. Do not run it in Eleva projects.
2. Use Generar y copiar clave privada; paste the generated 32-byte base64url value privately into Vercel project forma-financiero.vercel.app, Production variable FORMA_BANK_VAULT_KEY. It is generated in browser memory and copied to clipboard, not displayed, sent to chat or saved in local/session storage. Keep it in the institution's secret manager. Never replace an existing key while a connection is active. Redeploy after env edits.
3. Review preparation and run Sandbox with the public fictitious credentials user-ok / password-ok. Verify accounts, transactions, paging, provider update time, logout/relogin and disconnect. Confirm no budget or institutional cash records changed.
4. Confirm FORMA Conecta real Open Finance entitlement and costs with Pluggy. Credential acceptance and the presence of bank connectors do not establish the contract, available quota or production approval. Do not purchase/upgrade automatically. If production uses different credentials, replace only FORMA's dedicated PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET, not any Eleva project.
5. After Sandbox validation and provider confirmation, set Production FORMA_BANK_PILOT_ENABLED=owner-openfinance-v1 in FORMA's Vercel project and redeploy. This enables only the designated owner. The server additionally requires explicit provider confirmation and read-only consent from the UI. Confirm the personal bank choice on the provider/bank screen.
6. Inspect your own account snapshot, then test Desconectar prueba and the bank's consent screen. Pause the live flag to block further real reads; disconnect remains available while flag is paused.

## Limits and recovery
- This is an owner pilot, not a security certification, public bank rollout, automatic synchronization or budget importer. It has no webhook receiver, automatic bank refresh or student connections. These require a separate reviewed implementation, privacy/retention policy, operational monitoring and tested restore before general availability.
- There is one active test including pending authorizations. Resume a pending attempt in the same mode; finish and disconnect Sandbox before switching to live. Scoped tokens can expire; restarting creates a new token for the same pending attempt, subject to quota. avoidDuplicates is requested, but backend ownership verification remains mandatory.
- Browser temporarily retains only a pending provider Item UUID in sessionStorage to retry binding after network failure. It is not an authorization credential and cannot bypass server ownership checks. No bank records/tokens are stored there.
- If the browser closes before onSuccess, resume the same pending attempt. If provider completion cannot be recovered, remove/revoke the orphan connection in the FORMA Conecta provider dashboard/bank before administrative recovery. Automatic provider-wide Item enumeration is not used: v2/items is opt-in and cannot be assumed available.
- Unexpected pagination of account listing is rejected to avoid presenting an incomplete list as complete. Connector selection is limited to compatible connectors in the provider response, not a guarantee every institution is available.
- If auto-sync pause fails, the reference may already be stored; refresh state and disconnect or retry attachment. Bank consent can always be reviewed at the bank. Deleting a Pluggy Item and revoking a bank consent are distinct controls; check the bank screen as part of acceptance.
- Snapshot currency/type is preserved; card balances, transfers and income are not aggregated. Pending transactions and vendor categories are displayed as supplied and do not become confirmed income/expense.
- Keep the vault key stable and protected with backups. Removing/rotating it with an active link prevents decryption/owner binding and needs controlled recovery via provider/bank; this pilot has no key-rotation service. Disconnect first. Retain consent metadata according to the institution's policy; ciphertext is cleared on disconnection, not unrelated financial records.
- Environment flags are separate from provider production entitlement. No plugin or deployment can bypass a bank/provider authorization failure.

## Verification performed
- 179 Node unit/security tests including API tests with mocked provider responses.
- PGlite: install twice with exact existing reservation/transaction/user snapshots unchanged; private-table privileges, real sessions, foreign issuer/origin, manager/student/anon rejection, consent, idempotent binding, limits and revocation.
- jsdom: setup and key handling, consent, immediate provider callbacks, account/transaction preview, XSS escaping, cursor/deduplication, disconnect and delayed responses after logout.
- Downloaded pinned SDK evaluated in isolated DOM and interface verified; CDN returned 200 with CORS support and matching SHA-384. Real OAuth popups/cross-origin widget and bank consent still require owner acceptance after setup.
- No real bank credentials, accounts, financial rows or production database were used in automated tests.

## Dependency and API references
Connect SDK pinned to official published CDN v2.7.0 (newer npm v2.14.2 had no matching CDN artifact, so it was not guessed). Dynamic load only on explicit start, with SRI:
sha384-EfJtVYPBw2vssrS8cou8sSUccnxm72OwXqa4V+b1injWH0avP4mtCJr2XM6Sb2/7
CSP adds only its exact script path and the official connect frame origin; no unsafe-eval or new inline-script permission.

Official sources reviewed 2026-10-20:
- https://docs.pluggy.ai/en/docs/authentication
- https://docs.pluggy.ai/en/reference/auth/connect-token-create
- https://docs.pluggy.ai/en/docs/connect-widget/environments
- https://docs.pluggy.ai/en/docs/open-finance/overview
- https://docs.pluggy.ai/en/reference/transaction/transactions-list-by-cursor
- https://docs.pluggy.ai/en/reference/items/items-disable-autosync
- https://docs.pluggy.ai/en/reference/items/items-delete
- https://supabase.com/changelog.md
- https://supabase.com/docs/guides/database/functions
