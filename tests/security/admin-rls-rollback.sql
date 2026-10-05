begin;
insert into auth.users(id,email,aud,role,raw_user_meta_data) values
('00000000-0000-4000-8000-00000000a001','forma-admin-audit@example.invalid','authenticated','authenticated','{}'),
('00000000-0000-4000-8000-00000000a002','forma-student-audit@example.invalid','authenticated','authenticated','{"admin":true}');
insert into public.forma_profiles(id,full_name) values ('00000000-0000-4000-8000-00000000a001','Synthetic administrator'),('00000000-0000-4000-8000-00000000a002','Synthetic student') on conflict(id) do nothing;
insert into public.forma_admin_members(user_id) values('00000000-0000-4000-8000-00000000a001');
insert into public.forma_budgets(user_id,month,category,planned) values('00000000-0000-4000-8000-00000000a002',to_char(current_date,'YYYY-MM'),'income:salario',100),('00000000-0000-4000-8000-00000000a002',to_char(current_date,'YYYY-MM'),'alquiler',50);
insert into public.forma_transactions(user_id,date,description,amount,type,category,source) values('00000000-0000-4000-8000-00000000a002',current_date,'Confidential synthetic description',50,'expense','alquiler','manual');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated","user_metadata":{"admin":true}}',true);
set local role authenticated;
do $$ declare n integer; begin
  if (select count(*) from public.forma_admin_members)<>0 then raise exception 'FAIL student sees membership'; end if;
  begin perform public.forma_admin_report(30);raise exception 'FAIL student report';exception when insufficient_privilege then null;end;
  begin perform forma_private.admin_report(30);raise exception 'FAIL private report student';exception when insufficient_privilege then null;end;
  begin insert into public.forma_admin_members(user_id) values(auth.uid());raise exception 'FAIL self elevation';exception when insufficient_privilege then null;end;
  update public.forma_support_settings set whatsapp='5511999999999';get diagnostics n=row_count;if n<>0 then raise exception 'FAIL student support write';end if;
  if (select count(*) from public.forma_support_settings)<>1 then raise exception 'FAIL support read';end if;
  insert into public.forma_usage_daily(user_id,section) values(auth.uid(),'resumo');
  update public.forma_usage_daily set section='registrar' where user_id=auth.uid();get diagnostics n=row_count;if n<>1 then raise exception 'FAIL own tracking update';end if;
  begin insert into public.forma_usage_daily(user_id,section) values('00000000-0000-4000-8000-00000000a001','resumo');raise exception 'FAIL foreign tracking';exception when insufficient_privilege then null;end;
  begin update public.forma_usage_daily set user_id='00000000-0000-4000-8000-00000000a001' where user_id=auth.uid();raise exception 'FAIL tracking reassignment';exception when insufficient_privilege then null;end;
  begin insert into public.forma_usage_daily(user_id,day,section) values(auth.uid(),current_date-10,'resumo');raise exception 'FAIL backdated tracking';exception when insufficient_privilege then null;end;
  begin insert into public.forma_usage_daily(user_id,section) values(auth.uid(),'secret');raise exception 'FAIL arbitrary tracking';exception when check_violation then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare r jsonb;s jsonb;n integer;begin
  r:=public.forma_admin_report(30);
  select value into s from jsonb_array_elements(r->'users') where value->>'id'='00000000-0000-4000-8000-00000000a002';
  if s is null or not(s->>'budget')::boolean or not(s->>'movements')::boolean or not(s->>'active')::boolean then raise exception 'FAIL report stage flags';end if;
  if s ?| array['amount','saved','target','balance','email','description','bank'] or r::text like '%Confidential synthetic description%' then raise exception 'FAIL financial leakage';end if;
  if (select count(*) from public.forma_usage_daily where user_id='00000000-0000-4000-8000-00000000a002')<>0 then raise exception 'FAIL admin direct tracking access';end if;
  update public.forma_support_settings set whatsapp='5511999999999';get diagnostics n=row_count;if n<>1 then raise exception 'FAIL admin support update';end if;
  begin perform public.forma_admin_report(400);raise exception 'FAIL invalid reporting period';exception when invalid_parameter_value then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
  begin perform public.forma_admin_report(30);raise exception 'FAIL anonymous report';exception when insufficient_privilege then null;end;
  begin perform forma_private.admin_report(30);raise exception 'FAIL anonymous private report';exception when insufficient_privilege then null;end;
  begin perform 1 from public.forma_admin_members;raise exception 'FAIL anonymous membership';exception when insufficient_privilege then null;end;
  begin perform 1 from public.forma_usage_daily;raise exception 'FAIL anonymous tracking';exception when insufficient_privilege then null;end;
  begin perform 1 from public.forma_support_settings;raise exception 'FAIL anonymous settings';exception when insufficient_privilege then null;end;
end $$;
reset role;
select '22 administration checks passed; synthetic fixtures rolled back' as audit_result;
rollback;
