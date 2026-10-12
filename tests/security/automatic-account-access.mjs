// PostgreSQL desechable. No conecta a producción ni incluye cuentas reales de alumnos.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.FORMA_PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
const owner='776893e1-f940-437c-94a7-40a83bccc013',student='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',email='00000000-0000-4000-8000-000000000003',session='00000000-0000-4000-8000-000000000011';
const issuer='https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1';let count=0;
async function claims(uid=student,patch={}){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid,iss:issuer,session_id:session,is_anonymous:false,amr:[{method:'oauth'}],...patch})]);}
async function status(){return(await db.query('select public.forma_access_status() as result')).rows[0].result.status;}
async function denied(patch){await claims(student,patch);await assert.rejects(db.query('select public.forma_access_status()'),e=>e.code==='42501');count++;}
try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create schema forma_private;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',encrypted_password text default '',banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
 create table auth.identities(user_id uuid,provider text);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 create table public.forma_admin_members(user_id uuid primary key);
 create table forma_private.app_access(user_id uuid primary key,status text,display_name text,reason text,requested_at timestamptz,updated_at timestamptz);
 create table forma_private.app_access_audit(id bigint generated always as identity,user_id uuid,actor_id uuid,previous_status text,new_status text);
 alter table forma_private.app_access enable row level security;alter table forma_private.app_access_audit enable row level security;
 grant usage on schema auth,forma_private to authenticated;grant execute on function auth.jwt(),auth.uid() to authenticated;
 insert into auth.users(id,email,email_confirmed_at) values('${owner}','jp.joelbruno@gmail.com',now()),('${student}','student@example.test',now()),('${other}','other@example.test',now()),('${email}','email@example.test',now());
 insert into public.forma_admin_members values('${owner}');insert into auth.identities values('${student}','google'),('${other}','google'),('${email}','email');
 insert into auth.sessions values('${session}','${student}',null);`);
 await db.exec(fs.readFileSync('automatic-account-access.sql','utf8'));await db.exec(fs.readFileSync('automatic-account-access.sql','utf8'));
 await db.exec('set role authenticated');await claims();assert.equal(await status(),'active');assert.equal(await status(),'active');count+=2;
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from forma_private.app_access_audit')).rows[0].n,1);assert.equal((await db.query(`select count(*)::int as n from forma_private.app_access where user_id='${other}'`)).rows[0].n,0);assert.equal((await db.query('select count(*)::int as n from public.forma_admin_members')).rows[0].n,1);count+=3;
 await db.exec(`delete from forma_private.app_access where user_id='${student}';set role authenticated`);await claims(student,{amr:[{method:'password'}],user_metadata:{provider:'google',role:'admin'}});assert.equal(await status(),'pending_validation');count++;
 await denied({iss:'https://ipcqlltatvpvrqceqiox.supabase.co/auth/v1'});await denied({session_id:other});await denied({is_anonymous:true});
 await db.exec(`reset role;update auth.sessions set not_after=now()-interval '1 minute';set role authenticated;`);await denied({});
 await db.exec(`reset role;update auth.sessions set not_after=null;update auth.users set banned_until=now()+interval '1 day' where id='${student}';set role authenticated;`);await denied({});
 await db.exec(`reset role;update auth.users set banned_until=null,email_confirmed_at=null where id='${student}';set role authenticated;`);await claims();assert.equal(await status(),'pending_validation');count++;
 await db.exec(`reset role;update auth.users set email_confirmed_at=now() where id='${student}';update forma_private.app_access set reason='owner_blocked' where user_id='${student}';set role authenticated;`);assert.equal(await status(),'pending_validation');count++;
 await db.exec(`reset role;update forma_private.app_access set reason='explicit_access_request' where user_id='${student}';set role authenticated;`);assert.equal(await status(),'active');count++;
 await db.exec(`reset role;update auth.sessions set user_id='${email}';set role authenticated`);await claims(email);assert.equal(await status(),'pending_validation');count++;
 await claims(email,{amr:[{method:'password'}]});assert.equal(await status(),'active');count++;
 await db.exec(`reset role;delete from forma_private.app_access where user_id='${email}';update auth.users set email_confirmed_at=null where id='${email}';set role authenticated;`);
 await claims(email,{amr:[{method:'password'}],user_metadata:{email_confirmed_at:'2026-10-12',role:'admin'}});assert.equal(await status(),'pending_validation');count++;
 await db.exec(`reset role;update auth.users set email_confirmed_at=now() where id='${email}';set role authenticated;`);
 await claims(email,{amr:[{method:'email/signup'}]});assert.equal(await status(),'active');count++;
 await db.exec(`reset role;update auth.sessions set user_id='${student}';update auth.users set encrypted_password='fixturehash' where id='${student}';update forma_private.app_access set status='pending_validation',reason='explicit_access_request' where user_id='${student}';set role authenticated;`);
 await claims(student,{amr:[{method:'password'}]});assert.equal(await status(),'active');count++;

 await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.forma_access_status()'),e=>e.code==='42501');count++;
 console.log(`PASS ${count} automatic Google/email checks: verified own session only, replay idempotence, no bulk approval/admin escalation, password/spoofed metadata, foreign issuer, expired/wrong session, ban, unconfirmed identity, manual block and anonymous access.`);
}finally{await db.close();}
