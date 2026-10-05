# FORMÁ administration

The Administration button appears only for accounts listed in `forma_admin_members`. Membership cannot be changed through the public client, profile role, or user-editable metadata. Activation requires the owner to supply their actual FORMÁ login email; resolve it to an existing Auth user with a FORMÁ profile and provision membership server-side. The owner supplied and confirmed their login email on October 5, 2026; one existing FORMÁ account was provisioned server-side.

The report exposes names and education/adoption flags, not financial amounts, balances, transaction descriptions, bank locations, or emails. The private reporting function requires an authenticated membership check and a fixed period of 7, 30, or 90 days. Existing financial RLS is unchanged.

Definitions:

- Registered: FORMÁ profiles only, excluding unrelated products in the shared project.
- Active: measured section use within the selected period.
- Budget prepared: positive planned income and positive planned expenses for the current database month.
- Movements: at least one personal transaction dated within the selected period, excluding future dates.
- Goals and learning: at least one saved goal or completed lesson, respectively, across all time.
- Adoption thermometer: registered users combining current-month budget and a movement in the selected period, divided by all registered users. This is an adoption measure, not a financial score.

Section measurement starts October 5, 2026. One record per user/day/section, updated on visits; no historical visits are backfilled. Section measurement can be disabled in Help; this stops future visits being recorded, not the education flags derived from already saved records. An empty report is a valid state.

WhatsApp is configured by an authorized administrator in Administration → Help. The number is stored only after the database confirms the update. The link opens WhatsApp with a generic help message; it sends nothing automatically and contains no student financial data. Until a number is supplied, Help shows the pending state and local troubleshooting.

Billing is a roadmap tab only. It creates no subscriptions, charges, or payment details.

Validation on October 5, 2026: 22 database assertions passed using synthetic fixtures rolled back afterwards; existing 14 autosave/goal tests passed. Security advisors reported no new FORMÁ findings; shared-project pre-existing findings remain separate. Browser verification covers the public app and Help; owner report access was verified under the authenticated database role after provisioning. Browser sign-in to the real owner account was not performed. The public demonstration no longer exposes an administration entry.
