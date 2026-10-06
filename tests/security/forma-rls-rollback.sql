begin;
insert into auth.users(id,email,aud,role,raw_user_meta_data) values
('00000000-0000-4000-8000-00000000f0a1','forma-audit-a@example.invalid','authenticated','authenticated','{"full_name":"Audit A"}'),
('00000000-0000-4000-8000-00000000f0b2','forma-audit-b@example.invalid','authenticated','authenticated','{"full_name":"Audit B"}');
insert into public.forma_profiles(id,full_name) values ('00000000-0000-4000-8000-00000000f0a1','Audit A'),('00000000-0000-4000-8000-00000000f0b2','Audit B') on conflict(id) do nothing;
insert into public.forma_budgets(user_id,month,category,planned) values ('00000000-0000-4000-8000-00000000f0a1','2099-01','audit',100),('00000000-0000-4000-8000-00000000f0b2','2099-01','audit',200);
insert into public.forma_transactions(user_id,date,description,amount,type,category,source) values ('00000000-0000-4000-8000-00000000f0a1','2099-01-01','audit',10,'expense','audit','manual'),('00000000-0000-4000-8000-00000000f0b2','2099-01-01','audit',20,'expense','audit','manual');
insert into public.forma_goals(id,user_id,name,target) values ('00000000-0000-4000-8000-00000000f0a3','00000000-0000-4000-8000-00000000f0a1','audit',100),('00000000-0000-4000-8000-00000000f0b4','00000000-0000-4000-8000-00000000f0b2','audit',200);
insert into public.forma_goal_events(user_id,goal_id,direction,amount) values ('00000000-0000-4000-8000-00000000f0a1','00000000-0000-4000-8000-00000000f0a3','contribution',10),('00000000-0000-4000-8000-00000000f0b2','00000000-0000-4000-8000-00000000f0b4','contribution',20);
insert into public.forma_learning_progress(user_id,lesson_key) values ('00000000-0000-4000-8000-00000000f0a1','budget'),('00000000-0000-4000-8000-00000000f0b2','budget');
-- Enrollment fixtures: tests keep their existing owner/anonymous scopes.
insert into forma_private.app_access(user_id,status,display_name,reason)
select p.id,'active',left(p.full_name,120),'rollback_test_fixture' from public.forma_profiles p join auth.users u on u.id=p.id
where u.email like 'forma-%@example.invalid' on conflict(user_id) do nothing;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000f0a1","role":"authenticated"}',true);
do $test$ declare n integer; begin
select count(*) into n from public.forma_profiles where id in ('00000000-0000-4000-8000-00000000f0a1','00000000-0000-4000-8000-00000000f0b2'); if n<>1 then raise exception 'FAIL isolation forma_profiles'; end if;
select count(*) into n from public.forma_budgets where user_id in ('00000000-0000-4000-8000-00000000f0a1','00000000-0000-4000-8000-00000000f0b2'); if n<>1 then raise exception 'FAIL isolation forma_budgets'; end if;
select count(*) into n from public.forma_transactions where user_id in ('00000000-0000-4000-8000-00000000f0a1','00000000-0000-4000-8000-00000000f0b2'); if n<>1 then raise exception 'FAIL isolation forma_transactions'; end if;
select count(*) into n from public.forma_goals where user_id in ('00000000-0000-4000-8000-00000000f0a1','00000000-0000-4000-8000-00000000f0b2'); if n<>1 then raise exception 'FAIL isolation forma_goals'; end if;
select count(*) into n from public.forma_goal_events where user_id in ('00000000-0000-4000-8000-00000000f0a1','00000000-0000-4000-8000-00000000f0b2'); if n<>1 then raise exception 'FAIL isolation forma_goal_events'; end if;
select count(*) into n from public.forma_learning_progress where user_id in ('00000000-0000-4000-8000-00000000f0a1','00000000-0000-4000-8000-00000000f0b2'); if n<>1 then raise exception 'FAIL isolation forma_learning_progress'; end if;
update public.forma_budgets set planned=201 where user_id='00000000-0000-4000-8000-00000000f0b2'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL foreign update forma_budgets'; end if;
update public.forma_transactions set amount=21 where user_id='00000000-0000-4000-8000-00000000f0b2'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL foreign update forma_transactions'; end if;
update public.forma_goals set target=201 where user_id='00000000-0000-4000-8000-00000000f0b2'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL foreign update forma_goals'; end if;
update public.forma_profiles set full_name='modified' where id='00000000-0000-4000-8000-00000000f0b2'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL foreign update forma_profiles'; end if;
delete from public.forma_budgets where user_id='00000000-0000-4000-8000-00000000f0b2'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL foreign delete forma_budgets'; end if;
delete from public.forma_transactions where user_id='00000000-0000-4000-8000-00000000f0b2'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL foreign delete forma_transactions'; end if;
delete from public.forma_goals where user_id='00000000-0000-4000-8000-00000000f0b2'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL foreign delete forma_goals'; end if;
delete from public.forma_learning_progress where user_id='00000000-0000-4000-8000-00000000f0b2'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL foreign delete forma_learning_progress'; end if;
update public.forma_transactions set amount=11 where user_id='00000000-0000-4000-8000-00000000f0a1'; get diagnostics n=row_count; if n<>1 then raise exception 'FAIL own update'; end if;
insert into public.forma_transactions(user_id,description,amount,type,category,source) values ('00000000-0000-4000-8000-00000000f0a1','audit new',1,'income','audit','manual');
begin insert into public.forma_transactions(user_id,amount,type,source) values ('00000000-0000-4000-8000-00000000f0b2',1,'income','manual'); raise exception 'FAIL foreign insert'; exception when insufficient_privilege then null; end;
begin update public.forma_profiles set role='teacher' where id='00000000-0000-4000-8000-00000000f0a1'; raise exception 'FAIL self privilege escalation'; exception when insufficient_privilege then null; end;
begin update public.forma_goals set user_id='00000000-0000-4000-8000-00000000f0b2' where user_id='00000000-0000-4000-8000-00000000f0a1'; raise exception 'FAIL goal owner reassignment'; exception when insufficient_privilege then null; end;
begin insert into public.forma_goal_events(user_id,goal_id,direction,amount) values ('00000000-0000-4000-8000-00000000f0a1','00000000-0000-4000-8000-00000000f0b4','contribution',1); raise exception 'FAIL foreign goal contribution'; exception when insufficient_privilege then null; end;
end $test$;
reset role;
set local role anon;
do $test$ begin
begin perform 1 from public.forma_profiles limit 1; raise exception 'FAIL anonymous access forma_profiles'; exception when insufficient_privilege then null; end;
begin perform 1 from public.forma_budgets limit 1; raise exception 'FAIL anonymous access forma_budgets'; exception when insufficient_privilege then null; end;
begin perform 1 from public.forma_transactions limit 1; raise exception 'FAIL anonymous access forma_transactions'; exception when insufficient_privilege then null; end;
begin perform 1 from public.forma_goals limit 1; raise exception 'FAIL anonymous access forma_goals'; exception when insufficient_privilege then null; end;
begin perform 1 from public.forma_goal_events limit 1; raise exception 'FAIL anonymous access forma_goal_events'; exception when insufficient_privilege then null; end;
begin perform 1 from public.forma_learning_progress limit 1; raise exception 'FAIL anonymous access forma_learning_progress'; exception when insufficient_privilege then null; end;
end $test$; reset role; select '26 checks passed; synthetic users and data rolled back' as audit_result; rollback;
