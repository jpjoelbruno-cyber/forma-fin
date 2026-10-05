-- FORMÁ administration: no financial values are returned by reporting endpoints.
create schema if not exists forma_private;
revoke all on schema forma_private from public, anon;
grant usage on schema forma_private to authenticated;

create table public.forma_admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.forma_admin_members enable row level security;
revoke all on public.forma_admin_members from public, anon, authenticated;
grant select on public.forma_admin_members to authenticated;
create policy forma_admin_self_read on public.forma_admin_members for select to authenticated using ((select auth.uid())=user_id);

create table public.forma_usage_daily (
  user_id uuid not null references public.forma_profiles(id) on delete cascade,
  day date not null default current_date,
  section text not null check(section in ('resumo','registrar','historico','metas','aprender','anual')),
  seen_at timestamptz not null default now(),
  primary key(user_id,day,section)
);
alter table public.forma_usage_daily enable row level security;
revoke all on public.forma_usage_daily from public, anon, authenticated;
grant select,insert,update on public.forma_usage_daily to authenticated;
create policy forma_usage_read on public.forma_usage_daily for select to authenticated using ((select auth.uid())=user_id);
create policy forma_usage_insert on public.forma_usage_daily for insert to authenticated with check ((select auth.uid())=user_id and day=current_date and seen_at between date_trunc('day',now()) and now()+interval '1 minute');
create policy forma_usage_update on public.forma_usage_daily for update to authenticated using ((select auth.uid())=user_id and day=current_date) with check ((select auth.uid())=user_id and day=current_date and seen_at between date_trunc('day',now()) and now()+interval '1 minute');
create index forma_usage_day on public.forma_usage_daily(day);

create table public.forma_support_settings (
  id boolean primary key default true check(id),
  whatsapp text not null default '' check(whatsapp='' or whatsapp ~ '^[1-9][0-9]{7,14}$')
);
insert into public.forma_support_settings(id) values(true);
alter table public.forma_support_settings enable row level security;
revoke all on public.forma_support_settings from public, anon, authenticated;
grant select,update on public.forma_support_settings to authenticated;
create policy forma_support_read on public.forma_support_settings for select to authenticated using(true);
create policy forma_support_admin_update on public.forma_support_settings for update to authenticated using(exists(select 1 from public.forma_admin_members a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.forma_admin_members a where a.user_id=(select auth.uid())));

create function forma_private.admin_report(p_days integer default 30) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.forma_admin_members where user_id=auth.uid()) then raise exception 'Administrative access required' using errcode='42501'; end if;
  if p_days not in (7,30,90) then raise exception 'Invalid period' using errcode='22023'; end if;
  with roster as (
    select p.id,p.full_name,p.created_at,
      (select max(u.seen_at) from public.forma_usage_daily u where u.user_id=p.id) last_seen,
      exists(select 1 from public.forma_usage_daily u where u.user_id=p.id and u.day>=current_date-(p_days-1)) active,
      exists(select 1 from public.forma_budgets b where b.user_id=p.id and b.month=to_char(current_date,'YYYY-MM') and b.planned>0 and b.category like 'income:%') and
      exists(select 1 from public.forma_budgets b where b.user_id=p.id and b.month=to_char(current_date,'YYYY-MM') and b.planned>0 and b.category not like 'income:%') budget,
      exists(select 1 from public.forma_transactions t where t.user_id=p.id and t.date>=current_date-(p_days-1) and t.date<=current_date) movements,
      exists(select 1 from public.forma_goals g where g.user_id=p.id) goals,
      exists(select 1 from public.forma_learning_progress l where l.user_id=p.id) learning
    from public.forma_profiles p
  ) select jsonb_build_object(
    'days',p_days,'budget_month',to_char(current_date,'YYYY-MM'),
    'total',count(*),'active',count(*) filter(where active),
    'budget',count(*) filter(where budget),'movements',count(*) filter(where movements),
    'goals',count(*) filter(where goals),'learning',count(*) filter(where learning),
    'activated',count(*) filter(where budget and movements),
    'users',coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name,'joined',created_at,'last_seen',last_seen,'active',active,'budget',budget,'movements',movements,'goals',goals,'learning',learning) order by created_at desc),'[]'::jsonb)
  ) into result from roster;
  return result || jsonb_build_object('sections',(select coalesce(jsonb_agg(jsonb_build_object('section',section,'users',n)),'[]'::jsonb) from (select section,count(distinct user_id) n from public.forma_usage_daily where day>=current_date-(p_days-1) group by section) s));
end $$;
revoke all on function forma_private.admin_report(integer) from public,anon,authenticated;
grant execute on function forma_private.admin_report(integer) to authenticated;
create function public.forma_admin_report(p_days integer default 30) returns jsonb
language sql security invoker set search_path='' as $$ select forma_private.admin_report(p_days) $$;
revoke all on function public.forma_admin_report(integer) from public,anon,authenticated;
grant execute on function public.forma_admin_report(integer) to authenticated;
