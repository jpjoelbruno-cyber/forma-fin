-- Execute ONLY in FORMA Personal Independiente (irsuevjqmgpwunvymxbc).
-- Adds the signed-in account email to the owner-only pending-access report.
-- Does not change accounts, enrollment status, financial data or other apps.
begin;
do $guard$
begin
 if not exists (
   select 1 from public.forma_admin_members m join auth.users u on u.id=m.user_id
   where m.user_id='776893e1-f940-437c-94a7-40a83bccc013'::uuid
 ) then
   raise exception 'Wrong project: select FORMA Personal Independiente';
 end if;
end $guard$;
create or replace function forma_private.admin_access_review() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.forma_admin_members where user_id=auth.uid()) then
  raise exception 'FORMÁ administrator required' using errcode='42501';end if;
 return jsonb_build_object(
 'active',(select count(*) from forma_private.app_access a where status='active' and not exists(select 1 from public.forma_admin_members m where m.user_id=a.user_id)),
 'staff',(select count(*) from public.forma_admin_members),
 'pending_count',(select count(*) from forma_private.app_access where status='pending_validation'),
 'pending',coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'name',a.display_name,'email',u.email,'requested_at',a.requested_at) order by a.requested_at desc nulls last,a.updated_at desc)
  from (select * from forma_private.app_access where status='pending_validation' order by requested_at desc nulls last,updated_at desc limit 500) a left join auth.users u on u.id=a.user_id),'[]'::jsonb)
 );
end $$;
create or replace function public.forma_admin_access_review() returns jsonb language sql security invoker set search_path='' as $$select forma_private.admin_access_review()$$;
revoke all on function forma_private.admin_access_review(),public.forma_admin_access_review() from public,anon,authenticated;
grant execute on function forma_private.admin_access_review(),public.forma_admin_access_review() to authenticated;


-- Check the email result and owner-only authorization in this SQL session.
do $verify$
declare
 owner_id uuid; student_id uuid; report jsonb;
 prior_claims text:=current_setting('request.jwt.claims',true);
 prior_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 select user_id into owner_id from public.forma_admin_members limit 1;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 report:=public.forma_admin_access_review();
 if exists (
   select 1 from jsonb_array_elements(report->'pending') item
   left join auth.users u on u.id=(item->>'id')::uuid
   where not (item ? 'email') or (item->>'email') is distinct from u.email
 ) then raise exception 'Email verification failed';end if;
 select u.id into student_id from auth.users u
 where not exists(select 1 from public.forma_admin_members m where m.user_id=u.id) limit 1;
 if student_id is not null then
  perform set_config('request.jwt.claim.sub',student_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',student_id,'role','authenticated')::text,true);
  begin
   perform public.forma_admin_access_review();
   raise exception 'Nonadministrator unexpectedly permitted';
  exception when insufficient_privilege then null;end;
 end if;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{}',true);
 begin
  perform public.forma_admin_access_review();
  raise exception 'Unauthenticated caller unexpectedly permitted';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(prior_claims,'{}'),true);
end $verify$;
commit;
select 'FORMÁ: correos habilitados solo para administración' as resultado;
