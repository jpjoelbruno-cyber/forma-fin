# FORMÁ security audit — 2026-10-01

Scope: original FORMÁ production (forma-fin.vercel.app), GitHub main 462a2b44e95517df49d2f9e1a9aec5d713d485e4, existing Supabase project. No real student financial records were read.

## Verified
- RLS enabled on all six FORMÁ tables.
- 52 SQL assertions passed: the rollback test ran for both synthetic identities. Owner reads and transaction writes succeeded. Cross-user reads, updates, deletes, foreign transaction inserts, foreign-goal contributions, goal-owner reassignment, and self-promotion to teacher were blocked.
- This is a database role/JWT-claim simulation, not two end-to-end browser account tests.
- All synthetic Auth rows and fixtures rolled back; follow-up query found zero remaining synthetic users.
- Six unauthenticated REST read requests returned HTTP 401.
- Production bank-token endpoint returned HTTP 503 and a disabled message, not provider credentials.
- Public Auth settings: Google/email enabled; signup enabled; email auto-confirm enabled.
- Frontend transaction descriptions and goal labels reviewed for HTML escaping. This is code review, not a full penetration test.

## Hardening in this commit
- Block embedding FORMÁ inside other sites (frame-ancestors none / X-Frame-Options DENY).
- Disallow plugin objects and external base/form targets.
- This partial CSP is NOT a strict script policy; inline scripts/event handlers remain.

## Not validated / release blockers
- Google registration/login from actual student devices, including the reported inability to open the link.
- Persisted records after logout/relogin and across devices through UI.
- Backup retention and a tested restoration procedure.
- Email verification policy: auto-confirm is enabled in shared infrastructure; do not change globally without evaluating other apps.
- Unpinned Supabase CDN dependency (@2) and absence of strict script CSP.
- Supabase project currently reports Postgres 17.6.1.155; provider announces rollout of 17.11 security fixes. Upgrade/maintenance planning requires shared-project review, not an automatic production upgrade.
- Advisor returned 15 warnings for authenticated-callable SECURITY DEFINER functions used by other apps and one INFO for a separate allowlist with RLS/no policy. Warnings are not proof of exploitation, but were not reviewed/remediated by this FORMÁ-only test.
- Shared project means tables are logically separated, not physically separate from other apps.

Decision: NOT approved for mass rollout or real bank connections. Controlled small pilot with fictitious data only. No guarantee of absolute security.

References:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes

