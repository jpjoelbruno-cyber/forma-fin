-- FORMÁ data only. No credentials, source Auth users or sessions are imported.
begin;
create table forma_private.legacy_recovery (
 source_user_id uuid primary key,
 google_fingerprint text unique check(google_fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb not null,
 payload_digest text not null,
 eligible boolean not null,
 claimed_by uuid unique references auth.users(id),
 claimed_at timestamptz,
 staged_at timestamptz not null default now()
);
alter table forma_private.legacy_recovery enable row level security;
revoke all on forma_private.legacy_recovery from public,anon,authenticated;

create function forma_private.restore_legacy() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; fingerprint text; recovery forma_private.legacy_recovery;
 table_name text; mapped jsonb; actual jsonb; old_status text;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Permanent authentication required' using errcode='42501';
 end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when invalid_text_representation then sid:=null;end;
 if sid is null or not exists(select 1 from auth.sessions s where s.id=sid and s.user_id=uid and (s.not_after is null or s.not_after>now())) then
  raise exception 'Live FORMÁ session required' using errcode='42501';
 end if;
 select encode(sha256(convert_to(i.provider_id,'UTF8')),'hex') into fingerprint
 from auth.identities i join auth.users u on u.id=i.user_id
 where i.user_id=uid and i.provider='google' and u.email_confirmed_at is not null;
 if fingerprint is null then return jsonb_build_object('restored',false);end if;
 select * into recovery from forma_private.legacy_recovery where google_fingerprint=fingerprint and eligible for update;
 if not found then return jsonb_build_object('restored',false);end if;
 if recovery.claimed_by is not null then
  if recovery.claimed_by<>uid then raise exception 'Recovery identity conflict' using errcode='42501';end if;
  return jsonb_build_object('restored',true,'already_restored',true);
 end if;
 if recovery.payload_digest<>encode(sha256(convert_to(recovery.payload::text,'UTF8')),'hex') then raise exception 'Recovery integrity failure';end if;
 -- Never replace movements/budgets already created in the independent account.
 if exists(select 1 from public.forma_budgets where user_id=uid)
 or exists(select 1 from public.forma_transactions where user_id=uid)
 or exists(select 1 from public.forma_goals where user_id=uid)
 or exists(select 1 from public.forma_goal_events where user_id=uid)
 or exists(select 1 from public.forma_learning_progress where user_id=uid) then
  raise exception 'Recovery requires reconciliation; existing records were preserved';
 end if;
 insert into public.forma_profiles(id,full_name,role)
 values(uid,left(coalesce(recovery.payload->>'full_name',''),120),'student')
 on conflict(id) do update set full_name=excluded.full_name;
 foreach table_name in array array['forma_budgets','forma_transactions','forma_goals','forma_goal_events','forma_learning_progress'] loop
  select coalesce(jsonb_agg(jsonb_set(value,'{user_id}',to_jsonb(uid::text))),'[]'::jsonb) into mapped
  from jsonb_array_elements(coalesce(recovery.payload->table_name,'[]'::jsonb));
  execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1)',table_name,table_name) using mapped;
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where user_id=$1',table_name) into actual using uid;
  if jsonb_array_length(actual)<>jsonb_array_length(mapped) or not (actual @> mapped and mapped @> actual) then raise exception 'Restored data mismatch';end if;
 end loop;
 select status into old_status from forma_private.app_access where user_id=uid;
 insert into forma_private.app_access(user_id,status,display_name,reason)
 values(uid,'active',left(coalesce(recovery.payload->>'full_name',''),120),'verified_google_legacy_recovery')
 on conflict(user_id) do update set status='active',reason='verified_google_legacy_recovery',updated_at=now();
 if old_status is distinct from 'active' then
  insert into forma_private.app_access_audit(user_id,actor_id,previous_status,new_status) values(uid,uid,old_status,'active');
 end if;
 update forma_private.legacy_recovery set claimed_by=uid,claimed_at=now() where source_user_id=recovery.source_user_id;
 return jsonb_build_object('restored',true,'already_restored',false);
end $$;
revoke all on function forma_private.restore_legacy() from public,anon,authenticated;
grant execute on function forma_private.restore_legacy() to authenticated;
create function public.forma_restore_legacy() returns jsonb language sql security invoker set search_path='' as $$select forma_private.restore_legacy()$$;
revoke all on function public.forma_restore_legacy() from public,anon,authenticated;
grant execute on function public.forma_restore_legacy() to authenticated;
commit;

begin;
create function forma_private.recovery_report() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.forma_admin_members where user_id=auth.uid()) then raise exception 'FORMÁ administrator required' using errcode='42501';end if;
 return jsonb_build_object(
 'restored',(select count(*) from forma_private.legacy_recovery where claimed_by is not null),
 'awaiting_google',(select count(*) from forma_private.legacy_recovery where claimed_by is null and eligible and google_fingerprint is not null),
 'manual_review',(select count(*) from forma_private.legacy_recovery where claimed_by is null and (not eligible or google_fingerprint is null)),
 'manual_records',coalesce((select jsonb_agg(jsonb_build_object('reference',left(source_user_id::text,8),'name',coalesce(nullif(payload->>'full_name',''),'Sin perfil anterior'),'reason',case when not eligible then 'Sin acceso FORMÁ validado' else 'Sin identidad Google verificada' end) order by source_user_id) from forma_private.legacy_recovery where claimed_by is null and (not eligible or google_fingerprint is null)),'[]'::jsonb));
end$$;
revoke all on function forma_private.recovery_report() from public,anon,authenticated;
grant execute on function forma_private.recovery_report() to authenticated;
create function public.forma_recovery_report() returns jsonb language sql security invoker set search_path='' as $$select forma_private.recovery_report()$$;
revoke all on function public.forma_recovery_report() from public,anon,authenticated;
grant execute on function public.forma_recovery_report() to authenticated;
commit;
