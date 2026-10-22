# FORMA: banking pilot and staged financial services

## Current release and boundaries

FORMA has a private owner-only, read-only banking pilot. It validates the independent FORMA user/session/owner role on every server request. Personal budgeting, institutional services/enrollments/cash and bank connections remain distinct domains. No Eleva authentication, database, keys, bank connections or customer records are used.

The pilot reads accounts and the last 30 days of transactions, stores only encrypted connection references, and leaves personal budgets and institutional cash unchanged. It supports resuming a pending authorization, examining accounts and transactions and deleting a verified connected Item. It is not a student bank rollout or a money-moving service. No card issuance, credit decisions, custody, invoice collection or PIX initiation is activated.

The new owner-only preflight verifies preparation and authenticates against Pluggy, then counts eligible Brazilian personal Open Finance OAuth connectors supporting ACCOUNTS and TRANSACTIONS. It consumes the existing read quota and never creates an Item, consent or Connect Token. Catalog visibility is not proof of commercial approval, trial duration, successful bank authentication or billing entitlement. The production environment flag still gates live authorization. The extension reported by the owner was granted on 21 October for seven days; its exact end date/time must be confirmed with the provider, not inferred or hard-coded.

Specific Pluggy HTTP behavior now lives in `server/providers/pluggy.js`. This is a server transport boundary, not an authorization service. It uses a fixed provider host and the supplied bounded transport; API keys stay server-only and scoped to a request. The existing banking domain continues to own user identity, consent, authorization, encrypted references and resource ownership. A later provider adapter must implement the domain's operations and pass its ownership/security tests; replacing a URL is insufficient. Existing connections and provider-held history are not assumed portable.

## Practical owner acceptance

1. In personal FORMA open Administración → Conexión bancaria → Prueba tu conexión paso a paso.
2. Revisar preparación must confirm storage and vault key. Do not regenerate an existing vault key while a connection is active.
3. Comprobar acceso a bancos reales should authenticate and list compatible institutions. This creates no bank connection. A missing production flag is reported separately from provider visibility.
4. The owner enables `FORMA_BANK_PILOT_ENABLED=owner-openfinance-v1` in the dedicated FORMA Vercel project after confirming provider trial entitlement, then redeploys. Never change an Eleva project's variables.
5. Finish/disconnect a connected Sandbox test before changing mode; resume a pending test in its original mode. Pending attempts cannot be silently discarded if the provider authorization may still exist.
6. Select Mi banco, authorize private read-only consultation, and complete the bank's consent flow personally. No bank password is submitted to FORMA.
7. Compare bank/account identity, available balance, movement dates/signs, at least two purchases and a transfer, credit-card balances and pending entries. Card debt is not cash. Descriptions may themselves contain personal data; keep them private.
8. Test refresh, sign-out/re-entry, interrupted request recovery, transaction pages, duplicate rows and revoked/expired consent. A network failure must not be reported as an empty account, zero balance or completed import.
9. Compare actual connected accounts and billed usage in the provider dashboard. The number of account/card products returned by one Item is not a certified invoice count.
10. Desconectar prueba must delete the verified remote connection and revoke the local reference; inspect the bank's consent view as well. Disconnect remains available while live reads are paused.

These are acceptance criteria, not claims that a real bank has passed them. Tests with mocked provider data and a local database do not substitute for this owner acceptance.

## Stages and release criteria

| Stage | Deliverable | Release criterion |
|---|---|---|
| Private bank pilot | Owner consent, accounts, movement preview, recovery and revocation | Owner acceptance with a real bank; provider conditions known |
| Personal budget import | Explicit staged import, source references, duplicate handling, editable categorization | Imports retried without duplicates; transfers and card invoice payments not double-counted; existing manual records preserved |
| Small student cohort | Per-user consent and links; support; visible sync status; cost control | Automated cross-user authorization tests; individual bank data unavailable to staff; consent/retention terms; monitored provider costs |
| General read-only production | Reliable updates, queue/retry controls, signed webhook ingestion, reconciliation and recovery | Provider contract and responsible parties established; restore test; incident process; operational/load validation |
| Institutional payments | Separate merchant accounts, confirmed payments and student receipts | Server verifies provider settlement; duplicate/reordered webhooks cannot duplicate receipts; institutional money remains distinct from personal finances |
| Partner-issued cards | Separate issuer adapter, card lifecycle, disputes, limits and statements | Authorized issuing partner and formal product approval; defined responsibility for credit, KYC, fraud, collections and support; reviewed accounting/security model |

A card project is a future initiative requiring partner selection, product terms and acceptance criteria. This release does not establish licensing, certification or approval to offer cards or credit. A FORMA-branded interface may be considered with the partner; do not advertise an unavailable product in the current student app.

## Domain and data design for subsequent implementation

- Identity: independent FORMA session; server-assigned subject and membership. A role or client-provided person ID cannot grant bank-data access.
- Personal finance: budgets, categories, goals and manual movements owned by the individual. Imported entries retain provider, link, account, external transaction ID, source dates, currency, original values and processing status. Preserve the original source rather than overwriting it when categorization changes.
- Banking: per-user links and encrypted references, consent scopes, validity, last successful update, data provenance and revocation. Public UI receives a stable FORMA abstraction rather than provider secrets.
- Institutional operations: contacts, services, enrollments, accounts receivable, staff duties and receipts. Staff should see institutional payments and aggregate app-usage measures; personal banking histories require a separately justified, consented design rather than expanding an administrative role.
- Payment/issuer domains: separate partner credentials, external identifiers, signed webhook verification, unique event IDs, idempotent state transitions, refunds/reversals and reconciliations. A button click or uploaded payment notice is not a settled payment.
- Money custody/card accounting: assess an immutable double-entry ledger and reconciliation with the partner before money movement or card balances are represented as authoritative. The current manually recorded institutional cash report is not that ledger and must not silently become one.
- Operations: independent environments; server-only secrets; documented key rotation; backup/restore exercises; redacted logs; deadlines, retry/backoff, limits and operational alerts. Build each of these when the corresponding domain is implemented and verified; a roadmap is not a completed control.

## Commercial baseline provided by the owner

Letícia's message on 21 October quotes R$2,500/month for 500 connected bank accounts, with R$2.75 per additional account. One user with three connected accounts consumes three connections under that quotation. Written clarification is still needed for cards, disconnected accounts, renewal/reconnection, active-vs-created monthly counting, API/sync limits and taxes. Do not substitute API Item counts or account-list counts for those contractual rules. Assess the cost per active learner and negotiate an educational cohort before subscribing at scale.

## Verification

API tests cover strict origin/owner/session isolation, minimal product scope, secure references, quota checks, preflight without connection creation, paused live access, minimized previews and disconnect retries. UI tests cover setup gating, explicit preflight, no implicit live enablement, protected connection flow, recovery, logout cleanup and no budget writes. Re-run the existing banking database installer checks without touching production data. Real browser/bank OAuth and commercial entitlement remain owner/provider acceptance.
