import fs from 'node:fs';import assert from 'node:assert/strict';const {PGlite}=await import(process.env.FORMA_PGLITE_MODULE||'@electric-sql/pglite');
const setupSQL=fs.readFileSync('agenda-setup.sql','utf8'),ownerId=setupSQL.match(/u.id='([^']+)'/)[1],ownerEmail=setupSQL.match(/lower\(u.email\)='([^']+)'/)[1];
const db=new PGlite();const O=ownerId,R='00000000-0000-4000-8000-000000000002',S='00000000-0000-4000-8000-000000000003',I='00000000-0000-4000-8000-000000000004';let n=0;
const data={client:'PRUEBA',phone:'5511999999999',activity:'Mentoría particular',area:'Educación financiera',profession:'PRUEBA',instructor:'René',start_date:'2026-10-12',start_hour:13,duration:2,sessions:3};
const setUser=async id=>{await db.exec(`reset role;select set_config('test.uid','${id}',false);set role authenticated;`);};
const call=async(sql,params=[])=>{const r=await db.query(sql,params);return r.rows[0].v;};const save=async(d,id=null,v=null,reason='')=>call('select public.forma_agenda_save($1,$2,$3,$4) v',[id,v,JSON.stringify(d),reason]);
try{await db.exec(`create role anon;create role authenticated;create schema auth;create schema forma_private;create table auth.users(id uuid primary key,email text,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create table public.forma_admin_members(user_id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('iss',coalesce(nullif(current_setting('test.issuer',true),''),'https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1'),'session_id',auth.uid())$$;
 create function forma_private.access_active() returns boolean language sql stable as $$select coalesce(current_setting('test.blocked',true),'')<>'yes'$$;
 grant usage on schema auth,forma_private to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;
 insert into auth.users(id,email) values('${O}','${ownerEmail}'),('${R}','rene@example.test'),('${S}','student@example.test'),('${I}','instructor@example.test');insert into auth.sessions(id,user_id) select id,id from auth.users;insert into public.forma_admin_members values('${O}');`);

 await db.exec(fs.readFileSync('agenda-setup.sql','utf8'));
 await db.exec(`insert into forma_private.agenda_staff(user_id,role,instructor) values('${R}','manager',null),('${I}','instructor','René');`);

 await db.exec(fs.readFileSync('agenda-services-upgrade.sql','utf8'));await db.exec(fs.readFileSync('agenda-assistant-setup.sql','utf8'));

 const finance=async(a,d={})=>call('select public.forma_finance($1,$2) v',[a,JSON.stringify(d)]),income=async(a,d)=>call('select public.forma_agenda_income($1,$2) v',[a,JSON.stringify(d)]),uuid=()=>crypto.randomUUID();
 await setUser(R);const booking=await save({...data,client:'PRUEBA FINANZAS',booking_state:'reservado'});await income('total',{booking_id:booking.id,total_cents:50000,expected:0});const paymentId=uuid();await income('payment',{id:paymentId,booking_id:booking.id,amount_cents:20000,paid_on:'2026-10-10',method:'pix'});
 const snapshot=async()=>{await db.exec('reset role');return(await db.query(`select jsonb_build_object('b',(select jsonb_agg(to_jsonb(b) order by id) from forma_private.agenda_bookings b),'p',(select jsonb_agg(to_jsonb(p) order by id) from forma_private.agenda_payments p),'h',(select jsonb_agg(to_jsonb(h) order by id) from forma_private.agenda_history h),'c',(select jsonb_agg(to_jsonb(c) order by booking_id) from forma_private.agenda_contracts c)) v`)).rows[0].v;};


 await db.exec('reset role');await db.exec(fs.readFileSync('forma-finance.sql','utf8'));const before=await snapshot();
 await db.exec(fs.readFileSync('forma-workspace-upgrade.sql','utf8'));await db.exec(fs.readFileSync('forma-workspace-upgrade.sql','utf8'));assert.deepEqual(await snapshot(),before);await setUser(R);
 const m=await call('select public.forma_monthly_summary($1) v',[JSON.stringify({month:'2026-10-01'})]);assert.equal(m.encounters,3);assert.equal(m.received_cents,20000);assert.equal(m.crm_available,true);
 console.log('PASS combined installer: rerunnable CRM/periods/cash/monthly installation preserves existing bookings, contracts, payments and history.');
}finally{await db.close();}
