// Disposable PostgreSQL only. Never connects to a hosted project.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.FORMA_PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
const student='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',goal='00000000-0000-4000-8000-000000000011',foreign='00000000-0000-4000-8000-000000000012';
const call=(id,amount,direction='contribution',g=goal)=>`select public.forma_save_goal_event('${id}','${g}','${direction}',${amount},'nubank','Reserva','2026-10-09')`;
let n=0;async function denied(sql,code){await assert.rejects(db.exec(sql),e=>e.code===code);n++;}
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema forma_private;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,forma_private to authenticated;grant execute on function auth.uid() to authenticated;create function forma_private.access_active() returns boolean language sql stable as $$select auth.uid() is not null and coalesce(current_setting('test.revoked',true),'')<>'yes'$$;create function forma_private.admin_report(integer) returns jsonb language sql as $$select '{}'::jsonb$$;`);
 await db.exec(fs.readFileSync('isolated-schema.sql','utf8'));
 await db.exec(`insert into auth.users(id,email) values('776893e1-f940-437c-94a7-40a83bccc013','jp.joelbruno@gmail.com'),('${student}','student@example.test'),('${other}','other@example.test');insert into public.forma_admin_members(user_id) values('776893e1-f940-437c-94a7-40a83bccc013');insert into public.forma_goals(id,user_id,name,target) values('${goal}','${student}','Reserve',500),('${foreign}','${other}','Other',500);`);
 await db.exec(fs.readFileSync('goal-event-security.sql','utf8'));await db.exec(fs.readFileSync('goal-event-security.sql','utf8'));
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${student}',false);`);
 const id='00000000-0000-4000-8000-000000000021';await db.exec(call(id,100));await db.exec(call(id,100));n+=2;
 assert.equal((await db.query('select count(*)::int as n from public.forma_goal_events')).rows[0].n,1);n++;
 await denied(call(id,110),'22023');await denied(call('00000000-0000-4000-8000-000000000022',101,'withdrawal'),'23514');
 await db.exec(call('00000000-0000-4000-8000-000000000023',60,'withdrawal'));n++;
 await denied(call('00000000-0000-4000-8000-000000000024',50,'withdrawal'),'23514');
 await denied(call('00000000-0000-4000-8000-000000000025',1,'contribution',foreign),'42501');
 await denied(`insert into public.forma_goal_events(user_id,goal_id,direction,amount) values('${student}','${goal}','contribution',100)`,'42501');
 await denied(`update public.forma_goals set saved=10000 where id='${goal}'`,'42501');
 await db.exec(`update public.forma_goals set target=600,name='Updated' where id='${goal}'`);n++;
 await denied(call('00000000-0000-4000-8000-000000000026',1.234),'22023');
 await db.exec("select set_config('test.revoked','yes',false)");await denied(call('00000000-0000-4000-8000-000000000027',1),'42501');
 await db.exec("reset role;set role anon;");await denied(call('00000000-0000-4000-8000-000000000028',1),'42501');
 console.log(`PASS ${n} goal database checks; migration applied twice. Ownership, duplicate retry, balance, immutable baseline, denied raw INSERT and inactive/anonymous access.`);
}finally{await db.close();}
