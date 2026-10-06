begin;
insert into auth.users(id,email,aud,role) values('00000000-0000-4000-8000-00000000c001','forma-movement-a@example.invalid','authenticated','authenticated'),('00000000-0000-4000-8000-00000000c002','forma-movement-b@example.invalid','authenticated','authenticated');
insert into public.forma_profiles(id,full_name) values('00000000-0000-4000-8000-00000000c001','Fixture A'),('00000000-0000-4000-8000-00000000c002','Fixture B') on conflict do nothing;
insert into auth.sessions(id,user_id) values('00000000-0000-4000-8000-00000000c003','00000000-0000-4000-8000-00000000c001');
-- Enrollment fixtures: tests keep their existing owner/anonymous scopes.
insert into forma_private.app_access(user_id,status,display_name,reason)
select p.id,'active',left(p.full_name,120),'rollback_test_fixture' from public.forma_profiles p join auth.users u on u.id=p.id
where u.email like 'forma-%@example.invalid' on conflict(user_id) do nothing;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c001","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000c003"}',true);set local role authenticated;
select public.forma_save_movement('00000000-0000-4000-8000-00000000c004',current_date,25,'expense','uber','Fixture');
select public.forma_save_movement('00000000-0000-4000-8000-00000000c004',current_date,25,'expense','uber','Fixture');
do $$begin
 if(select count(*) from public.forma_transactions where id='00000000-0000-4000-8000-00000000c004')<>1 then raise exception 'FAIL duplicate retry';end if;
 begin perform public.forma_save_movement('00000000-0000-4000-8000-00000000c004',current_date,30,'expense','uber','Fixture');raise exception 'FAIL different retry';exception when invalid_parameter_value then null;end;
 begin perform public.forma_save_movement('00000000-0000-4000-8000-00000000c005',current_date,-25,'expense','uber','Fixture');raise exception 'FAIL negative';exception when invalid_parameter_value then null;end;
 begin perform public.forma_save_movement('00000000-0000-4000-8000-00000000c005',current_date,25.999,'expense','uber','Fixture');raise exception 'FAIL subcent';exception when invalid_parameter_value then null;end;
 if public.forma_voice_claim(16) is distinct from true then raise exception 'FAIL valid voice session';end if;
 if public.forma_voice_claim(3000000) is distinct from false then raise exception 'FAIL oversized voice';end if;
 begin insert into forma_private.voice_daily(user_id,day,requests) values(auth.uid(),current_date,0);raise exception 'FAIL quota tampering';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c002","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000c003"}',true);
do $$begin
 if public.forma_voice_claim(16) is distinct from false then raise exception 'FAIL another session';end if;
 begin perform public.forma_save_movement('00000000-0000-4000-8000-00000000c004',current_date,25,'expense','uber','Fixture');raise exception 'FAIL foreign movement reuse';exception when insufficient_privilege then null;end;
end$$;
reset role;set local role anon;do $$begin
 begin perform public.forma_save_movement('00000000-0000-4000-8000-00000000c005',current_date,25,'expense','uber','Fixture');raise exception 'FAIL anonymous movement';exception when insufficient_privilege then null;end;
end$$;reset role;
select 'Movement retries, ownership, validation and voice quotas passed; fixtures rolled back' result;rollback;
