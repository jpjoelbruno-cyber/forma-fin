-- Run only against the original shared project, after the containment migration.
-- Synthetic account and own profile creation are rolled back.
begin;
do $$
declare fixture_id uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(fixture_id,'authenticated','authenticated','forma-isolation-test-'||fixture_id::text||'@example.invalid','{}'::jsonb,'{}'::jsonb,now(),now());
 if exists(select 1 from public.forma_profiles where id=fixture_id) then
  raise exception 'Unexpected automatic FORMA profile';
 end if;
 insert into forma_private.app_access(user_id,status,display_name,reason) values(fixture_id,'active','Synthetic FORMÁ test','rollback_test_fixture');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',fixture_id::text,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 insert into public.forma_profiles(id,full_name) values(fixture_id,'Synthetic FORMÁ test');
 if not exists(select 1 from public.forma_profiles where id=fixture_id) then
  raise exception 'Explicit FORMÁ profile did not persist';
 end if;
 execute 'reset role';
end $$;
select 'PASS: no automatic FORMÁ profile; explicit FORMÁ own signup works after trusted enrollment validation' as result;
rollback;
