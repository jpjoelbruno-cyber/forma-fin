# FORMÁ evidence-based administration

Only the owner-provisioned administrative membership can call the report. Students cannot provision membership or read the private evidence tables. No financial amounts, account locations, emails, or descriptions are exposed in reporting.

The shared Auth trigger and legacy profiles remain unchanged. Blank automatically created profiles never count as FORMÁ users. The report includes only users with an authenticated FORMÁ entry attested by the new RPC or an actual saved FORMÁ budget, movement, goal, or lesson. Administrative accounts are excluded from all student figures. Existing historical records are preserved and labeled as saved-data evidence, not proof of an old login.

`forma_record_access` runs an invoker wrapper around a guarded private function. It checks the authenticated UID, exact FORMÁ Origin header, signed JWT session ID, the current matching Auth session and expiration, and existing FORMÁ profile. Identity, dates, and timestamps come from the server. Clients cannot write evidence tables directly or provide another UID or a timestamp. Repeated visits deduplicate by session and user/day/section.

This verifies an authenticated account/session requesting the FORMÁ endpoint; it does not verify a unique human, enrollment, or intent. An authenticated account holder with custom HTTP software can forge an Origin header; Origin checking is an application-scoping safeguard, not cryptographic attestation of a browser or human. Section names remain client-reported. Optional consultation telemetry waits five visible seconds in the active section before the guarded server write. It is labeled as consultation, not a saved action. Confirmed actions are calculated independently from existing server records.

Entry verification runs only after the authenticated budget/data read completes successfully. Demo mode never emits entry or section telemetry. Consultation tracking can be turned off in Help; necessary authenticated entry confirmation and saved-record evidence are separate.

Three distinct measures: authenticated entries verified since this release; historical saved activity without an attested entry; and active verified users in the selected 7/30/90-day period. Every roster row displays its evidence type, first and last verified entry when available, and saved activity flags. Charts separately show section consultations, saved actions, and daily verified visitors. No historic dates are inferred or invented.

The adoption meter uses accounts with FORMÁ evidence, includes clearly labeled historical saved activity, and is not a financial-health score. Budget preparation requires planned income and expenses in the current month; movements use the selected period; goals and lessons are all-time indicators. Counts represent distinct accounts, not clicks. Staff are excluded.

Validation: verified-entry rollback SQL covers Origin, missing/foreign/expired sessions, anonymous calls, direct write denial, repeated-entry/section deduplication, exclusion of empty other-app profiles and administrators, and absence of sensitive financial fields. Existing autosave/goal tests (14) also passed. Test fixtures roll back. Original 103 profiles and saved financial records remain unchanged. At the audit snapshot, 9 non-admin accounts had existing saved FORMÁ activity; historic entries were not provable.

The broader shared Auth trigger/legacy permission modification was rejected by automatic approval review. The implemented alternative adds isolated evidence tables and RPCs and changes only FORMÁ reporting; it preserves the shared trigger and all legacy client permissions.

WhatsApp and future billing retain their prior behavior. Billing remains inactive.
