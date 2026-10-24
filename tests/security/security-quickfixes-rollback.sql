-- Rollback for security-quickfixes-2026-10-24.sql. FORMA project only.

-- 1. Restore the previous (default) execute grant on admin_report.
grant execute on function forma_private.admin_report(integer) to public;

-- 2. Recreate the duplicate indexes.
create index if not exists idx_forma_budgets_user_month on public.forma_budgets using btree (user_id, month);
create index if not exists idx_forma_tx_user_date on public.forma_transactions using btree (user_id, date desc);

-- 3. Remove the added foreign-key indexes.
drop index if exists public.forma_goals_user_idx;
drop index if exists public.forma_goal_events_goal_idx;
drop index if exists public.forma_course_progress_lesson_idx;
