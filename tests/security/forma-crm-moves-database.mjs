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
 const crm=async(action,d={})=>call('select public.forma_crm($1,$2) v',[action,JSON.stringify(d)]);
 const request=()=>crypto.randomUUID();

 await db.exec(fs.readFileSync('forma-crm.sql','utf8'));await setUser(R);
 const person=await crm('person_save',{request_id:request(),name:'PRUEBA PERSONA',phone:'5511999990000',email:'person@example.test',language:'es'}),pid=person.person_id;
 const payload={request_id:request(),person_id:pid,area:'Computación',stage:'nuevo',source:'whatsapp',next_action:'Llamar mañana',due_on:'2026-10-21',note:'Conservar esta nota',temperature:'caliente',due_time:'14:00'};
 const interest=await crm('interest_save',payload),iid=interest.interest_id;await crm('interest_save',{...payload,request_id:request(),area:'Educación financiera',stage:'cerrado',close_reason:'Lo retomará después',outcome:'retomar'});
 const old=await save({...data,booking_state:'reservado'});await call('select public.forma_agenda_income($1,$2) v',['total',JSON.stringify({booking_id:old.id,total_cents:30000,expected:0})]);await call('select public.forma_agenda_income($1,$2) v',['payment',JSON.stringify({id:request(),booking_id:old.id,amount_cents:10000,method:'pix',paid_on:'2026-10-10'})]);
 const snapshot=async(tables)=>{await db.exec('reset role');let o={};for(const t of tables)o[t]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') v from forma_private.${t} x`)).rows[0].v;return o;};
 const tables=['agenda_bookings','agenda_contracts','agenda_payments','agenda_history','crm_people','crm_booking_people','crm_interests','crm_requests','crm_audit'];const before=await snapshot(tables);
 await db.exec("alter table forma_private.crm_interests drop constraint crm_interests_stage_check;alter table forma_private.crm_interests add constraint crm_interests_stage_check check(stage in ('nuevo','conversacion','seguimiento','preparar_matricula','cerrado'))");
 await db.exec(fs.readFileSync('forma-crm.sql','utf8'));await db.exec(fs.readFileSync('forma-crm.sql','utf8'));assert.deepEqual(await snapshot(tables),before);await setUser(R);
 assert.equal((await crm('capabilities')).drag_moves,true);
 const move={request_id:request(),person_id:pid,id:iid,expected:1,stage:'conversacion'};const moved=await crm('interest_move',move);assert.equal(moved.version,2);assert.equal((await crm('interest_move',move)).already_saved,true);
 let profile=await crm('detail',{person_id:pid}),i=profile.interests.find(x=>x.id===iid);assert.equal(i.next_action,payload.next_action);assert.equal(i.note,payload.note);assert.equal(i.source,payload.source);assert.equal(i.temperature,'caliente');assert.equal(i.due_on,payload.due_on);assert.equal(i.due_time,'14:00:00');assert.equal(profile.interests.find(x=>x.stage==='cerrado').outcome,'retomar');
 await assert.rejects(crm('interest_move',{...move,request_id:request(),stage:'seguimiento'}),e=>e.code==='40001');
 await assert.rejects(crm('interest_move',{...move,request_id:request(),expected:2,stage:'matriculado'}),e=>e.code==='22023');assert.equal((await crm('detail',{person_id:pid})).enrolments.length,0);
 const enrol={...move,request_id:request(),expected:2,stage:'matriculado',confirm_enrolment:true,course:'Computación',starts_on:'2026-11-02',payment_plan:'presencial'};
 const confirmed=await crm('interest_move',enrol);assert.ok(confirmed.enrolment_id);assert.equal((await crm('interest_move',enrol)).already_saved,true);profile=await crm('detail',{person_id:pid});assert.equal(profile.enrolments.length,1);assert.equal(profile.enrolments[0].payment_plan,'presencial');assert.equal(profile.interests.length,2);assert.equal(profile.person.id,pid);
 await assert.rejects(crm('interest_move',{...enrol,person_id:R,request_id:request(),expected:3}),e=>e.code==='40001');
 await assert.rejects(crm('interest_save',{...payload,request_id:request(),id:iid,expected:3,area:'Otro curso',stage:'matriculado'}),e=>e.code==='22023');
 const back=await crm('interest_move',{...move,request_id:request(),expected:3,stage:'seguimiento'});assert.equal(back.version,4);assert.equal((await crm('detail',{person_id:pid})).enrolments.length,1);
 await crm('interest_move',{...enrol,request_id:request(),expected:4});assert.equal((await crm('detail',{person_id:pid})).enrolments.length,1);
 const other=await crm('interest_save',{...payload,request_id:request(),area:'Inteligencia artificial'});await assert.rejects(crm('interest_save',{...payload,id:other.interest_id,expected:1,request_id:request(),stage:'matriculado'}),e=>e.code==='22023');
 const history=await crm('interest_history',{id:iid});assert.equal(history.items.filter(x=>x.action==='interest_move').length,4);assert.ok(history.items.every(x=>x.actor===R));assert.ok(history.items.some(x=>x.snapshot.before_stage==='nuevo'&&x.snapshot.after_stage==='conversacion'));

 // Automatic heat updates are independent of stage; undo restores only this move.
 assert.equal((await crm('capabilities')).undo_moves,true);
 const heat={request_id:request(),person_id:pid,id:iid,expected:5,temperature:'frio'};const cooled=await crm('interest_move',heat);assert.equal(cooled.stage,'matriculado');assert.equal(cooled.temperature,'frio');assert.equal(cooled.enrolment_changed,false);
 const undoHeat={request_id:request(),person_id:pid,undo_of:heat.request_id,expected:6};const restored=await crm('interest_undo',undoHeat);assert.equal(restored.stage,'matriculado');assert.equal(restored.temperature,'caliente');assert.equal(restored.version,7);assert.equal((await crm('interest_undo',undoHeat)).already_saved,true);
 await assert.rejects(crm('interest_undo',{...undoHeat,request_id:request(),expected:7}),e=>e.code==='40001');
 // Enrol without asking optional dates, instructor or payment details. Undo keeps the row as reverted.
 const auto={request_id:request(),person_id:pid,id:other.interest_id,expected:1,stage:'matriculado',confirm_enrolment:true,course:'Inteligencia artificial',payment_plan:'sin_definir'};
 const enrolled=await crm('interest_move',auto);assert.equal(enrolled.enrolment_changed,true);assert.ok(enrolled.enrolment_id);let courses=(await crm('detail',{person_id:pid})).enrolments;assert.equal(courses.length,2);assert.equal(courses.find(x=>x.id===enrolled.enrolment_id).starts_on,null);
 const unroll={request_id:request(),person_id:pid,undo_of:auto.request_id,expected:2};await crm('interest_undo',unroll);courses=(await crm('detail',{person_id:pid})).enrolments;assert.equal(courses.length,2);assert.equal(courses.find(x=>x.id===enrolled.enrolment_id).status,'revertida');
 await assert.rejects(crm('interest_save',{...payload,request_id:request(),id:other.interest_id,expected:3,area:'Inteligencia artificial',stage:'matriculado'}),e=>e.code==='22023');
 const again={...auto,request_id:request(),expected:3};const reenrolled=await crm('interest_move',again);assert.equal(reenrolled.enrolment_id,enrolled.enrolment_id);assert.equal((await crm('detail',{person_id:pid})).enrolments.length,2);assert.equal(reenrolled.enrolment_status_before,'revertida');
 await crm('interest_move',{request_id:request(),person_id:pid,id:other.interest_id,expected:4,temperature:'frio'});await assert.rejects(crm('interest_undo',{request_id:request(),person_id:pid,undo_of:again.request_id,expected:4}),e=>e.code==='40001');
 const counts=await crm('sales');assert.equal(counts.temperature_counts.frio,1);assert.equal(counts.counts.matriculado,2);
 await setUser(O);await assert.rejects(crm('interest_undo',{...undoHeat,request_id:request()}),e=>e.code==='22023');await setUser(R);
 const stable=await snapshot(['agenda_bookings','agenda_contracts','agenda_payments','agenda_history']);for(const t of Object.keys(stable))assert.deepEqual(stable[t],before[t]);await setUser(R);
 for(const who of [S,I]){await setUser(who);await assert.rejects(crm('interest_move',move),e=>e.code==='42501');await assert.rejects(crm('interest_history',{id:iid}),e=>e.code==='42501');}await setUser(R);await assert.rejects(db.exec('select * from forma_private.crm_enrolments'),e=>e.code==='42501');
 await db.exec("select set_config('test.issuer','https://other-app.supabase.co/auth/v1',false)");await assert.rejects(crm('interest_move',move),e=>e.code==='42501');await db.exec("select set_config('test.issuer','',false)");await db.exec("select set_config('test.blocked','yes',false)");await assert.rejects(crm('interest_move',move),e=>e.code==='42501');await db.exec("select set_config('test.blocked','',false)");await db.exec('reset role;set role anon');await assert.rejects(crm('interest_move',move),e=>e.code==='42501');
 console.log('PASS CRM moves database: legacy upgrade preserves every old record; automatic stage/heat updates, idempotent enrolment and undo without deletion, stale/cross-actor undo rejection, version conflicts, history, same person with multiple interests, unchanged money/agenda, role and issuer isolation.');
}finally{await db.close();}
