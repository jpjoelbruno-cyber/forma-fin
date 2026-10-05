-- Existing shared Auth triggers, profiles and permissions are preserved.
-- Only isolated FORMA evidence tables and reporting are added.
create table forma_private.access_sessions (
 session_id uuid primary key,
 user_id uuid not null references public.forma_profiles(id) on delete cascade,
 first_seen timestamptz not null default now(),last_seen timestamptz not null default now()
);
create index forma_access_user on forma_private.access_sessions(user_id,last_seen);
create table forma_private.access_daily (
 user_id uuid not null references public.forma_profiles(id) on delete cascade,
 day date not null,last_seen timestamptz not null default now(),primary key(user_id,day)
);
create table forma_private.section_daily (
 user_id uuid not null references public.forma_profiles(id) on delete cascade,
 day date not null,section text not null check(section in ('resumo','registrar','historico','metas','aprender','anual')),
 last_seen timestamptz not null default now(),primary key(user_id,day,section)
);
alter table forma_private.access_sessions enable row level security;
alter table forma_private.access_daily enable row level security;
alter table forma_private.section_daily enable row level security;
revoke all on all tables in schema forma_private from public,anon,authenticated;
-- Legacy browser-written visits remain intact but are excluded from reporting.
create function forma_private.record_access(p_section text default 'entry') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();sid uuid;headers jsonb;local_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
 if headers->>'origin' is distinct from 'https://forma-fin.vercel.app' then raise exception 'FORMA origin required' using errcode='42501';end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when invalid_text_representation then raise exception 'Invalid session' using errcode='42501';end;
 if sid is null or not exists(select 1 from auth.sessions s where s.id=sid and s.user_id=uid and (s.not_after is null or s.not_after>now())) then raise exception 'Live session required' using errcode='42501';end if;
 if not exists(select 1 from public.forma_profiles where id=uid) then raise exception 'FORMA profile required' using errcode='42501';end if;
 if p_section='entry' then
   insert into forma_private.access_sessions(session_id,user_id) values(sid,uid) on conflict(session_id) do update set last_seen=now() where access_sessions.user_id=uid;
 else
   if p_section not in ('resumo','registrar','historico','metas','aprender','anual') then raise exception 'Invalid section' using errcode='22023';end if;
   if not exists(select 1 from forma_private.access_sessions where session_id=sid and user_id=uid) then raise exception 'Verified entry required' using errcode='42501';end if;
   insert into forma_private.section_daily(user_id,day,section) values(uid,local_day,p_section) on conflict(user_id,day,section) do update set last_seen=now();
   update forma_private.access_sessions set last_seen=now() where session_id=sid and user_id=uid;
 end if;
 insert into forma_private.access_daily(user_id,day) values(uid,local_day) on conflict(user_id,day) do update set last_seen=now();
 return jsonb_build_object('verified',true,'recorded_at',now());
end $$;
revoke all on function forma_private.record_access(text) from public,anon,authenticated;
grant execute on function forma_private.record_access(text) to authenticated;
create function public.forma_record_access(p_section text default 'entry') returns jsonb language sql security invoker set search_path='' as $$select forma_private.record_access(p_section)$$;
revoke all on function public.forma_record_access(text) from public,anon,authenticated;
grant execute on function public.forma_record_access(text) to authenticated;
create or replace function forma_private.admin_report(p_days integer default 30) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;local_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if auth.uid() is null or not exists(select 1 from public.forma_admin_members where user_id=auth.uid()) then raise exception 'Administrative access required' using errcode='42501';end if;
 if p_days not in (7,30,90) then raise exception 'Invalid period' using errcode='22023';end if;
 with roster as (
    select p.id,p.full_name,p.created_at,
      (select min(s.first_seen) from forma_private.access_sessions s where s.user_id=p.id) first_entry,
      (select max(s.last_seen) from forma_private.access_sessions s where s.user_id=p.id) last_seen,
      exists(select 1 from forma_private.access_sessions s where s.user_id=p.id) entry_verified,
      exists(select 1 from forma_private.access_daily u where u.user_id=p.id and u.day>=local_day-(p_days-1)) active,
      exists(select 1 from public.forma_budgets b where b.user_id=p.id and b.month=to_char(current_date,'YYYY-MM') and b.planned>0 and b.category like 'income:%') and
      exists(select 1 from public.forma_budgets b where b.user_id=p.id and b.month=to_char(current_date,'YYYY-MM') and b.planned>0 and b.category not like 'income:%') budget,
      exists(select 1 from public.forma_transactions t where t.user_id=p.id and t.date>=current_date-(p_days-1) and t.date<=current_date) movements,
      exists(select 1 from public.forma_goals g where g.user_id=p.id) goals,
      exists(select 1 from public.forma_learning_progress l where l.user_id=p.id) learning
    from public.forma_profiles p
    where not exists(select 1 from public.forma_admin_members a where a.user_id=p.id)
    and (exists(select 1 from forma_private.access_sessions s where s.user_id=p.id) or exists(select 1 from public.forma_budgets b where b.user_id=p.id and b.planned>0) or exists(select 1 from public.forma_transactions t where t.user_id=p.id) or exists(select 1 from public.forma_goals g where g.user_id=p.id) or exists(select 1 from public.forma_learning_progress l where l.user_id=p.id))
 ) select jsonb_build_object(
 'days',p_days,'budget_month',to_char(current_date,'YYYY-MM'),'total',count(*),
 'verified_entries',count(*) filter(where entry_verified),'historical_only',count(*) filter(where not entry_verified),
 'active',count(*) filter(where active),'budget',count(*) filter(where budget),'movements',count(*) filter(where movements),
 'goals',count(*) filter(where goals),'learning',count(*) filter(where learning),'activated',count(*) filter(where budget and movements),
 'users',coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name,'joined',created_at,'first_entry',first_entry,'last_seen',last_seen,'entry_verified',entry_verified,'active',active,'budget',budget,'movements',movements,'goals',goals,'learning',learning) order by last_seen desc nulls last,created_at desc),'[]'::jsonb)
 ) into result from roster;
 return result || jsonb_build_object(
 'staff_excluded',(select count(*) from public.forma_admin_members),
 'sections',(select coalesce(jsonb_agg(jsonb_build_object('section',section,'users',n) order by n desc,section),'[]'::jsonb) from (select section,count(distinct user_id) n from forma_private.section_daily d where day>=local_day-(p_days-1) and not exists(select 1 from public.forma_admin_members a where a.user_id=d.user_id) group by section) s),
 'daily',(select coalesce(jsonb_agg(jsonb_build_object('day',day,'users',n) order by day),'[]'::jsonb) from (select day,count(distinct user_id) n from forma_private.access_daily d where day>=local_day-(p_days-1) and not exists(select 1 from public.forma_admin_members a where a.user_id=d.user_id) group by day) s));
end $$;
