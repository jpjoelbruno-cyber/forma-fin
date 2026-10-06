-- FORMÁ-only reversible enrollment cleanup. Never deletes shared Auth accounts.
begin;
create table forma_private.app_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null check(status in ('active','pending_validation')),
 display_name text not null default '' check(length(display_name)<=120),
 reason text not null,
 requested_at timestamptz,
 updated_at timestamptz not null default now()
);
create table forma_private.app_access_audit (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid,
 previous_status text,
 new_status text not null,
 changed_at timestamptz not null default now()
);
alter table forma_private.app_access enable row level security;
alter table forma_private.app_access_audit enable row level security;
revoke all on forma_private.app_access,forma_private.app_access_audit from public,anon,authenticated;
revoke all on sequence forma_private.app_access_audit_id_seq from public,anon,authenticated;

lock table public.forma_profiles,public.forma_budgets,public.forma_transactions,public.forma_goals,public.forma_goal_events,public.forma_learning_progress,forma_private.access_sessions in share row exclusive mode;
insert into forma_private.app_access(user_id,status,display_name,reason)
select p.id,
 case when exists(select 1 from public.forma_admin_members a where a.user_id=p.id)
  or exists(select 1 from forma_private.access_sessions s where s.user_id=p.id)
  or exists(select 1 from public.forma_budgets b where b.user_id=p.id)
  or exists(select 1 from public.forma_transactions t where t.user_id=p.id)
  or exists(select 1 from public.forma_goals g where g.user_id=p.id)
  or exists(select 1 from public.forma_goal_events e where e.user_id=p.id)
  or exists(select 1 from public.forma_learning_progress l where l.user_id=p.id)
 then 'active' else 'pending_validation' end,
 left(coalesce(p.full_name,''),120),'initial_evidence_review'
from public.forma_profiles p;

create function forma_private.access_active() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  exists(select 1 from public.forma_admin_members a where a.user_id=auth.uid())
  or exists(select 1 from forma_private.app_access a where a.user_id=auth.uid() and a.status='active')
 )
$$;
revoke all on function forma_private.access_active() from public,anon,authenticated;
grant execute on function forma_private.access_active() to authenticated;

-- Status is bound to the signed-in caller. Requesting access never activates it.
create function forma_private.access_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();v_status text;v_name text;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Permanent authentication required' using errcode='42501';
 end if;
 select left(coalesce(u.raw_user_meta_data->>'full_name',split_part(u.email,'@',1),''),120)
 into v_name from auth.users u where u.id=uid;
 if not found then raise exception 'Account not found' using errcode='42501';end if;
 insert into forma_private.app_access(user_id,status,display_name,reason,requested_at)
 values(uid,'pending_validation',v_name,'explicit_access_request',now())
 on conflict(user_id) do update set requested_at=now(),display_name=excluded.display_name
 where app_access.status='pending_validation';
 if exists(select 1 from public.forma_admin_members where user_id=uid) then
  update forma_private.app_access set status='active',reason='existing_admin' where user_id=uid;
 end if;
 select status into v_status from forma_private.app_access where user_id=uid;
 return jsonb_build_object('status',v_status,'reference',uid);
end $$;
create function public.forma_access_status() returns jsonb language sql security invoker set search_path='' as $$select forma_private.access_status()$$;
revoke all on function forma_private.access_status(),public.forma_access_status() from public,anon,authenticated;
grant execute on function forma_private.access_status(),public.forma_access_status() to authenticated;

create function forma_private.admin_access_review() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.forma_admin_members where user_id=auth.uid()) then
  raise exception 'FORMÁ administrator required' using errcode='42501';end if;
 return jsonb_build_object(
 'active',(select count(*) from forma_private.app_access a where status='active' and not exists(select 1 from public.forma_admin_members m where m.user_id=a.user_id)),
 'staff',(select count(*) from public.forma_admin_members),
 'pending_count',(select count(*) from forma_private.app_access where status='pending_validation'),
 'pending',coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'name',a.display_name,'requested_at',a.requested_at) order by a.requested_at desc nulls last,a.updated_at desc)
  from (select * from forma_private.app_access where status='pending_validation' order by requested_at desc nulls last,updated_at desc limit 500) a),'[]'::jsonb)
 );
end $$;
create function public.forma_admin_access_review() returns jsonb language sql security invoker set search_path='' as $$select forma_private.admin_access_review()$$;
revoke all on function forma_private.admin_access_review(),public.forma_admin_access_review() from public,anon,authenticated;
grant execute on function forma_private.admin_access_review(),public.forma_admin_access_review() to authenticated;

create function forma_private.admin_validate_access(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior text;
begin
 if auth.uid() is null or not exists(select 1 from public.forma_admin_members where user_id=auth.uid()) then
  raise exception 'FORMÁ administrator required' using errcode='42501';end if;
 select status into prior from forma_private.app_access where user_id=p_user_id for update;
 if not found then raise exception 'Access request not found' using errcode='22023';end if;
 if prior<>'active' then
  update forma_private.app_access set status='active',reason='owner_validated',updated_at=now() where user_id=p_user_id;
  insert into forma_private.app_access_audit(user_id,actor_id,previous_status,new_status) values(p_user_id,auth.uid(),prior,'active');
 end if;
 return jsonb_build_object('id',p_user_id,'status','active');
end $$;
create function public.forma_admin_validate_access(p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$select forma_private.admin_validate_access(p_user_id)$$;
revoke all on function forma_private.admin_validate_access(uuid),public.forma_admin_validate_access(uuid) from public,anon,authenticated;
grant execute on function forma_private.admin_validate_access(uuid),public.forma_admin_validate_access(uuid) to authenticated;

-- Restrictive policies add enrollment requirements to the existing owner rules.
do $$declare t text;begin
 foreach t in array array['forma_profiles','forma_budgets','forma_transactions','forma_goals','forma_goal_events','forma_learning_progress','forma_usage_daily'] loop
  execute format('create policy forma_active_enrollment on public.%I as restrictive for all to authenticated using ((select forma_private.access_active())) with check ((select forma_private.access_active()))',t);
 end loop;
end $$;
create or replace function forma_private.record_access(p_section text default 'entry') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();sid uuid;headers jsonb;local_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not forma_private.access_active() then raise exception 'FORMÁ access pending validation' using errcode='42501';end if;
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

create or replace function forma_private.voice_claim(p_bytes integer) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();sid uuid;d date:=(now() at time zone 'America/Sao_Paulo')::date;n integer;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not forma_private.access_active() then return false;end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when invalid_text_representation then return false;end;
 if not exists(select 1 from auth.sessions where id=sid and user_id=uid and (not_after is null or not_after>now())) or not exists(select 1 from public.forma_profiles where id=uid) then return false;end if;
 if p_bytes is null or p_bytes<=0 or p_bytes>2097152 then return false;end if;
 insert into forma_private.voice_daily(user_id,day) values(uid,d) on conflict do nothing;
 update forma_private.voice_daily set requests=requests+1,bytes=bytes+p_bytes where user_id=uid and day=d and requests<40 and bytes+p_bytes<=16777216;
 get diagnostics n=row_count;return n=1;
end $$;

commit;
