begin;
insert into auth.users(id,email,aud,role) values
('00000000-0000-4000-8000-00000000e001','forma-evidence-admin@example.invalid','authenticated','authenticated'),
('00000000-0000-4000-8000-00000000e002','forma-evidence-student@example.invalid','authenticated','authenticated'),
('00000000-0000-4000-8000-00000000e003','forma-evidence-other@example.invalid','authenticated','authenticated');
insert into public.forma_profiles(id,full_name) values('00000000-0000-4000-8000-00000000e001','Audit owner'),('00000000-0000-4000-8000-00000000e002','Audit student'),('00000000-0000-4000-8000-00000000e003','Other app empty profile') on conflict(id) do nothing;
insert into public.forma_admin_members(user_id) values('00000000-0000-4000-8000-00000000e001');
insert into auth.sessions(id,user_id) values('00000000-0000-4000-8000-00000000e012','00000000-0000-4000-8000-00000000e002');
-- Enrollment fixtures: tests keep their existing owner/anonymous scopes.
insert into forma_private.app_access(user_id,status,display_name,reason)
select p.id,'active',left(p.full_name,120),'rollback_test_fixture' from public.forma_profiles p join auth.users u on u.id=p.id
where u.email like 'forma-%@example.invalid' on conflict(user_id) do nothing;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000e002","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000e012"}',true);
select set_config('request.headers','{"origin":"https://forma-fin.vercel.app"}',true);
set local role authenticated;
do $$ begin
 begin insert into forma_private.access_sessions(session_id,user_id) values('00000000-0000-4000-8000-00000000e012',auth.uid());raise exception 'FAIL direct evidence write';exception when insufficient_privilege then null;end;
 begin perform public.forma_record_access('metas');raise exception 'FAIL section before entry';exception when insufficient_privilege then null;end;
 if (public.forma_record_access('entry')->>'verified')::boolean is distinct from true then raise exception 'FAIL entry confirmation';end if;
 perform public.forma_record_access('entry');
 perform public.forma_record_access('resumo');
 perform public.forma_record_access('resumo');
 begin perform public.forma_record_access('arbitrary');raise exception 'FAIL unlisted section';exception when invalid_parameter_value then null;end;
 begin perform public.forma_admin_report(30);raise exception 'FAIL student report';exception when insufficient_privilege then null;end;
 begin update forma_private.access_sessions set last_seen=now()+interval '20 days';raise exception 'FAIL browser timestamp write';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if (select count(*) from forma_private.access_sessions where user_id='00000000-0000-4000-8000-00000000e002')<>1 then raise exception 'FAIL duplicated session';end if;
 if (select count(*) from forma_private.section_daily where user_id='00000000-0000-4000-8000-00000000e002')<>1 then raise exception 'FAIL duplicate section';end if;
end $$;
select set_config('request.headers','{"origin":"https://elevanegociomigra.com.br"}',true);
set local role authenticated;
do $$ begin begin perform public.forma_record_access('entry');raise exception 'FAIL other app origin';exception when insufficient_privilege then null;end;end $$;
reset role;
select set_config('request.headers','{}',true);
set local role authenticated;
do $$ begin begin perform public.forma_record_access('entry');raise exception 'FAIL missing origin';exception when insufficient_privilege then null;end;end $$;
reset role;
select set_config('request.headers','{"origin":"https://forma-fin.vercel.app"}',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000e003","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000e012"}',true);
set local role authenticated;
do $$ begin begin perform public.forma_record_access('entry');raise exception 'FAIL foreign session';exception when insufficient_privilege then null;end;end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000e002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin begin perform public.forma_record_access('entry');raise exception 'FAIL missing session';exception when insufficient_privilege then null;end;end $$;
reset role;
update auth.sessions set not_after=now()-interval '1 minute' where id='00000000-0000-4000-8000-00000000e012';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000e002","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000e012"}',true);
set local role authenticated;
do $$ begin begin perform public.forma_record_access('entry');raise exception 'FAIL expired session';exception when insufficient_privilege then null;end;end $$;
reset role;
-- Legacy client clicks must never enroll an empty profile in the new report.
insert into public.forma_usage_daily(user_id,section) values('00000000-0000-4000-8000-00000000e003','resumo');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000e001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare r jsonb;s jsonb;begin
 r:=public.forma_admin_report(30);
 if exists(select 1 from jsonb_array_elements(r->'users') u where u->>'id' in ('00000000-0000-4000-8000-00000000e001','00000000-0000-4000-8000-00000000e003')) then raise exception 'FAIL owner or empty other app counted';end if;
 select value into s from jsonb_array_elements(r->'users') where value->>'id'='00000000-0000-4000-8000-00000000e002';
 if s is null or not(s->>'entry_verified')::boolean or not(s->>'active')::boolean or s->>'first_entry' is null or s->>'last_seen' is null then raise exception 'FAIL verified evidence report';end if;
 if s ?| array['email','amount','bank','balance','description'] then raise exception 'FAIL sensitive fields';end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.forma_record_access('entry');raise exception 'FAIL anonymous entry';exception when insufficient_privilege then null;end;
 begin perform public.forma_admin_report(30);raise exception 'FAIL anonymous admin';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Verified entry isolation, origin, live session, deduplication, privacy and report tests passed; fixtures rolled back' as audit_result;
rollback;
