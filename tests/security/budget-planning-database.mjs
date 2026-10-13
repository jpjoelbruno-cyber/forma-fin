// Disposable PostgreSQL. Never connects to a hosted database.
import fs from 'node:fs';import assert from 'node:assert/strict';const {PGlite}=await import(process.env.FORMA_PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';let n=0;
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema forma_private;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function forma_private.access_active() returns boolean language sql stable as $$select auth.uid() is not null and coalesce(current_setting('test.revoked',true),'')<>'yes'$$;
 grant usage on schema auth,forma_private to authenticated;grant execute on function auth.uid(),forma_private.access_active() to authenticated;`);
 await db.exec(fs.readFileSync('isolated-schema.sql','utf8'));
 await db.exec(`insert into auth.users(id,email) values('776893e1-f940-437c-94a7-40a83bccc013','jp.joelbruno@gmail.com'),('${A}','a@example.test'),('${B}','b@example.test');insert into public.forma_admin_members(user_id) values('776893e1-f940-437c-94a7-40a83bccc013');insert into public.forma_budgets(user_id,month,category,planned) values('${A}','2026-10','alquiler',1500),('${B}','2026-10','alquiler',500);`);
 await db.exec(fs.readFileSync('budget-planning-state.sql','utf8'));await db.exec(fs.readFileSync('budget-planning-state.sql','utf8'));
 assert.equal((await db.query(`select planned from public.forma_budgets where user_id='${A}'`)).rows[0].planned,'1500.00');n++;
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${A}',false);`);
 let state=(await db.query("select public.forma_budget_review_state('2026-10') as v")).rows[0].v;assert.equal(state.supports_pending,true);assert.deepEqual(state.reviewed,[]);n++;
 await db.exec("select public.forma_budget_review_mark('2026-10','servicios',true)");await db.exec("select public.forma_budget_review_mark('2026-10','servicios',true)");
 assert.equal((await db.query('select count(*)::int n from public.forma_budget_sections')).rows[0].n,1);assert.deepEqual((await db.query("select public.forma_budget_review_state('2026-10') v")).rows[0].v.reviewed,['servicios']);n+=2;
 await db.exec(`insert into public.forma_budgets(user_id,month,category,planned) values('${A}','2026-10','agua',null),('${A}','2026-10','gas',0)`);
 const rows=(await db.query("select category,planned from public.forma_budgets where category in ('agua','gas') order by category")).rows;assert.equal(rows[0].planned,null);assert.equal(Number(rows[1].planned),0);n++;
 await assert.rejects(db.exec(`insert into public.forma_budget_sections(user_id,month,section,reviewed) values('${B}','2026-10','seguros',true)`),e=>e.code==='42501');n++;
 await assert.rejects(db.exec(`update public.forma_budget_sections set user_id='${B}'`),e=>e.code==='42501');n++;
 await assert.rejects(db.exec("select public.forma_budget_review_mark('2026-99','servicios',true)"),e=>e.code==='22023');n++;
 await db.exec(`select set_config('request.jwt.claim.sub','${B}',false)`);assert.deepEqual((await db.query("select public.forma_budget_review_state('2026-10') v")).rows[0].v.reviewed,[]);n++;
 await db.exec("select set_config('test.revoked','yes',false)");await assert.rejects(db.exec("select public.forma_budget_review_mark('2026-10','seguros',true)"),e=>e.code==='42501');n++;
 await db.exec('reset role;set role anon');await assert.rejects(db.exec("select public.forma_budget_review_state('2026-10')"),e=>e.code==='42501');n++;
 console.log(`PASS ${n} budget database checks: preserves old amounts, null vs zero, idempotent own review, no cross-user access, immutable owner, malformed month, revoked and anonymous access.`);
}finally{await db.close()}
