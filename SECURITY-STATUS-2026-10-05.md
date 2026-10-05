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

Automatic approval review rejected (1) removing `on_forma_user_created` from shared `auth.users`, because of possible effects on other apps, and (2) a proposed bulk export including hashed credentials, identities and financial data, because the sensitive scope required explicit authorization. Neither action ran; no export payload was obtained or transferred. `stop-cross-registration.sql` is a prepared, unapplied proposal. Existing profiles and all other-app rules/data remain untouched.

## Cutover conditions — not yet satisfied

1. Configure a dedicated Google OAuth client/provider and the FORMÁ redirect in the new project. The user must enter new authentication credentials securely, not in chat. Check actual browser login and recovery.
2. Obtain explicit approval for a narrowly scoped transfer of FORMÁ budgets, movements, goals and learning. Do not export passwords, refresh tokens, MFA factors, OAuth secrets, other-app metadata or actual Auth sessions. Define and verify a per-account mapping after authenticated Google entry, before attaching any financial records.
3. Compare counts and row checksums per account, preserve record IDs and goal references, reconcile writes made during preparation, verify restore from the protected snapshot. Retain the source during migration.
4. Provision the owner-only admin membership in the new project through server management after verifying the owner's new identity. Never grant admin based on editable user metadata.
5. Verify Google login, save/read-back, logout/relogin, a second device, and rejection of original-project JWTs. Update public configuration and CSP to allow only the dedicated project. Remove legacy configuration only after recovery is verified.
6. Resolve the original FORMA registration trigger through an explicitly approved, minimal change with compatibility checks.

## Voice deployment

Vercel server variable `OPENAI_API_KEY` is required for advanced transcription; no credential is committed. The backend derives the active Supabase URL and public key from the deployed public `config.js`, unless explicit `FORMA_SUPABASE_URL` and `FORMA_SUPABASE_PUBLISHABLE_KEY` are configured. Keep them consistent during cutover. Production-origin checks supplement authenticated ownership; they are not cryptographic proof of browser provenance.

The endpoint validates Auth, checks a live matching session through a quota RPC, bounds audio payloads to 2 MiB, limits 40 claims/16 MiB per user per Brazil day, and uses a provider timeout. The UI records at most 20 seconds, requires microphone permission and explains external processing. Audio is not persisted by FORMÁ; provider retention must be reviewed before enabling advanced processing. The text parser can also be used without sending audio. Personal alias preferences are a future extension, not a currently persisted learner model.

## Tests

40 Node checks pass: budget saves, goal progress, verified-entry guards, Spanish/Portuguese parsing, ambiguity and transfer handling, movement retries/read-back/session changes, same-ID voice corrections and transcription boundary responses.

Dedicated database rollback suites pass: 26 owner/anonymous/foreign-account RLS checks, 22 administration checks, verified-entry live-session/origin/privacy checks, and movement/voice-quota ownership/validation/deduplication checks. The movement/quota suite also passes on the original project. All synthetic fixtures roll back.

Advisor on the dedicated project reports no WARN entries; four INFO entries correspond to intentionally deny-all private tables. This is limited testing, not a penetration-test or banking approval. The shared project's unrelated privileged-function warnings are still outside this implementation.

## Bank readiness

`api/pluggy-token.js` remains hard-disabled (503). Never return provider secrets to clients. Before real banks: complete isolation, select an authorized integration provider, implement server-only connection ownership and consent/revocation, authenticated signed webhooks, idempotent import with pagination, encrypted token storage, strict session/admin controls, data export/deletion, restore drills and adversarial sandbox tests. No banking secrets or tokens were installed in this work.
