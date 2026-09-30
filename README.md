# FORMÁ Financiero

Personal finance pilot at https://forma-fin.vercel.app. Google OAuth returns to this origin. Frontend data is backed by the existing Supabase project and user-owned FORMÁ tables with RLS. The source in this repository now includes the guided budget, summary thermometer, spending chart, savings goals and learning pages.

`?vista=ejemplo` opens a read-only example with fictional data, without database reads or writes. Ordinary access uses the same UI with the signed-in user’s records. Banking remains disabled in both the UI and `/api/pluggy-token`.

The database changes in the Site development checkout were applied to the existing project on 29 September 2026. This release does not migrate users or create a new organization. Shared project infrastructure is not physical separation from the other apps.
