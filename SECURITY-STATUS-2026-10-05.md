# FORMÁ — voice registration and isolation status

## Published pilot behavior

- Phrase registration in Spanish/Portuguese, deterministic category matching to the existing personal budget, local calendar date, explicit review before save. Missing/ambiguous amounts require clarification. Own-account transfers are not recorded as income/expense.
- Browser speech recognition is the available basic option. Advanced recorded-audio transcription is implemented but disabled until `OPENAI_API_KEY` is securely configured in Vercel. No recognition accuracy guarantee; no real microphone/accent test has been completed.
- Corrections include category, amount, date, description and income/expense. Voice corrections update the existing ID. New writes use `forma_save_movement`, a client UUID and a server read-back. Retries reuse the UUID, and a different payload cannot replace a pending write.
- Expense and income histories are separate, with groups from the personal-budget taxonomy, totals, percentage bars and expandable records.
- Supabase JS 2.117.2 is vendored with a SHA256 manifest. Application scripts and event handlers are external and compiled; CSP allows self-hosted scripts without inline/eval permissions. No bank integration is enabled.

## Isolation

Dedicated project `irsuevjqmgpwunvymxbc` (FORMA Personal Independiente) was created in the existing organization `ofahiffksmzajbtyyhmr`, region `sa-east-1`. Supabase returned an incremental project cost of USD 0/month at creation; this is not a promise about future usage charges.

Only FORMÁ tables, policies and functions were installed. No ELEVA tables, checkout, support functions, production services or app roles were copied. New project has its own signing keys. The deny-all private evidence/quota tables intentionally have RLS without client policies and no direct client grants. Access is through guarded private functions only.

**Production still uses the original shared project `ipcqlltatvpvrqceqiox`.** Dedicated Google OAuth, migration and cutover have not been completed. The original student budgets remain there. Do not point `config.js` at the empty project before the following conditions pass.

On 2026-10-05, after the owner explicitly authorized the narrowly scoped change, migration `forma_stop_shared_automatic_profile_creation` removed ONLY `on_forma_user_created` from the shared `auth.users`. Catalog verification reports zero matching triggers. A transactional synthetic signup test confirms that shared Auth signup no longer creates a FORMÁ profile, while an authenticated explicit FORMÁ own-profile insert still works. All synthetic test rows rolled back. Existing accounts, profiles, budgets, and other-app rules/data remain untouched. This containment does not establish independent authentication; production still uses shared Auth.

The earlier export proposal including hashed credentials and sessions was rejected and never executed. Do not retry that scope. Migration is limited to FORMÁ records and needs an authenticated, verified account mapping in the dedicated project before any records are attached. No passwords, sessions or other-app permissions are to be copied.

### Aggregate audit after the reported incident

Snapshot before containment: 122 FORMÁ profiles, versus the earlier reported 103 (+19); 20 profiles were created on October 5 in the Brazil calendar day. 106 profiles had neither recorded FORMÁ entry nor saved positive budgets, movements, goals or learning. Seven accounts had recorded FORMÁ entries. 80 profiles had a Taller owner/member relationship, including 70 without FORMÁ evidence and 10 with FORMÁ evidence. Fifteen non-administrator accounts had FORMÁ entry or saved-data evidence. 107 profile timestamps were within one second of Auth account creation, consistent with the former automatic trigger. These overlapping measurements are not additive. None proves a browser redirect, acquisition source, or that all accounts are unique real people. Origin evidence is supplementary, not cryptographic app authentication. No individual financial or credential data was exposed in this aggregate audit.

Browser access to the dedicated Google configuration currently encounters Supabase sign-in. The connector exposes database operations but not provider configuration; secure administrator sign-in and a dedicated OAuth client credential are still required. Do not switch the production config to the empty project or change the shared project default Site URL to fix FORMÁ, since that can disrupt other apps.

## Cutover conditions — not yet satisfied

1. Configure a dedicated Google OAuth client/provider and the FORMÁ redirect in the new project. The user must enter new authentication credentials securely, not in chat. Check actual browser login and recovery.
2. Obtain explicit approval for a narrowly scoped transfer of FORMÁ budgets, movements, goals and learning. Do not export passwords, refresh tokens, MFA factors, OAuth secrets, other-app metadata or actual Auth sessions. Define and verify a per-account mapping after authenticated Google entry, before attaching any financial records.
3. Compare counts and row checksums per account, preserve record IDs and goal references, reconcile writes made during preparation, verify restore from the protected snapshot. Retain the source during migration.
4. Provision the owner-only admin membership in the new project through server management after verifying the owner's new identity. Never grant admin based on editable user metadata.
5. Verify Google login, save/read-back, logout/relogin, a second device, and rejection of original-project JWTs. Update public configuration and CSP to allow only the dedicated project. Remove legacy configuration only after recovery is verified.
6. DONE: removed only the original FORMA automatic registration trigger with explicit owner authorization; synthetic rollback test passed. Complete independent Auth and revoke old FORMÁ financial access only after migrated records and recovery are verified.

## Voice deployment

Vercel server variable `OPENAI_API_KEY` is required for advanced transcription; no credential is committed. The backend derives the active Supabase URL and public key from the deployed public `config.js`, unless explicit `FORMA_SUPABASE_URL` and `FORMA_SUPABASE_PUBLISHABLE_KEY` are configured. Keep them consistent during cutover. Production-origin checks supplement authenticated ownership; they are not cryptographic proof of browser provenance.

The endpoint validates Auth, checks a live matching session through a quota RPC, bounds audio payloads to 2 MiB, limits 40 claims/16 MiB per user per Brazil day, and uses a provider timeout. The UI records at most 20 seconds, requires microphone permission and explains external processing. Audio is not persisted by FORMÁ; provider retention must be reviewed before enabling advanced processing. The text parser can also be used without sending audio. Personal alias preferences are a future extension, not a currently persisted learner model.

## Tests

45 Node checks pass (including five enrollment gate checks): budget saves, goal progress, verified-entry guards, Spanish/Portuguese parsing, ambiguity and transfer handling, movement retries/read-back/session changes, same-ID voice corrections and transcription boundary responses.

Dedicated database rollback suites pass: 26 owner/anonymous/foreign-account RLS checks, 22 administration checks, verified-entry live-session/origin/privacy checks, and movement/voice-quota ownership/validation/deduplication checks. The movement/quota suite also passes on the original project. All synthetic fixtures roll back.

Advisor on the dedicated project reports no WARN entries; six INFO entries correspond to intentionally deny-all private tables. This is limited testing, not a penetration-test or banking approval. The shared project's unrelated privileged-function warnings are still outside this implementation.

## Bank readiness

`api/pluggy-token.js` remains hard-disabled (503). Never return provider secrets to clients. Before real banks: complete isolation, select an authorized integration provider, implement server-only connection ownership and consent/revocation, authenticated signed webhooks, idempotent import with pagination, encrypted token storage, strict session/admin controls, data export/deletion, restore drills and adversarial sandbox tests. No banking secrets or tokens were installed in this work.

## 2026-10-06 — reversible access cleanup

Applied `forma_reversible_enrollment_validation` to the original and dedicated projects. The current original-project registry contains 17 active accounts (16 non-administrator accounts with entry or saved FORMÁ evidence, plus one existing administrator) and 106 pending-validation accounts. Initial activation conservatively preserves any existing budget row, goal event or educational record. This is evidence of use, not proof of enrollment or a unique person. No account is classified by having a Taller relationship alone.

The pending list is excluded from active-user reporting. Seven additional restrictive policies on FORMÁ-owned tables deny pending accounts profile/financial/learning/usage reads and writes. Entry attestation and voice quota also check the registry. Private tables have deny-all RLS and no direct client grants; only guarded functions can inspect/update them. Caller-bound status can request access but never self-activate, including via editable user metadata. New requests remain pending; the FORMÁ administrator can validate a specific matching student/reference from Administration → Accesos. Activation is idempotent and audited. Existing shared Auth users and all Eleva/Taller accounts and permissions remain intact. No global sign-out was issued.

Server-side fixture suites passed on both projects: pending read/write denial, prevention of self-activation, anonymous denial, private-table denial, active own CRUD and foreign-row denial, owner-only roster and restoration, audit deduplication and preservation of restored records. Synthetic fixture rows rolled back. Financial record counts and database-derived content digests were identical immediately before and after cleanup: 185 budget rows, six transactions, two goals, zero goal events and zero learning records. This is a point-in-time check; subsequent student writes can legitimately change those counts. Existing rollback suites now explicitly enroll their synthetic test users before checking ownership rules.

Production remains on the shared project. This enrollment containment DOES NOT separate JWT issuers or Google authentication. Dedicated Google provider credentials and admin dashboard access are still missing; no real records were migrated. Do not switch production to the empty dedicated database. No automatic credential prompt will be left waiting without the owner's understanding and readiness. The next step is secure admin access, dedicated FORMÁ OAuth configuration, verified per-account migration and actual cross-project-session rejection tests.

## 2026-10-06 — independent Google cutover release

Google is enabled in dedicated project `irsuevjqmgpwunvymxbc`. The owner completed a real Google login through `/acceso-forma.html`; server-side comparison of the verified Google identity matched the original FORMÁ administrator. The new owner UUID is distinct. Exactly one admin membership was provisioned in the dedicated project; no permissions for Eleva/Taller were transferred.

The production release pins frontend and transcription authentication to this dedicated project, uses a separate `forma-independent-auth-v1` PKCE storage key, returns OAuth only to `https://forma-fin.vercel.app/`, and requests only basic identity scopes. The CSP no longer allows the original project. Password forms are hidden; Google is the student entry point. Banking remains disabled.

A private, deny-all recovery table holds 18 narrowly scoped FORMÁ packages: 17 previously active accesses plus one financial owner without a FORMÁ profile. Source records total 185 budget rows, six movements and two goals. Every package passed the SHA256 content-integrity comparison after transfer using exact JSON text to preserve decimal representations. No Auth user records, password hashes, session credentials, Google secrets, other-app roles or other-app records were copied. Only server-verified Google identity fingerprints accompany these FORMÁ records.

Four packages require assisted verification: three previous accesses without a verified Google identity and one financial owner without validated FORMÁ access. They remain private and unassigned. Fourteen previously enabled Google identities may restore their own package at authenticated entry; the owner's package has already been claimed. This is not 18 new users or 18 verified student entries. Financial data for accounts that have not yet signed in remains staged, not attached to speculative target accounts.

Recovery requires a live session in the dedicated project and a matching server-side Google identity. Caller-editable metadata, email matching alone, and a caller-supplied old ID cannot choose a package. Restoration retains record IDs, remaps only ownership to the verified new account, checks restored content, locks and records the claim, and does not overwrite subsequent edits. A conflict fails atomically; a retry after success returns without replacing rows. New unrelated users remain pending validation. The owner can see restored / awaiting Google / assisted-review counts in Administration → Accesos.

The original FORMÁ financial tables were frozen before the consistent snapshot. The release's `source-cutover-lock.sql` closes authenticated reads/writes on the original nine FORMÁ tables and revokes execution of seven FORMÁ public RPCs. It preserves the source records and does not revoke other-app sessions, alter shared OAuth settings, or change other-app tables/policies. Apply only after successful independent deployment; the managed rollback file requires reconciliation of independent writes before restoring the old app.

Validation: 51 Node checks passed, plus dedicated rollback suites for recovery, ownership, administration, movement save/read-back and verified-entry/session tracking. The recovery suite covers foreign session denial, metadata spoofing, private snapshot denial, anonymous denial, preservation of amounts/IDs, idempotent recovery, preservation of subsequent budget edits and atomic conflicts. Only synthetic fixture rows were modified by tests and rolled back. Real Google login was verified on the dedicated test route; a real student login and device save/relogin check in the complete production app remain to be exercised by the owner/students.

Dedicated security adviser shows seven INFO notices for intentionally deny-all private tables and one WARN for leaked-password protection disabled in Auth. The product entry uses Google; this report is not a banking security certification. The original project's unrelated warnings remain outside scope. Google Cloud is still in Testing; Google's official audience documentation exempts requests limited to basic name/email/profile identity scopes from the test-user restriction. Provider redirect inspection confirmed the FORMÁ client ID, dedicated Supabase callback and only basic identity scopes. Publish/brand review remains a follow-up for public presentation.
