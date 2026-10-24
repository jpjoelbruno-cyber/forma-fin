-- FORMA security and performance quick fixes, 2026-10-24.
-- Apply ONLY to FORMA Personal Independiente (irsuevjqmgpwunvymxbc). Never to Eleva.
-- Rollback: tests/security/security-quickfixes-rollback.sql

-- 1. admin_report was the only private function left with the default PUBLIC
--    execute grant. Match its guarded siblings: authenticated only.
revoke all on function forma_private.admin_report(integer) from public, anon;
grant execute on function forma_private.admin_report(integer) to authenticated;

-- 2. Remove duplicate indexes (identical definitions; the owner_* ones remain).
drop index if exists public.idx_forma_budgets_user_month;
drop index if exists public.idx_forma_tx_user_date;

-- 3. Cover foreign keys that had no leading index.
create index if not exists forma_goals_user_idx on public.forma_goals (user_id);
create index if not exists forma_goal_events_goal_idx on public.forma_goal_events (goal_id);
create index if not exists forma_course_progress_lesson_idx on public.forma_course_progress (lesson_id);
