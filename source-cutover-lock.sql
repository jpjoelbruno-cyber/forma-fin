-- Original project only, after independent deployment. Preserve all data and other apps.
begin;
create policy forma_independent_cutover_closed on public.forma_profiles as restrictive for all to authenticated using(false) with check(false);
create policy forma_independent_cutover_closed on public.forma_budgets as restrictive for all to authenticated using(false) with check(false);
create policy forma_independent_cutover_closed on public.forma_transactions as restrictive for all to authenticated using(false) with check(false);
create policy forma_independent_cutover_closed on public.forma_goals as restrictive for all to authenticated using(false) with check(false);
create policy forma_independent_cutover_closed on public.forma_goal_events as restrictive for all to authenticated using(false) with check(false);
create policy forma_independent_cutover_closed on public.forma_learning_progress as restrictive for all to authenticated using(false) with check(false);
create policy forma_independent_cutover_closed on public.forma_usage_daily as restrictive for all to authenticated using(false) with check(false);
create policy forma_independent_cutover_closed on public.forma_admin_members as restrictive for all to authenticated using(false) with check(false);
create policy forma_independent_cutover_closed on public.forma_support_settings as restrictive for all to authenticated using(false) with check(false);
revoke all on function public.forma_access_status() from public,anon,authenticated;
revoke all on function public.forma_admin_access_review() from public,anon,authenticated;
revoke all on function public.forma_admin_report(integer) from public,anon,authenticated;
revoke all on function public.forma_admin_validate_access(uuid) from public,anon,authenticated;
revoke all on function public.forma_record_access(text) from public,anon,authenticated;
revoke all on function public.forma_save_movement(uuid,date,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.forma_voice_claim(integer) from public,anon,authenticated;
commit;
