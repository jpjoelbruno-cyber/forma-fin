import fs from 'node:fs';import assert from 'node:assert/strict';const{PGlite}=await import(process.env.FORMA_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite(),O='776893e1-f940-437c-94a7-40a83bccc013',R='00000000-0000-4000-8000-000000000002',S='00000000-0000-4000-8000-000000000003';
const who=async id=>db.exec(`reset role;select set_config('test.uid','${id}',false);set role authenticated;`),call=async(a,d={})=>(await db.query('select public.forma_bank_pilot($1,$2) v',[a,JSON.stringify(d)])).rows[0].v;
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema forma_private;create table auth.users(id uuid primary key,email text,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create table public.forma_admin_members(user_id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('iss',coalesce(nullif(current_setting('test.issuer',true),''),'https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1'),'session_id',auth.uid())$$;
 create function forma_private.access_active() returns boolean language sql stable as $$select true$$;
 grant usage on schema auth,forma_private to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;
 insert into auth.users(id,email) values('${O}','jp.joelbruno@gmail.com'),('${R}','rene@example.test'),('${S}','student@example.test');insert into auth.sessions(id,user_id) select id,id from auth.users;insert into public.forma_admin_members values('${O}');`);
 await db.exec(fs.readFileSync('agenda-setup.sql','utf8'));
 await db.exec(`insert into forma_private.agenda_staff(user_id,role) values('${R}','manager');insert into forma_private.agenda_bookings(client,phone,activity,area,profession,instructor,start_date,start_hour,duration,sessions,created_by) values('NO TOCAR','551199999','Asesoría / agendamiento','Educación financiera','','Joel','2026-10-20',13,1,1,'${R}');create table public.forma_transactions(id int,amount numeric);insert into public.forma_transactions values(1,987.65);`);
 const snapshot=async()=>{await db.exec('reset role');return(await db.query(`select jsonb_build_object('reservas',(select jsonb_agg(to_jsonb(b))from forma_private.agenda_bookings b),'movimientos',(select jsonb_agg(to_jsonb(t))from public.forma_transactions t),'usuarios',(select jsonb_agg(to_jsonb(u))from auth.users u))v`)).rows[0].v;};const before=await snapshot();
 const sql=fs.readFileSync('bank-pilot-setup.sql','utf8');await db.exec(sql);await db.exec(sql);assert.deepEqual(await snapshot(),before);
 await db.exec(`select set_config('request.headers','{"origin":"https://forma-fin.vercel.app"}',false)`);await who(O);assert.equal((await call('capabilities')).readonly,true);assert.equal((await call('state')).link,null);
 await assert.rejects(call('begin',{mode:'live',consent:false,consent_version:'owner-readonly-v1'}),e=>e.code==='22023');
 let r=(await call('begin',{mode:'sandbox',consent:true,consent_version:'owner-readonly-v1'})).link;assert.equal(r.state,'pending');assert.equal(r.user_id,O);
 assert.equal((await call('begin',{mode:'sandbox',consent:true,consent_version:'owner-readonly-v1'})).link.id,r.id);
 await assert.rejects(call('begin',{mode:'live',consent:true,consent_version:'owner-readonly-v1'}),e=>e.code==='40001');
 await assert.rejects(call('bind',{id:r.id,vault:'x',connector_id:2}),e=>e.code==='22023');assert.equal((await call('bind',{id:r.id,vault:'a'.repeat(160),connector_id:2})).saved,true);assert.equal((await call('bind',{id:r.id,vault:'b'.repeat(160),connector_id:2})).saved,true);assert.equal((await call('state')).link.vault,'a'.repeat(160));
 for(const u of[R,S]){await who(u);for(const action of['capabilities','state','begin','bind','revoke','read'])await assert.rejects(call(action,{id:r.id}),e=>e.code==='42501');}
 await who(O);for(const name of['bank_pilot_links','bank_pilot_limits'])await assert.rejects(db.exec('select * from forma_private.'+name),e=>e.code==='42501');
 await db.exec(`select set_config('request.headers','{"origin":"https://eleva.example"}',false)`);await assert.rejects(call('state'),e=>e.code==='42501');await db.exec(`select set_config('request.headers','{"origin":"https://forma-fin.vercel.app"}',false)`);
 await db.exec(`select set_config('test.issuer','https://other.supabase.co/auth/v1',false)`);await assert.rejects(call('state'),e=>e.code==='42501');await db.exec(`select set_config('test.issuer','',false)`);
 await db.exec(`reset role;delete from auth.sessions where user_id='${O}';set role authenticated`);await assert.rejects(call('state'),e=>e.code==='42501');await db.exec(`reset role;insert into auth.sessions(id,user_id) values('${O}','${O}');set role authenticated`);
 assert.equal((await call('revoke',{id:r.id})).revoked,true);assert.equal((await call('state')).link,null);
 for(let i=0;i<60;i++)assert.equal((await call('read')).allowed,true);await assert.rejects(call('read'),e=>e.code==='54000');
 for(let i=0;i<4;i++)await call('begin',{mode:'sandbox',consent:true,consent_version:'owner-readonly-v1'});await assert.rejects(call('begin',{mode:'sandbox',consent:true,consent_version:'owner-readonly-v1'}),e=>e.code==='54000');
 await db.exec('reset role;set role anon');await assert.rejects(call('state'),e=>e.code==='42501');
 assert.deepEqual(await snapshot(),before);console.log('PASS bank database: repeatable installation, exact preservation, independent live session, owner-only RPC, private RLS, consent, concurrent single link, idempotent bind, revocation, quotas and denied anon/manager/student.');
}finally{await db.close()}
