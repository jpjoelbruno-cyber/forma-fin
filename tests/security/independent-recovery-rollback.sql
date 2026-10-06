begin;
insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values
('00000000-0000-4000-8000-00000000f001','forma-recovery-one@example.invalid',now(),'authenticated','authenticated','{}'),
('00000000-0000-4000-8000-00000000f002','forma-recovery-two@example.invalid',now(),'authenticated','authenticated','{"sub":"fixture-google-one","role":"teacher"}'),
('00000000-0000-4000-8000-00000000f003','forma-recovery-three@example.invalid',now(),'authenticated','authenticated','{}');
insert into auth.identities(user_id,provider,provider_id,identity_data) values
('00000000-0000-4000-8000-00000000f001','google','fixture-google-one','{"sub":"fixture-google-one"}'),
('00000000-0000-4000-8000-00000000f002','google','fixture-google-two','{"sub":"fixture-google-two"}'),
('00000000-0000-4000-8000-00000000f003','google','fixture-google-three','{"sub":"fixture-google-three"}');
insert into auth.sessions(id,user_id) values
('00000000-0000-4000-8000-00000000f011','00000000-0000-4000-8000-00000000f001'),
('00000000-0000-4000-8000-00000000f012','00000000-0000-4000-8000-00000000f002'),
('00000000-0000-4000-8000-00000000f013','00000000-0000-4000-8000-00000000f003');
insert into forma_private.legacy_recovery(source_user_id,google_fingerprint,payload,payload_digest,eligible)
select '00000000-0000-4000-8000-00000000f021',encode(sha256(convert_to('fixture-google-one','UTF8')),'hex'),p,encode(sha256(convert_to(p::text,'UTF8')),'hex'),true
from (select jsonb_build_object('full_name','Original owner','forma_budgets',jsonb_build_array(jsonb_build_object('id','00000000-0000-4000-8000-00000000f031','user_id','00000000-0000-4000-8000-00000000f021','month','2026-10','category','transport','planned',40,'created_at',now())),'forma_transactions','[]'::jsonb,'forma_goals','[]'::jsonb,'forma_goal_events','[]'::jsonb,'forma_learning_progress','[]'::jsonb) as p) t;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000f002","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000f012"}',true);
set local role authenticated;
do $$begin
 if (public.forma_restore_legacy()->>'restored')::boolean then raise exception 'Metadata spoof claimed other Google data';end if;
 begin perform * from forma_private.legacy_recovery;raise exception 'Private snapshot exposed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000f001","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000f012"}',true);
set local role authenticated;
do $$begin
 begin perform public.forma_restore_legacy();raise exception 'Foreign session accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000f001","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000f011"}',true);
set local role authenticated;
do $$begin
 if (public.forma_restore_legacy()->>'restored')::boolean is distinct from true then raise exception 'Own data not restored';end if;
 if (public.forma_restore_legacy()->>'already_restored')::boolean is distinct from true then raise exception 'Retry not idempotent';end if;
 if (select count(*) from public.forma_budgets where user_id=auth.uid())<>1 then raise exception 'Wrong count';end if;
 if (select planned from public.forma_budgets where user_id=auth.uid())<>40 then raise exception 'Amount not preserved';end if;
 if exists(select 1 from public.forma_admin_members where user_id=auth.uid()) then raise exception 'Recovery granted admin';end if;
 update public.forma_budgets set planned=55 where user_id=auth.uid();
 perform public.forma_restore_legacy();
 if (select planned from public.forma_budgets where user_id=auth.uid())<>55 then raise exception 'Repeat overwrote newer budget';end if;
end$$;
reset role;
-- Verify conflicts fail atomically and don't activate a conflicting account.
insert into forma_private.app_access(user_id,status,display_name,reason) values('00000000-0000-4000-8000-00000000f003','active','Fixture','fixture');
insert into public.forma_budgets(user_id,month,category,planned) values('00000000-0000-4000-8000-00000000f003','2026-10','transport',12);
insert into forma_private.legacy_recovery(source_user_id,google_fingerprint,payload,payload_digest,eligible)
select '00000000-0000-4000-8000-00000000f023',encode(sha256(convert_to('fixture-google-three','UTF8')),'hex'),p,encode(sha256(convert_to(p::text,'UTF8')),'hex'),true
from (select jsonb_build_object('full_name','Fixture conflict') p) t;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000f003","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000f013"}',true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform public.forma_restore_legacy();exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Conflict overwrote existing records';end if;
 if (select planned from public.forma_budgets where user_id=auth.uid())<>12 then raise exception 'Conflict changed record';end if;
end$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$begin
 begin perform public.forma_restore_legacy();raise exception 'Anonymous RPC accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
