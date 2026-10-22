-- FORMA: activación atómica y aditiva; conserva registros existentes.
begin;
-- FORMA · Personas y Ventas v1. Aditivo: no elimina ni reescribe reservas/pagos.
-- Solo proyecto irsuevjqmgpwunvymxbc, después de agenda-services-upgrade.sql.

do $$begin
 if to_regprocedure('forma_private.agenda_role()') is null then raise exception 'Falta la agenda de FORMA';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Proyecto incorrecto: usar FORMA independiente';end if;
 if to_regclass('forma_private.agenda_attendance') is null then raise exception 'Falta activar el asistente de agenda';end if;
 if to_regprocedure('forma_private.agenda_register(uuid,jsonb,jsonb,text)') is null then raise exception 'Falta la actualización de pagos de agenda';end if;
end$$;
create table if not exists forma_private.crm_people(
 id uuid primary key,number bigint generated always as identity unique,name text not null check(length(trim(name)) between 2 and 160),phone text not null default '' check(length(phone)<=40),email text not null default '' check(length(email)<=254),language text not null default 'es' check(language in ('es','pt')),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists forma_private.crm_booking_people(booking_id uuid primary key references forma_private.agenda_bookings(id),person_id uuid not null references forma_private.crm_people(id),actor uuid not null references auth.users(id),created_at timestamptz not null default now());
create index if not exists crm_booking_people_person on forma_private.crm_booking_people(person_id);
create table if not exists forma_private.crm_interests(
 id uuid primary key,person_id uuid not null references forma_private.crm_people(id),area text not null check(length(trim(area)) between 1 and 120),stage text not null check(stage in ('nuevo','conversacion','seguimiento','preparar_matricula','matriculado','cerrado')),source text not null check(source in ('presencial','whatsapp','tiktok','instagram','facebook','recomendacion','desconocido')),next_action text not null default '' check(length(next_action)<=400),due_on date check(due_on between '2020-01-01' and '2045-12-31'),note text not null default '' check(length(note)<=1000),close_reason text not null default '' check(length(close_reason)<=400),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
-- Expand only the stage constraint; all existing values and rows remain unchanged.
alter table forma_private.crm_interests drop constraint if exists crm_interests_stage_check;
alter table forma_private.crm_interests add constraint crm_interests_stage_check check(stage in ('nuevo','conversacion','seguimiento','preparar_matricula','matriculado','cerrado'));
create table if not exists forma_private.crm_enrolments(
 id uuid primary key,interest_id uuid not null unique references forma_private.crm_interests(id),person_id uuid not null references forma_private.crm_people(id),course text not null check(length(trim(course)) between 1 and 120),starts_on date check(starts_on between '2020-01-01' and '2045-12-31'),payment_plan text not null check(payment_plan in ('sin_definir','presencial','acuerdo')),created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table forma_private.crm_enrolments add column if not exists status text not null default 'confirmada' check(status in ('confirmada','revertida'));
create index if not exists crm_enrolments_person on forma_private.crm_enrolments(person_id);
alter table forma_private.crm_enrolments enable row level security;
revoke all on forma_private.crm_enrolments from public,anon,authenticated;
alter table forma_private.crm_interests add column if not exists temperature text not null default '' check(temperature in ('','frio','tibio','caliente','muy_caliente'));
alter table forma_private.crm_interests add column if not exists due_time time;
alter table forma_private.crm_interests add column if not exists outcome text not null default '' check(outcome in ('','ganado','perdido','retomar'));
create table if not exists forma_private.crm_catalog(id uuid primary key,title text not null check(length(trim(title)) between 2 and 160),area text not null check(length(area) between 1 and 120),language text not null check(language in ('es','pt')),price_cents bigint check(price_cents between 0 and 100000000000),duration text not null default '' check(length(duration)<=120),answer text not null check(length(answer) between 1 and 3000),material_url text not null default '' check(material_url='' or material_url~'^https://[^[:space:]]+$'),approved boolean not null default false,version integer not null default 1,actor uuid not null references auth.users(id),updated_at timestamptz not null default now());
alter table forma_private.crm_catalog enable row level security;
revoke all on forma_private.crm_catalog from public,anon,authenticated;
create or replace function forma_private.crm_normalize(t text) returns text language sql immutable set search_path='' as $$select replace(translate(lower(coalesce(t,'')),'áàâãäéèêëíìîïóòôõöúùûüñç','aaaaaeeeeiiiiooooouuuunc'),'v','b')$$;
revoke all on function forma_private.crm_normalize(text) from public,anon,authenticated;
create index if not exists crm_interests_person on forma_private.crm_interests(person_id);
create index if not exists crm_interests_stage_due on forma_private.crm_interests(stage,due_on);
create table if not exists forma_private.crm_requests(id uuid primary key,actor uuid not null references auth.users(id),action text not null,payload jsonb not null,result jsonb not null,at timestamptz not null default now());
create table if not exists forma_private.crm_audit(id bigint generated always as identity primary key,person_id uuid not null references forma_private.crm_people(id),actor uuid not null references auth.users(id),action text not null,snapshot jsonb not null,at timestamptz not null default now());
alter table forma_private.crm_people enable row level security;
alter table forma_private.crm_booking_people enable row level security;
alter table forma_private.crm_interests enable row level security;
alter table forma_private.crm_requests enable row level security;
alter table forma_private.crm_audit enable row level security;
revoke all on forma_private.crm_people,forma_private.crm_booking_people,forma_private.crm_interests,forma_private.crm_requests,forma_private.crm_audit from public,anon,authenticated;
revoke all on sequence forma_private.crm_people_number_seq,forma_private.crm_audit_id_seq from public,anon,authenticated;
create or replace function forma_private.crm(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();uid uuid:=auth.uid();pid uuid;bid uuid;rid uuid;v_query text;v_offset integer;v_name text;v_phone text;v_email text;v_language text;v_stage text;v_source text;v_area text;v_due date;v_id uuid;v_expected integer;v_person forma_private.crm_people;v_interest forma_private.crm_interests;v_request forma_private.crm_requests;v_booking forma_private.agenda_bookings;v_enrolment forma_private.crm_enrolments;v_original forma_private.crm_requests;v_before_enrolment text;result jsonb;payload jsonb;today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if r is null or uid is null or r not in ('owner','manager') then raise exception 'Personas y Ventas requieren acceso de gestión' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'role',r,'people',true,'sales',true,'enrolments',true,'editor_enrolment',true,'drag_moves',true,'automatic_moves',true,'undo_moves',true,'automatic_messages',false,'enhanced_sales',true,'catalog',true);end if;
 if p_action='catalog_list' then return jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(x) from(select * from forma_private.crm_catalog where approved or r='owner' order by title,id limit 301)x),'[]'::jsonb));end if;
 if p_action='alerts' then return jsonb_build_object('version',1,'total_count',(select count(*) from forma_private.crm_interests where stage not in ('cerrado','matriculado') and due_on<=today),'items',coalesce((select jsonb_agg(x) from(select i.id,i.person_id,i.area,i.next_action,i.due_on,i.due_time,p.name,p.phone from forma_private.crm_interests i join forma_private.crm_people p on p.id=i.person_id where i.stage not in ('cerrado','matriculado') and i.due_on<=today order by i.due_on,i.due_time nulls last,i.id limit 101)x),'[]'::jsonb));end if;
 if p_action='catalog_save' then
  if r<>'owner' then raise exception 'Solo dirección edita y aprueba el catálogo' using errcode='42501';end if;
  rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'Falta solicitud' using errcode='22023';end if;
  perform pg_advisory_xact_lock(7860172026::bigint);select * into v_request from forma_private.crm_requests where id=rid;
  if found then if v_request.actor<>uid or v_request.action<>p_action or v_request.payload<>p_data then raise exception 'Solicitud usada' using errcode='22023';end if;return v_request.result||jsonb_build_object('already_saved',true);end if;
  v_id:=(p_data->>'id')::uuid;
  if v_id is null then v_id:=rid;
   insert into forma_private.crm_catalog(id,title,area,language,price_cents,duration,answer,material_url,approved,actor) values(v_id,trim(p_data->>'title'),trim(p_data->>'area'),p_data->>'language',nullif(p_data->>'price_cents','')::bigint,coalesce(p_data->>'duration',''),p_data->>'answer',coalesce(p_data->>'material_url',''),coalesce((p_data->>'approved')::boolean,false),uid);
  else
   update forma_private.crm_catalog set title=trim(p_data->>'title'),area=trim(p_data->>'area'),language=p_data->>'language',price_cents=nullif(p_data->>'price_cents','')::bigint,duration=coalesce(p_data->>'duration',''),answer=p_data->>'answer',material_url=coalesce(p_data->>'material_url',''),approved=coalesce((p_data->>'approved')::boolean,false),version=version+1,actor=uid,updated_at=now() where id=v_id and version=(p_data->>'expected')::integer;
   if not found then raise exception 'El catálogo cambió. Actualiza' using errcode='40001';end if;
  end if;
  result:=jsonb_build_object('saved',true,'id',v_id);insert into forma_private.crm_requests(id,actor,action,payload,result) values(rid,uid,p_action,p_data,result);return result;
 end if;
 if p_action='search' then
  v_query:=forma_private.crm_normalize(trim(coalesce(p_data->>'query','')));v_offset:=coalesce((p_data->>'offset')::integer,0);
  if length(v_query)>160 or v_offset<0 or v_offset>100000 then raise exception 'Búsqueda inválida' using errcode='22023';end if;
  return jsonb_build_object('people',coalesce((select jsonb_agg(x) from(select p.id,'FOR-'||lpad(p.number::text,greatest(6,length(p.number::text)),'0') as code,p.name,p.phone,p.email,p.language,p.version,(select count(*) from forma_private.crm_booking_people l where l.person_id=p.id) as linked_reservations from forma_private.crm_people p where v_query='' or position(v_query in forma_private.crm_normalize(p.name||' '||p.phone||' '||p.email||' FOR-'||lpad(p.number::text,greatest(6,length(p.number::text)),'0')))>0 or (length(regexp_replace(v_query,'[^0-9]','','g'))>=5 and position(regexp_replace(v_query,'[^0-9]','','g') in regexp_replace(p.phone,'[^0-9]','','g'))>0) order by lower(p.name),p.id limit 31 offset v_offset)x),'[]'::jsonb),'offset',v_offset,
  'legacy',case when length(v_query)>=2 and v_offset=0 then coalesce((select jsonb_agg(x) from(select b.id,b.client as name,b.phone,b.area,b.start_date,b.cancelled from forma_private.agenda_bookings b where not exists(select 1 from forma_private.crm_booking_people l where l.booking_id=b.id) and (position(v_query in forma_private.crm_normalize(b.client||' '||b.phone))>0 or (length(regexp_replace(v_query,'[^0-9]','','g'))>=5 and position(regexp_replace(v_query,'[^0-9]','','g') in regexp_replace(b.phone,'[^0-9]','','g'))>0)) order by b.start_date desc,b.id limit 21)x),'[]'::jsonb) else '[]'::jsonb end);
 elsif p_action='detail' then
  pid:=(p_data->>'person_id')::uuid;select * into v_person from forma_private.crm_people where id=pid;if not found then raise exception 'Persona no encontrada' using errcode='22023';end if;
  return jsonb_build_object('person',to_jsonb(v_person)-'created_by','code','FOR-'||lpad(v_person.number::text,greatest(6,length(v_person.number::text)),'0'),
  'bookings',coalesce((select jsonb_agg(x) from(select b.id,b.client,b.activity,b.area,b.start_date,b.start_hour,b.duration,b.sessions,b.instructor,b.cancelled from forma_private.crm_booking_people l join forma_private.agenda_bookings b on b.id=l.booking_id where l.person_id=pid order by b.start_date desc,b.id limit 101)x),'[]'::jsonb),
  'attendance',coalesce((select jsonb_agg(x) from(select a.booking_id,a.day,a.status from forma_private.agenda_attendance a join forma_private.crm_booking_people l on l.booking_id=a.booking_id where l.person_id=pid order by a.day desc,a.booking_id limit 101)x),'[]'::jsonb),
  'enrolments',coalesce((select jsonb_agg(x) from(select id,interest_id,course,starts_on,payment_plan,status,created_at from forma_private.crm_enrolments where person_id=pid order by created_at desc,id limit 101)x),'[]'::jsonb),
  'interests',coalesce((select jsonb_agg(x) from(select * from forma_private.crm_interests where person_id=pid order by updated_at desc,id limit 101)x),'[]'::jsonb));
 elsif p_action='sales' then
  v_stage:=coalesce(p_data->>'stage','');v_offset:=coalesce((p_data->>'offset')::integer,0);
  if v_offset<0 or v_offset>100000 or v_stage not in ('','nuevo','conversacion','seguimiento','preparar_matricula','matriculado','cerrado') then raise exception 'Filtro inválido' using errcode='22023';end if;
  return jsonb_build_object('counts',coalesce((select jsonb_object_agg(stage,n) from(select stage,count(*) n from forma_private.crm_interests group by stage)x),'{}'::jsonb),
  'temperature_counts',coalesce((select jsonb_object_agg(temperature,n) from(select temperature,count(*) n from forma_private.crm_interests where (v_stage='' and stage<>'cerrado') or stage=v_stage group by temperature)x),'{}'::jsonb),
  'items',coalesce((select jsonb_agg(x) from(select i.*,p.name,p.phone,(select to_jsonb(e)-'created_by' from forma_private.crm_enrolments e where e.interest_id=i.id) enrolment from forma_private.crm_interests i join forma_private.crm_people p on p.id=i.person_id where (v_stage='' and i.stage<>'cerrado') or i.stage=v_stage order by i.due_on nulls last,i.updated_at desc,i.id limit 51 offset v_offset)x),'[]'::jsonb),'offset',v_offset);
 end if;
 if p_action='interest_history' then
  v_id:=(p_data->>'id')::uuid;v_offset:=coalesce((p_data->>'offset')::integer,0);
  if v_offset<0 or v_offset>100000 or not exists(select 1 from forma_private.crm_interests where id=v_id) then raise exception 'Seguimiento no disponible' using errcode='22023';end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(x) from(select id,actor,action,snapshot,at from forma_private.crm_audit where snapshot->>'id'=v_id::text or snapshot->>'request_id'=v_id::text order by at desc,id desc limit 51 offset v_offset)x),'[]'::jsonb));
 end if;
 if p_action not in ('person_save','link','interest_save','interest_move','interest_undo','reserve') then raise exception 'Acción no disponible' using errcode='22023';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'Falta identificador de solicitud' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860172026::bigint);
 select * into v_request from forma_private.crm_requests where id=rid;
 if found then if v_request.actor<>uid or v_request.action<>p_action or v_request.payload<>p_data then raise exception 'Solicitud usada con otros datos' using errcode='22023';end if;return v_request.result||jsonb_build_object('already_saved',true);end if;
 pid:=(p_data->>'person_id')::uuid;
 if p_action='person_save' then
  v_name:=trim(coalesce(p_data->>'name',''));v_phone:=trim(coalesce(p_data->>'phone',''));v_email:=lower(trim(coalesce(p_data->>'email','')));v_language:=coalesce(p_data->>'language','es');
  if length(v_name)<2 or length(v_name)>160 or length(v_phone)>40 or length(v_email)>254 or (v_email<>'' and v_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or v_language not in ('es','pt') then raise exception 'Revisa nombre, contacto e idioma' using errcode='22023';end if;
  if pid is null then
   pid:=rid;insert into forma_private.crm_people(id,name,phone,email,language,created_by) values(pid,v_name,v_phone,v_email,v_language,uid);
  else
   select * into v_person from forma_private.crm_people where id=pid for update;
   if not found or v_person.version is distinct from (p_data->>'expected')::integer then raise exception 'La ficha cambió. Actualiza' using errcode='40001';end if;
   update forma_private.crm_people set name=v_name,phone=v_phone,email=v_email,language=v_language,version=version+1,updated_at=now() where id=pid;
  end if;
  bid:=(p_data->>'booking_id')::uuid;
 elsif p_action='interest_undo' then
  select * into v_original from forma_private.crm_requests where id=(p_data->>'undo_of')::uuid and actor=uid and action='interest_move';
  if not found or not(v_original.result ? 'before_stage') or v_original.payload->>'person_id' is distinct from pid::text then raise exception 'Movimiento no disponible para deshacer' using errcode='22023';end if;
  v_id:=(v_original.payload->>'id')::uuid;
  select * into v_interest from forma_private.crm_interests where id=v_id and person_id=pid for update;
  if not found or v_interest.version is distinct from (p_data->>'expected')::integer or v_interest.version is distinct from (v_original.result->>'version')::integer then raise exception 'El seguimiento cambió. No se puede deshacer sobre cambios posteriores' using errcode='40001';end if;
  if coalesce((v_original.result->>'enrolment_changed')::boolean,false) then
   update forma_private.crm_enrolments set status=coalesce(v_original.result->>'enrolment_status_before','revertida') where interest_id=v_id;
  end if;
  update forma_private.crm_interests set stage=v_original.result->>'before_stage',temperature=v_original.result->>'before_temperature',close_reason=v_original.result->>'before_close_reason',version=version+1,updated_at=now() where id=v_id returning version into v_expected;
  result:=jsonb_build_object('saved',true,'person_id',pid,'interest_id',v_id,'stage',v_original.result->>'before_stage','temperature',v_original.result->>'before_temperature','version',v_expected,'enrolment_status',(select status from forma_private.crm_enrolments where interest_id=v_id));
  insert into forma_private.crm_audit(person_id,actor,action,snapshot) values(pid,uid,p_action,p_data||jsonb_build_object('id',v_id,'before_stage',v_interest.stage,'after_stage',v_original.result->>'before_stage','before_temperature',v_interest.temperature,'after_temperature',v_original.result->>'before_temperature'));
  insert into forma_private.crm_requests(id,actor,action,payload,result) values(rid,uid,p_action,p_data,result);return result;
 elsif p_action='interest_move' then
  v_id:=(p_data->>'id')::uuid;
  select * into v_interest from forma_private.crm_interests where id=v_id and person_id=pid for update;
  if not found or v_interest.version is distinct from (p_data->>'expected')::integer then raise exception 'El seguimiento cambió. Actualiza antes de moverlo' using errcode='40001';end if;
  v_stage:=coalesce(p_data->>'stage',v_interest.stage);
  if coalesce(p_data->>'temperature',v_interest.temperature) not in ('','frio','tibio','caliente','muy_caliente') then raise exception 'Nivel de interés inválido' using errcode='22023';end if;
  if v_stage is null or v_stage not in ('nuevo','conversacion','seguimiento','preparar_matricula','matriculado','cerrado') or (v_stage='cerrado' and length(trim(coalesce(p_data->>'close_reason','')))=0) or length(coalesce(p_data->>'close_reason',''))>400 then raise exception 'Revisa etapa y motivo de cierre' using errcode='22023';end if;
  if v_stage='matriculado' then
   select * into v_enrolment from forma_private.crm_enrolments where interest_id=v_id;
   v_before_enrolment:=v_enrolment.status;
   if not found then
    v_due:=nullif(p_data->>'starts_on','')::date;
    if p_data->>'confirm_enrolment' is distinct from 'true' or trim(coalesce(p_data->>'course',''))<>v_interest.area or coalesce(p_data->>'payment_plan','') not in ('sin_definir','presencial','acuerdo') or (v_due is not null and (v_due<'2020-01-01' or v_due>'2045-12-31')) then raise exception 'Confirma curso y condición de pago de la matrícula' using errcode='22023';end if;
    insert into forma_private.crm_enrolments(id,interest_id,person_id,course,starts_on,payment_plan,created_by) values(rid,v_id,pid,v_interest.area,v_due,p_data->>'payment_plan',uid) returning * into v_enrolment;
   elsif v_enrolment.status='revertida' then
    update forma_private.crm_enrolments set status='confirmada' where id=v_enrolment.id;
   end if;
  end if;
  update forma_private.crm_interests set stage=v_stage,temperature=coalesce(p_data->>'temperature',temperature),close_reason=case when v_stage='cerrado' then trim(p_data->>'close_reason') else close_reason end,version=version+1,updated_at=now() where id=v_id returning version into v_expected;
  insert into forma_private.crm_audit(person_id,actor,action,snapshot) values(pid,uid,p_action,p_data||jsonb_build_object('before_stage',v_interest.stage,'after_stage',v_stage,'before_temperature',v_interest.temperature,'after_temperature',coalesce(p_data->>'temperature',v_interest.temperature),'enrolment_id',v_enrolment.id));
  result:=jsonb_build_object('saved',true,'person_id',pid,'interest_id',v_id,'stage',v_stage,'version',v_expected,'temperature',coalesce(p_data->>'temperature',v_interest.temperature),'before_stage',v_interest.stage,'before_temperature',v_interest.temperature,'before_close_reason',v_interest.close_reason,'enrolment_changed',v_enrolment.id is not null and v_before_enrolment is distinct from 'confirmada','enrolment_status_before',v_before_enrolment,'enrolment_id',v_enrolment.id);
  insert into forma_private.crm_requests(id,actor,action,payload,result) values(rid,uid,p_action,p_data,result);return result;
 elsif p_action='interest_save' then
  if not exists(select 1 from forma_private.crm_people where id=pid) then raise exception 'Selecciona una persona' using errcode='22023';end if;
  v_id:=(p_data->>'id')::uuid;v_stage:=p_data->>'stage';v_source:=p_data->>'source';v_area:=trim(coalesce(p_data->>'area',''));v_due:=nullif(p_data->>'due_on','')::date;
  if v_stage is null or v_stage not in ('nuevo','conversacion','seguimiento','preparar_matricula','matriculado','cerrado') or v_source is null or v_source not in ('presencial','whatsapp','tiktok','instagram','facebook','recomendacion','desconocido') or length(v_area)<1 or length(v_area)>120 or length(coalesce(p_data->>'next_action',''))>400 or length(coalesce(p_data->>'note',''))>1000 or length(coalesce(p_data->>'close_reason',''))>400 or (v_stage='cerrado' and length(trim(coalesce(p_data->>'close_reason','')))=0) or (v_due is not null and (v_due<'2020-01-01' or v_due>'2045-12-31')) then raise exception 'Revisa interés, etapa y motivo de cierre' using errcode='22023';end if;
  if v_id is not null and exists(select 1 from forma_private.crm_enrolments where interest_id=v_id and course<>v_area) then raise exception 'El curso de esta matrícula se conserva. Crea otro interés en la misma ficha para otro curso' using errcode='22023';end if;
  if v_stage='matriculado' and (v_id is null or not exists(select 1 from forma_private.crm_enrolments where interest_id=v_id and person_id=pid and status='confirmada')) and p_data->>'confirm_enrolment' is distinct from 'true' then raise exception 'Confirma la matrícula del curso seleccionado' using errcode='22023';end if;
  if v_id is null then
   v_id:=rid;insert into forma_private.crm_interests(id,person_id,area,stage,source,next_action,due_on,note,close_reason,created_by) values(v_id,pid,v_area,v_stage,v_source,trim(coalesce(p_data->>'next_action','')),v_due,coalesce(p_data->>'note',''),coalesce(p_data->>'close_reason',''),uid);
  else
   select * into v_interest from forma_private.crm_interests where id=v_id and person_id=pid for update;
   if not found or v_interest.version is distinct from (p_data->>'expected')::integer then raise exception 'El seguimiento cambió. Actualiza' using errcode='40001';end if;
   update forma_private.crm_interests set area=v_area,stage=v_stage,source=v_source,next_action=trim(coalesce(p_data->>'next_action','')),due_on=v_due,note=coalesce(p_data->>'note',''),close_reason=coalesce(p_data->>'close_reason',''),version=version+1,updated_at=now() where id=v_id;
  end if;
  if coalesce(p_data->>'temperature','') not in ('','frio','tibio','caliente','muy_caliente') or coalesce(p_data->>'outcome','') not in ('','ganado','perdido','retomar') or (nullif(p_data->>'due_time','') is not null and v_due is null) then raise exception 'Revisa temperatura, resultado y fecha' using errcode='22023';end if;
  update forma_private.crm_interests set temperature=case when p_data?'temperature' then coalesce(p_data->>'temperature','') else temperature end,due_time=case when p_data?'due_time' then nullif(p_data->>'due_time','')::time else due_time end,outcome=case when v_stage not in ('cerrado','matriculado') then '' when p_data?'outcome' then coalesce(p_data->>'outcome','') else outcome end where id=v_id;
  if v_stage='matriculado' then insert into forma_private.crm_enrolments(id,interest_id,person_id,course,payment_plan,created_by) values(rid,v_id,pid,v_area,'sin_definir',uid) on conflict(interest_id) do update set status='confirmada';end if;
 elsif p_action='reserve' then
  select * into v_person from forma_private.crm_people where id=pid;if not found then raise exception 'Persona no encontrada' using errcode='22023';end if;
  payload:=(p_data->'booking')||jsonb_build_object('client',v_person.name,'phone',v_person.phone,'student_reference','FOR-'||lpad(v_person.number::text,greatest(6,length(v_person.number::text)),'0'));
  result:=forma_private.agenda_register(rid,payload,coalesce(p_data->'finance','{"status":"sin_definir"}'::jsonb),coalesce(p_data->>'reason',''));bid:=(result->>'id')::uuid;
 elsif p_action='link' then
  bid:=(p_data->>'booking_id')::uuid;
 end if;
 if bid is not null then
  if not exists(select 1 from forma_private.crm_people where id=pid) or not exists(select 1 from forma_private.agenda_bookings where id=bid) then raise exception 'Persona o reserva no disponible' using errcode='22023';end if;
  if exists(select 1 from forma_private.crm_booking_people where booking_id=bid and person_id<>pid) then raise exception 'La reserva ya pertenece a otra ficha. No se cambió el vínculo' using errcode='22023';end if;
  insert into forma_private.crm_booking_people(booking_id,person_id,actor) values(bid,pid,uid) on conflict(booking_id) do nothing;
 elsif p_action='link' then raise exception 'Selecciona una reserva' using errcode='22023';end if;
 result:=coalesce(result,'{}'::jsonb)||jsonb_build_object('saved',true,'person_id',pid,'interest_id',v_id);
 insert into forma_private.crm_audit(person_id,actor,action,snapshot) values(pid,uid,p_action,p_data);
 insert into forma_private.crm_requests(id,actor,action,payload,result) values(rid,uid,p_action,p_data,result);
 return result;
end$$;
create or replace function public.forma_crm(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.crm(p_action,p_data)$$;
revoke all on function forma_private.crm(text,jsonb),public.forma_crm(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.crm(text,jsonb),public.forma_crm(text,jsonb) to authenticated;
notify pgrst,'reload schema';


-- FORMA independiente · informes por período y cierres versionados.
-- No modifica ni elimina reservas, contratos, pagos o movimientos existentes.

do $$begin
 if to_regprocedure('forma_private.finance(text,jsonb)') is null then raise exception 'Primero activar Finanzas v1';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Proyecto incorrecto: usar solo FORMA independiente';end if;
end$$;
create table if not exists forma_private.finance_closings(
 id uuid primary key,month date not null check(extract(day from month)=1),revision integer not null check(revision>0),
 actor uuid not null references auth.users(id),reason text not null check(length(reason)<=500),request_data jsonb not null,
 snapshot jsonb not null,created_at timestamptz not null default now(),unique(month,revision));
alter table forma_private.finance_closings enable row level security;
revoke all on forma_private.finance_closings from public,anon,authenticated;
create or replace function forma_private.finance_closing_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Los cierres se conservan; registra una nueva revisión' using errcode='22023';end$$;
revoke all on function forma_private.finance_closing_immutable() from public,anon,authenticated;
drop trigger if exists finance_closing_immutable on forma_private.finance_closings;
create trigger finance_closing_immutable before update or delete on forma_private.finance_closings for each row execute function forma_private.finance_closing_immutable();
-- Internal helper has no direct API grant. Reports are exact even when row lists are capped.
create or replace function forma_private.finance_period_data(d date,e date,bucket text) returns jsonb language sql set search_path='' as $$
 with payments as materialized(select p.*,b.client from forma_private.agenda_payments p join forma_private.agenda_bookings b on b.id=p.booking_id where p.voided_at is null and p.paid_on between d and e),
 outs as materialized(select * from forma_private.finance_outflows where voided_at is null and paid_on between d and e),
 combined as(select 'by_activity' k,activity label,amount_cents from payments union all select 'by_area',area,amount_cents from payments union all select 'by_group',coalesce(nullif(group_name,''),'Sin grupo'),amount_cents from payments union all select 'by_method',method,amount_cents from payments),
 grouped as(select k,label,sum(amount_cents) cents from combined group by k,label),
 breakdown as(select k,jsonb_agg(jsonb_build_object('label',label,'cents',cents) order by cents desc,label) data from grouped group by k),
 days as(select s::date as day from generate_series(d::timestamp,e::timestamp,case when bucket='month' then interval '1 month' else interval '1 day' end)s),
 bookings as(select b.id,b.client,b.activity,b.area,b.group_name,b.cancelled,b.start_date,c.total_cents,c.payment_plan,c.due_on,c.preferred_method,
 coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=b.id and p.voided_at is null),0) paid_cents,
 coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=b.id),0) waived_cents
 from forma_private.agenda_bookings b left join forma_private.agenda_contracts c on c.booking_id=b.id where b.start_date between d and e)
 select jsonb_build_object('version',1,'finance_version',1,'report_version',1,'period_from',d,'period_to',e,'as_of',now(),
 'received_cents',coalesce((select sum(amount_cents) from payments),0),'payment_count',(select count(*) from payments),
 'outflow_cents',coalesce((select sum(amount_cents) from outs),0),'expense_cents',coalesce((select sum(amount_cents) from outs where kind='gasto'),0),'refund_cents',coalesce((select sum(amount_cents) from outs where kind='reembolso'),0),
 'by_activity',coalesce((select data from breakdown where k='by_activity'),'[]'::jsonb),'by_area',coalesce((select data from breakdown where k='by_area'),'[]'::jsonb),'by_group',coalesce((select data from breakdown where k='by_group'),'[]'::jsonb),'by_method',coalesce((select data from breakdown where k='by_method'),'[]'::jsonb),
 'by_outflow_category',coalesce((select jsonb_agg(x order by cents desc) from(select category label,sum(amount_cents) cents from outs group by category)x),'[]'::jsonb),
 'by_outflow_method',coalesce((select jsonb_agg(x order by cents desc) from(select method label,sum(amount_cents) cents from outs group by method)x),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(x order by paid_on desc,created_at desc,id) from(select id,booking_id,client,amount_cents,paid_on,method,activity,area,group_name,note,created_at from payments order by paid_on desc,created_at desc,id limit 200)x),'[]'::jsonb),'entries_limited',(select count(*)>200 from payments),
 'outflows',coalesce((select jsonb_agg(x order by paid_on desc,created_at desc,id) from(select id,kind,booking_id,amount_cents,paid_on,method,category,note,created_at from outs order by paid_on desc,created_at desc,id limit 101)x),'[]'::jsonb),'outflows_limited',(select count(*)>100 from outs),
 'bookings',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('pending_cents',case when total_cents is null then null else greatest(0,total_cents-paid_cents-waived_cents) end)) from(select * from bookings order by start_date desc,client,id limit 200)x),'[]'::jsonb),'bookings_limited',(select count(*)>200 from bookings),
 'refunds',coalesce((select jsonb_agg(x) from(select f.id,f.booking_id,f.amount_cents,f.status,f.reason,f.created_at,b.client from forma_private.finance_refunds f join forma_private.agenda_bookings b on b.id=f.booking_id where exists(select 1 from outs o where o.refund_id=f.id) order by f.created_at desc,f.id limit 101)x),'[]'::jsonb),
 'timeline',coalesce((select jsonb_agg(jsonb_build_object('day',day,'incoming',case when day>(now() at time zone 'America/Sao_Paulo')::date then null else coalesce((select sum(amount_cents) from payments p where (case when bucket='month' then date_trunc('month',p.paid_on)::date else p.paid_on end)=day),0) end,'outgoing',case when day>(now() at time zone 'America/Sao_Paulo')::date then null else coalesce((select sum(amount_cents) from outs o where (case when bucket='month' then date_trunc('month',o.paid_on)::date else o.paid_on end)=day),0) end) order by day) from days),'[]'::jsonb))
$$;
revoke all on function forma_private.finance_period_data(date,date,text) from public,anon,authenticated;
create or replace function forma_private.finance_reports(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();uid uuid:=auth.uid();today date:=(now() at time zone 'America/Sao_Paulo')::date;d date;e date;bucket text;skip integer;q text;result jsonb;rid uuid;revision_value integer;reason_value text;old forma_private.finance_closings;
begin
 if r not in ('owner','manager') then raise exception 'Informes requiere gestión de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'periods',true,'closings',true);end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 if p_action='pending' then
  skip:=coalesce((p_data->>'offset')::integer,0);q:=lower(trim(coalesce(p_data->>'query','')));
  if skip<0 or skip>1000000 or length(q)>160 then raise exception 'Consulta inválida' using errcode='22023';end if;
  with amounts as materialized(select b.id,b.client,b.phone,b.activity,b.area,b.group_name,b.cancelled,b.start_date,c.total_cents,c.payment_plan,c.due_on,c.preferred_method,
   coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=b.id and p.voided_at is null),0) paid_cents,
   coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=b.id),0) waived_cents from forma_private.agenda_bookings b join forma_private.agenda_contracts c on c.booking_id=b.id),
  debts as materialized(select *,greatest(0,total_cents-paid_cents-waived_cents) pending_cents from amounts where total_cents-paid_cents-waived_cents>0),
  matching as materialized(select * from debts where q='' or strpos(lower(client||' '||phone||' '||area||' '||activity),q)>0),
  page as(select * from matching order by due_on nulls last,client,id limit 30 offset skip)
  select jsonb_build_object('version',1,'as_of',now(),'today',today,'total_cents',coalesce((select sum(pending_cents) from debts),0),'total_count',(select count(*) from debts),'filtered_count',(select count(*) from matching),'offset',skip,'has_more',(select count(*) from matching)>skip+30,'items',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('due_status',case when due_on is null then 'Sin fecha' when due_on<today then 'Vencido' when due_on=today then 'Vence hoy' else 'Próximo' end)) from page),'[]'::jsonb)) into result;
  return result;
 end if;
 if p_action='period' then d:=(p_data->>'from')::date;e:=(p_data->>'to')::date;bucket:=coalesce(p_data->>'bucket','day');
 elsif p_action in ('closing_preview','closing_get','close') then d:=(p_data->>'month')::date;e:=(d+interval '1 month'-interval '1 day')::date;bucket:='day';
 else raise exception 'Acción inválida' using errcode='22023';end if;
 if d is null or e is null or d<'2020-01-01' or e>'2045-12-31' or e<d or e-d>366 or bucket not in ('day','month') or (bucket='month' and extract(day from d)<>1) or (p_action<>'period' and extract(day from d)<>1) then raise exception 'Período inválido' using errcode='22023';end if;
 if p_action='period' then return forma_private.finance_period_data(d,e,bucket);end if;
 if p_action='closing_get' then
  select * into old from forma_private.finance_closings where month=d and revision=(p_data->>'revision')::integer;
  if not found then raise exception 'Cierre no encontrado' using errcode='22023';end if;
  return jsonb_build_object('version',1,'id',old.id,'month',old.month,'revision',old.revision,'created_at',old.created_at,'snapshot',old.snapshot,'reason',old.reason);
 end if;
 if p_action='closing_preview' then
  select coalesce(max(revision),0) into revision_value from forma_private.finance_closings where month=d;
  return jsonb_build_object('version',1,'month',d,'can_close',e<today,'latest_revision',revision_value,'snapshot',forma_private.finance_period_data(d,e,'day'),'history',coalesce((select jsonb_agg(jsonb_build_object('revision',revision,'created_at',created_at,'reason',reason) order by revision desc) from forma_private.finance_closings where month=d),'[]'::jsonb));
 end if;
 rid:=(p_data->>'request_id')::uuid;reason_value:=trim(coalesce(p_data->>'reason',''));
 if rid is null then raise exception 'Falta identificador' using errcode='22023';end if;
 select * into old from forma_private.finance_closings where id=rid;
 if found then
  if old.actor<>uid or old.request_data<>p_data then raise exception 'Solicitud ya usada con otros datos' using errcode='22023';end if;
  return jsonb_build_object('version',1,'saved',true,'already_saved',true,'revision',old.revision,'snapshot',old.snapshot);
 end if;
 if e>=today then raise exception 'El mes no terminó; exporta un borrador' using errcode='22023';end if;
 select coalesce(max(revision),0) into revision_value from forma_private.finance_closings where month=d;
 if (p_data->>'expected_revision') is null or (p_data->>'expected_revision')::integer<>revision_value then raise exception 'Otro cierre fue registrado; actualiza antes de continuar' using errcode='40001';end if;
 if length(reason_value)>500 or (revision_value>0 and length(reason_value)<3) then raise exception 'Indica el motivo de la nueva revisión' using errcode='22023';end if;
 result:=forma_private.finance_period_data(d,e,'day');
 insert into forma_private.finance_closings(id,month,revision,actor,reason,request_data,snapshot) values(rid,d,revision_value+1,uid,reason_value,p_data,result);
 insert into forma_private.finance_audit(actor,action,payload) values(uid,'closing',jsonb_build_object('id',rid,'month',d,'revision',revision_value+1,'reason',reason_value));
 return jsonb_build_object('version',1,'saved',true,'revision',revision_value+1,'snapshot',result);
end$$;
create or replace function public.forma_finance_reports(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.finance_reports(p_action,p_data)$$;
revoke all on function forma_private.finance_reports(text,jsonb),public.forma_finance_reports(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.finance_reports(text,jsonb),public.forma_finance_reports(text,jsonb) to authenticated;
notify pgrst,'reload schema';


-- FORMA institutional accounts: additive allocation of confirmed transactions.
-- Never reimports receipts or changes reservations. Run only in independent FORMA.

do $$begin
 if to_regprocedure('forma_private.finance(text,jsonb)') is null then raise exception 'Activar Finanzas v1 primero';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Proyecto incorrecto';end if;
end$$;
create table if not exists forma_private.cash_accounts(id uuid primary key,name text not null check(length(trim(name)) between 2 and 100),opening_on date not null check(opening_on between '2020-01-01' and '2045-12-31'),opening_cents bigint not null check(abs(opening_cents)<=100000000000),actor uuid not null references auth.users(id),created_at timestamptz not null default now());
create table if not exists forma_private.cash_allocations(kind text not null check(kind in ('payment','outflow')),record_id uuid not null,account_id uuid not null references forma_private.cash_accounts(id),settled_on date not null,fee_cents bigint not null default 0 check(fee_cents>=0),card_type text not null default '' check(card_type in ('','credito','debito')),version integer not null default 1,actor uuid not null references auth.users(id),updated_at timestamptz not null default now(),primary key(kind,record_id));
create table if not exists forma_private.cash_payables(id uuid primary key,title text not null check(length(trim(title)) between 2 and 160),category text not null check(length(category) between 1 and 120),amount_cents bigint not null check(amount_cents>0 and amount_cents<=100000000000),due_on date not null check(due_on between '2020-01-01' and '2045-12-31'),status text not null default 'pendiente' check(status in ('pendiente','pagado','cancelado')),outflow_id uuid references forma_private.finance_outflows(id),actor uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table forma_private.cash_payables enable row level security;revoke all on forma_private.cash_payables from public,anon,authenticated;
create index if not exists cash_allocations_account on forma_private.cash_allocations(account_id,settled_on);
create table if not exists forma_private.cash_transfers(id uuid primary key,from_account uuid not null references forma_private.cash_accounts(id),to_account uuid not null references forma_private.cash_accounts(id),amount_cents bigint not null check(amount_cents>0 and amount_cents<=100000000000),paid_on date not null,note text not null check(length(note) between 3 and 300),actor uuid not null references auth.users(id),created_at timestamptz not null default now(),check(from_account<>to_account));
create table if not exists forma_private.cash_reconciliations(id uuid primary key,account_id uuid not null references forma_private.cash_accounts(id),day date not null,observed_cents bigint not null,calculated_cents bigint not null,note text not null check(length(note)<=500),actor uuid not null references auth.users(id),created_at timestamptz not null default now());
create table if not exists forma_private.cash_requests(id uuid primary key,actor uuid not null references auth.users(id),action text not null,payload jsonb not null,result jsonb not null,at timestamptz not null default now());
create table if not exists forma_private.cash_audit(id bigint generated always as identity primary key,actor uuid not null references auth.users(id),action text not null,payload jsonb not null,at timestamptz not null default now());
alter table forma_private.cash_accounts enable row level security;alter table forma_private.cash_allocations enable row level security;alter table forma_private.cash_transfers enable row level security;alter table forma_private.cash_reconciliations enable row level security;alter table forma_private.cash_requests enable row level security;alter table forma_private.cash_audit enable row level security;
revoke all on forma_private.cash_accounts,forma_private.cash_allocations,forma_private.cash_transfers,forma_private.cash_reconciliations,forma_private.cash_requests,forma_private.cash_audit from public,anon,authenticated;
revoke all on sequence forma_private.cash_audit_id_seq from public,anon,authenticated;
-- Live ledger excludes voided originals; a future card settlement is not available cash.
create or replace function forma_private.cash_ledger() returns table(account_id uuid,day date,cents bigint) language sql set search_path='' as $$
 select a.account_id,a.settled_on,p.amount_cents-a.fee_cents from forma_private.cash_allocations a join forma_private.agenda_payments p on a.kind='payment' and p.id=a.record_id where p.voided_at is null
 union all select a.account_id,a.settled_on,-o.amount_cents from forma_private.cash_allocations a join forma_private.finance_outflows o on a.kind='outflow' and o.id=a.record_id where o.voided_at is null
 union all select t.from_account,t.paid_on,-t.amount_cents from forma_private.cash_transfers t
 union all select t.to_account,t.paid_on,t.amount_cents from forma_private.cash_transfers t
$$;
revoke all on function forma_private.cash_ledger() from public,anon,authenticated;
create or replace function forma_private.cash(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();u uuid:=auth.uid();today date:=(now() at time zone 'America/Sao_Paulo')::date;d date;e date;a uuid;b uuid;rid uuid;rec uuid;k text;n bigint;fee bigint;dt date;v integer;ac forma_private.cash_accounts;old forma_private.cash_requests;result jsonb;expected integer;observed bigint;calculated bigint;raw jsonb;bill forma_private.cash_payables;
begin
 if r not in ('owner','manager') or u is null then raise exception 'Acceso de gestión requerido' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'accounts',true,'allocations',true,'reconciliation',true);end if;
 if p_action='payable_alerts' then return jsonb_build_object('version',1,'count',(select count(*) from forma_private.cash_payables where status='pendiente' and due_on<=today),'items',coalesce((select jsonb_agg(x) from(select id,title,amount_cents,due_on from forma_private.cash_payables where status='pendiente' and due_on<=today order by due_on,id limit 101)x),'[]'::jsonb));end if;
 if p_action='report' then
  d:=(p_data->>'from')::date;e:=(p_data->>'to')::date;
  if d is null or e is null or e<d or e-d>366 or d<'2020-01-01' or e>'2045-12-31' then raise exception 'Período inválido' using errcode='22023';end if;
  return jsonb_build_object('version',1,'accounts',coalesce((select jsonb_agg(x) from(select c.*,d>=c.opening_on as covers_start,e>=c.opening_on as covers_end,
   case when d>=c.opening_on then c.opening_cents+coalesce((select sum(l.cents) from forma_private.cash_ledger() l where l.account_id=c.id and l.day>=c.opening_on and l.day<d and l.day<=today),0) end as initial_cents,
   case when e>=c.opening_on then c.opening_cents+coalesce((select sum(l.cents) from forma_private.cash_ledger() l where l.account_id=c.id and l.day>=c.opening_on and l.day<=least(e,today)),0) end as final_cents,
   (select to_jsonb(z) from(select day,observed_cents,calculated_cents,created_at from forma_private.cash_reconciliations where account_id=c.id order by created_at desc,id limit 1)z) as reconciliation
   from forma_private.cash_accounts c order by c.created_at,c.id)x),'[]'::jsonb),
  'payables',coalesce((select jsonb_agg(x) from(select * from forma_private.cash_payables where status='pendiente' and due_on<=e order by due_on,id limit 101)x),'[]'::jsonb),'payable_cents',coalesce((select sum(amount_cents) from forma_private.cash_payables where status='pendiente' and due_on between d and e),0),
  'unassigned_count',(select count(*) from forma_private.agenda_payments p where p.voided_at is null and p.paid_on between coalesce((select min(opening_on) from forma_private.cash_accounts),'2020-01-01') and least(e,today) and not exists(select 1 from forma_private.cash_allocations a where a.kind='payment' and a.record_id=p.id))+(select count(*) from forma_private.finance_outflows o where o.voided_at is null and o.paid_on between coalesce((select min(opening_on) from forma_private.cash_accounts),'2020-01-01') and least(e,today) and not exists(select 1 from forma_private.cash_allocations a where a.kind='outflow' and a.record_id=o.id)),
  'fees_cents',coalesce((select sum(a.fee_cents) from forma_private.cash_allocations a join forma_private.agenda_payments p on a.record_id=p.id and a.kind='payment' where p.voided_at is null and a.settled_on between d and least(e,today)),0),
  'unsettled_cents',coalesce((select sum(p.amount_cents-a.fee_cents) from forma_private.cash_allocations a join forma_private.agenda_payments p on a.record_id=p.id and a.kind='payment' where p.voided_at is null and a.settled_on>today and p.paid_on<=least(e,today)),0),
  'records',coalesce((select jsonb_agg(x) from(select 'payment' kind,p.id,p.amount_cents,p.paid_on,p.method,bk.client label,a.account_id,a.settled_on,a.fee_cents,a.card_type,a.version from forma_private.agenda_payments p join forma_private.agenda_bookings bk on bk.id=p.booking_id left join forma_private.cash_allocations a on a.kind='payment' and a.record_id=p.id where p.voided_at is null and p.paid_on between d and e union all select 'outflow',o.id,o.amount_cents,o.paid_on,o.method,o.category,a.account_id,a.settled_on,a.fee_cents,a.card_type,a.version from forma_private.finance_outflows o left join forma_private.cash_allocations a on a.kind='outflow' and a.record_id=o.id where o.voided_at is null and o.paid_on between d and e order by paid_on desc,id limit 101)x),'[]'::jsonb));
 end if;
 if p_action not in ('account','allocate','transfer','reconcile','payable','payable_pay','payable_cancel') then raise exception 'Acción no disponible' using errcode='22023';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'Falta solicitud' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into old from forma_private.cash_requests where id=rid;
 if found then if old.actor<>u or old.action<>p_action or old.payload<>p_data then raise exception 'Solicitud usada con otros datos' using errcode='22023';end if;return old.result||jsonb_build_object('already_saved',true);end if;
 a:=nullif(p_data->>'account_id','')::uuid;dt:=nullif(p_data->>'day','')::date;
 if p_action='payable' then
  n:=(p_data->>'amount_cents')::bigint;
  if dt is null or dt<'2020-01-01' or dt>'2045-12-31' or n is null or n<=0 then raise exception 'Revisa importe y vencimiento' using errcode='22023';end if;
  insert into forma_private.cash_payables(id,title,category,amount_cents,due_on,actor) values(rid,trim(p_data->>'title'),trim(p_data->>'category'),n,dt,u);
 elsif p_action='payable_cancel' then
  if length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'Indica el motivo de cancelación' using errcode='22023';end if;
  update forma_private.cash_payables set status='cancelado' where id=(p_data->>'payable_id')::uuid and status='pendiente';if not found then raise exception 'La cuenta ya cambió. Actualiza' using errcode='40001';end if;
 elsif p_action='account' then
  if r<>'owner' then raise exception 'Solo dirección configura saldos iniciales' using errcode='42501';end if;
  n:=(p_data->>'opening_cents')::bigint;
  if length(trim(coalesce(p_data->>'name','')))<2 or length(p_data->>'name')>100 or n is null or abs(n)>100000000000 or dt is null or dt>today or dt<'2020-01-01' then raise exception 'Revisa cuenta, saldo y fecha inicial' using errcode='22023';end if;
  insert into forma_private.cash_accounts(id,name,opening_on,opening_cents,actor) values(rid,trim(p_data->>'name'),dt,n,u);
 else
  select * into ac from forma_private.cash_accounts where id=a;if not found then raise exception 'Selecciona una cuenta' using errcode='22023';end if;
  if dt is null or dt<ac.opening_on or dt>'2045-12-31' then raise exception 'Fecha anterior al saldo inicial o inválida' using errcode='22023';end if;
  if p_action='payable_pay' then
   select * into bill from forma_private.cash_payables where id=(p_data->>'payable_id')::uuid and status='pendiente' for update;
   if not found then raise exception 'La cuenta ya cambió. Actualiza' using errcode='40001';end if;
   if dt>today then raise exception 'Confirma solo una salida ya realizada' using errcode='22023';end if;
   result:=forma_private.finance('expense',jsonb_build_object('request_id',rid,'amount_cents',bill.amount_cents,'paid_on',dt,'method',p_data->>'method','category',bill.category,'reason','Pago previsto: '||bill.title));
   insert into forma_private.cash_allocations(kind,record_id,account_id,settled_on,fee_cents,actor) values('outflow',rid,a,dt,0,u);
   update forma_private.cash_payables set status='pagado',outflow_id=rid where id=bill.id;
  elsif p_action='allocate' then
   k:=p_data->>'kind';rec:=(p_data->>'record_id')::uuid;fee:=coalesce((p_data->>'fee_cents')::bigint,0);
   if k='payment' then select to_jsonb(p) into raw from forma_private.agenda_payments p where id=rec and voided_at is null;
   elsif k='outflow' then select to_jsonb(o) into raw from forma_private.finance_outflows o where id=rec and voided_at is null;else raise exception 'Movimiento inválido' using errcode='22023';end if;
   if raw is null or fee<0 or fee>(raw->>'amount_cents')::bigint or (k='outflow' and (fee<>0 or dt<>(raw->>'paid_on')::date)) or dt<(raw->>'paid_on')::date or (raw->>'method'<>'tarjeta' and (fee<>0 or dt<>(raw->>'paid_on')::date or coalesce(p_data->>'card_type','')<>'')) then raise exception 'Revisa movimiento, fecha y comisión' using errcode='22023';end if;
   select version into v from forma_private.cash_allocations where kind=k and record_id=rec for update;expected:=nullif(p_data->>'expected','')::integer;
   if v is distinct from expected then raise exception 'La asignación cambió. Actualiza' using errcode='40001';end if;
   insert into forma_private.cash_allocations(kind,record_id,account_id,settled_on,fee_cents,card_type,actor) values(k,rec,a,dt,fee,coalesce(p_data->>'card_type',''),u) on conflict(kind,record_id) do update set account_id=excluded.account_id,settled_on=excluded.settled_on,fee_cents=excluded.fee_cents,card_type=excluded.card_type,version=cash_allocations.version+1,actor=u,updated_at=now();
  elsif p_action='transfer' then
   b:=(p_data->>'to_account')::uuid;n:=(p_data->>'amount_cents')::bigint;
   if dt>today or n is null or n<=0 or n>100000000000 or b=a or not exists(select 1 from forma_private.cash_accounts where id=b and opening_on<=dt) or length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'Revisa transferencia' using errcode='22023';end if;
   insert into forma_private.cash_transfers(id,from_account,to_account,amount_cents,paid_on,note,actor) values(rid,a,b,n,dt,trim(p_data->>'note'),u);
  else
   observed:=(p_data->>'observed_cents')::bigint;
   if observed is null or abs(observed)>100000000000 or dt>today then raise exception 'Saldo observado inválido' using errcode='22023';end if;
   select ac.opening_cents+coalesce(sum(cents),0) into calculated from forma_private.cash_ledger() where account_id=a and day between ac.opening_on and dt;
   insert into forma_private.cash_reconciliations(id,account_id,day,observed_cents,calculated_cents,note,actor) values(rid,a,dt,observed,calculated,coalesce(p_data->>'note',''),u);
  end if;
 end if;
 result:=jsonb_build_object('saved',true,'id',rid);
 insert into forma_private.cash_audit(actor,action,payload) values(u,p_action,p_data);insert into forma_private.cash_requests values(rid,u,p_action,p_data,result,now());return result;
end$$;
revoke all on function forma_private.cash(text,jsonb) from public,anon;grant execute on function forma_private.cash(text,jsonb) to authenticated;
create or replace function public.forma_cash(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.cash(p_action,p_data)$$;
revoke all on function public.forma_cash(text,jsonb) from public,anon;grant execute on function public.forma_cash(text,jsonb) to authenticated;
notify pgrst,'reload schema';

-- FORMA monthly summary: read-only RPC. Does not alter existing data.

do $$begin
 if to_regprocedure('forma_private.finance(text,jsonb)') is null then raise exception 'Primero activar Finanzas v1';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Proyecto incorrecto: solo FORMA independiente';end if;
end$$;
create or replace function forma_private.monthly_type(v text) returns text language sql immutable set search_path='' as $$
 select case when lower(v) ~ 'clase|curso' then 'Cursos' when lower(v) ~ 'mentor' then 'Mentorías' when lower(v) ~ 'asesor|agendamiento|consulta|orientaci' then 'Asesorías' else 'Otras' end
$$;
revoke all on function forma_private.monthly_type(text) from public,anon,authenticated;
create or replace function forma_private.monthly_summary(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare role_value text:=forma_private.agenda_role();d date;e date;links jsonb:='[]';result jsonb;skip integer:=coalesce((p_data->>'offset')::integer,0);filter_type text:=p_data->>'type';filter_area text:=p_data->>'area';
begin
 if role_value is null or role_value not in ('owner','manager') then raise exception 'Solo gestión de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 d:=(p_data->>'month')::date;e:=(d+interval '1 month'-interval '1 day')::date;
 if d is null or d<'2020-01-01' or d>'2045-12-01' or extract(day from d)<>1 or skip<0 or skip>1000000 or length(coalesce(filter_area,''))>120 or (filter_type is not null and filter_type not in ('Cursos','Mentorías','Asesorías','Otras')) then raise exception 'Consulta inválida' using errcode='22023';end if;
 if to_regclass('forma_private.crm_booking_people') is not null then execute 'select coalesce(jsonb_agg(jsonb_build_object(''booking_id'',booking_id,''person_id'',person_id)),''[]''::jsonb) from forma_private.crm_booking_people' into links;end if;
 with contacts as (select * from jsonb_to_recordset(links) as x(booking_id uuid,person_id uuid)),
 events as materialized(select b.id booking_id,b.client,forma_private.monthly_type(b.activity) type,b.area,b.cancelled,s::date as day,c.person_id,coalesce(a.status,'pendiente') attendance
 from forma_private.agenda_bookings b cross join lateral generate_series(b.start_date::timestamp,(b.start_date+(b.sessions-1)*7)::timestamp,interval '7 days') s
 left join contacts c on c.booking_id=b.id left join forma_private.agenda_attendance a on a.booking_id=b.id and a.day=s::date where s::date between d and e),
 payments as materialized(select p.*,b.client from forma_private.agenda_payments p join forma_private.agenda_bookings b on b.id=p.booking_id where p.voided_at is null and p.paid_on between d and e),
 debt as materialized(select b.id booking_id,b.client,forma_private.monthly_type(b.activity) type,b.area,c.due_on,
 greatest(0,c.total_cents-coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=b.id and p.voided_at is null),0)-coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=b.id),0)) amount_cents
 from forma_private.agenda_bookings b join forma_private.agenda_contracts c on c.booking_id=b.id where c.total_cents is not null),
 refunds as materialized(select o.booking_id,b.client,forma_private.monthly_type(p.activity) type,p.area,o.paid_on,o.amount_cents,o.method from forma_private.finance_outflows o join forma_private.finance_refunds f on f.id=o.refund_id join forma_private.agenda_payments p on p.id=f.payment_id join forma_private.agenda_bookings b on b.id=o.booking_id where o.kind='reembolso' and o.voided_at is null and o.paid_on between d and e),
 rows as materialized(
 select 'encounter' kind,booking_id,client,type,area,day,null::text method,case when cancelled then 0 else 1 end encounters,0::bigint received_cents,0::bigint pending_cents,0::bigint refund_cents,cancelled,attendance,person_id from events
 union all select 'payment',booking_id,client,forma_private.monthly_type(activity),area,paid_on,method,0,amount_cents,0,0,false,null,null::uuid from payments
 union all select 'debt',booking_id,client,type,area,due_on,null,0,0,amount_cents,0,false,null,null::uuid from debt where due_on between d and e and amount_cents>0
 union all select 'refund',booking_id,client,type,area,paid_on,method,0,0,0,amount_cents,false,null,null::uuid from refunds),
 grouped as(select type,area,sum(encounters) encounters,sum(received_cents) received_cents,sum(pending_cents) pending_cents,sum(refund_cents) refund_cents from rows group by type,area),
 by_type as(select type,sum(encounters) encounters,sum(received_cents) received_cents,sum(pending_cents) pending_cents,sum(refund_cents) refund_cents from grouped group by type),
 by_area as(select area,sum(encounters) encounters,sum(received_cents) received_cents,sum(pending_cents) pending_cents,sum(refund_cents) refund_cents from grouped group by area),
 matching as materialized(select * from rows where (filter_type is null or type=filter_type) and (filter_area is null or area=filter_area)),
 page as(select * from matching order by day,kind,client,booking_id limit 50 offset skip)
 select jsonb_build_object('version',1,'exact',true,'from',d,'to',e,'as_of',now(),
 'encounters',(select count(*) from events where not cancelled),'cancelled',(select count(*) from events where cancelled),'people',(select count(distinct person_id) from events where not cancelled),'unlinked',(select count(distinct booking_id) from events where not cancelled and person_id is null),'crm_available',to_regclass('forma_private.crm_booking_people') is not null,
 'realizada',(select count(*) from events where not cancelled and attendance='realizada'),'no_asistio',(select count(*) from events where not cancelled and attendance='no_asistio'),'pendiente',(select count(*) from events where not cancelled and attendance='pendiente'),
 'received_cents',coalesce((select sum(amount_cents) from payments),0),'refund_cents',coalesce((select sum(amount_cents) from refunds),0),'pending_cents',coalesce((select sum(amount_cents) from debt where due_on between d and e),0),'undated_pending_cents',coalesce((select sum(amount_cents) from debt where due_on is null),0),
 'by_type',coalesce((select jsonb_agg(to_jsonb(x) order by type) from by_type x),'[]'::jsonb),'by_area',coalesce((select jsonb_agg(to_jsonb(x) order by area) from by_area x),'[]'::jsonb),'groups',coalesce((select jsonb_agg(to_jsonb(x) order by type,area) from grouped x),'[]'::jsonb),
 'rows',coalesce((select jsonb_agg(to_jsonb(x) order by day,kind,client,booking_id) from page x),'[]'::jsonb),'offset',skip,'detail_count',(select count(*) from matching),'has_more',(select count(*)>skip+50 from matching)) into result;
 return result;
end$$;
revoke all on function forma_private.monthly_summary(jsonb) from public,anon;grant execute on function forma_private.monthly_summary(jsonb) to authenticated;
create or replace function public.forma_monthly_summary(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.monthly_summary(p_data)$$;
revoke all on function public.forma_monthly_summary(jsonb) from public,anon;grant execute on function public.forma_monthly_summary(jsonb) to authenticated;
notify pgrst,'reload schema';

-- FORMA independiente: extracto de lectura. No borra, inserta ni actualiza datos.

do $$begin
 if to_regprocedure('forma_private.finance(text,jsonb)') is null then raise exception 'Primero activar Finanzas';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Proyecto incorrecto: solo FORMA independiente';end if;
end$$;
create or replace function forma_private.statement(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();d date;e date;skip integer;q text;k text;m text;c text;include_void boolean;result jsonb;
begin
 if r is null or r not in ('owner','manager') then raise exception 'Extracto requiere gestión de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 d:=(p_data->>'from')::date;e:=(p_data->>'to')::date;skip:=coalesce((p_data->>'offset')::integer,0);
 q:=lower(trim(coalesce(p_data->>'query','')));k:=coalesce(p_data->>'kind','');m:=coalesce(p_data->>'method','');c:=coalesce(p_data->>'category','');include_void:=coalesce((p_data->>'include_void')::boolean,false);
 if d is null or e is null or d>e or e-d>365 or d<'2020-01-01' or e>'2045-12-31' or skip<0 or length(q)>160 or length(c)>160 or k not in ('','payment','gasto','reembolso') or m not in ('','pix','efectivo','tarjeta','transferencia','bitcoin') then raise exception 'Filtros inválidos: máximo un año' using errcode='22023';end if;
 with movements as materialized(
 select p.id,p.booking_id,'payment'::text kind,p.paid_on,p.created_at,b.client label,p.area category,p.activity,p.method,p.amount_cents,p.note,p.voided_at,p.void_reason
 from forma_private.agenda_payments p join forma_private.agenda_bookings b on b.id=p.booking_id where p.paid_on between d and e
 union all
 select o.id,o.booking_id,o.kind,o.paid_on,o.created_at,coalesce(b.client,o.category),o.category,coalesce(b.activity,''),o.method,o.amount_cents,o.note,o.voided_at,o.void_reason
 from forma_private.finance_outflows o left join forma_private.agenda_bookings b on b.id=o.booking_id where o.paid_on between d and e
 ), matching as materialized(select * from movements x where (include_void or x.voided_at is null) and (k='' or x.kind=k) and (m='' or x.method=m) and (c='' or x.category=c) and (q='' or position(q in lower(concat_ws(' ',x.label,x.category,x.activity,x.note)))>0)),
 page as(select * from matching order by paid_on desc,created_at desc,kind,id limit 30 offset skip)
 select jsonb_build_object('version',1,'from',d,'to',e,'offset',skip,'as_of',now(),'filtered_count',(select count(*) from matching),'has_more',(select count(*) from matching)>skip+30,
 'incoming_cents',coalesce((select sum(amount_cents) from matching where kind='payment' and voided_at is null),0),
 'outgoing_cents',coalesce((select sum(amount_cents) from matching where kind<>'payment' and voided_at is null),0),
 'categories',coalesce((select jsonb_agg(category order by category) from(select distinct category from movements)x),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(to_jsonb(page) order by paid_on desc,created_at desc,kind,id) from page),'[]'::jsonb)) into result;
 return result;
end$$;
create or replace function public.forma_statement(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.statement(p_data)$$;
revoke all on function forma_private.statement(jsonb),public.forma_statement(jsonb) from public,anon,authenticated;
grant execute on function forma_private.statement(jsonb),public.forma_statement(jsonb) to authenticated;
notify pgrst,'reload schema';


-- FORMA private academic catalogue. Additive: no seeds or data deletion.

do $$begin if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Usar exclusivamente FORMA independiente';end if;end$$;
create table if not exists forma_private.academic_courses(id uuid primary key,name text not null check(length(trim(name)) between 2 and 120),modules jsonb not null default '[]' check(jsonb_typeof(modules)='array' and jsonb_array_length(modules)<=100),active boolean not null default true,version integer not null default 1,created_by uuid not null references auth.users(id));
create table if not exists forma_private.academic_groups(id uuid primary key,course_id uuid not null references forma_private.academic_courses(id),name text not null check(length(trim(name)) between 1 and 120),instructor text not null check(length(trim(instructor)) between 1 and 120),room text not null check(length(trim(room)) between 1 and 120),capacity integer not null check(capacity between 1 and 500),fee_cents integer not null check(fee_cents between 0 and 100000000),monthly_cents integer not null check(monthly_cents between 0 and 100000000),installments integer not null check(installments between 0 and 60),active boolean not null default true,version integer not null default 1,created_by uuid not null references auth.users(id),check((installments=0 and monthly_cents=0) or (installments>0 and monthly_cents>0)));
create table if not exists forma_private.academic_sessions(id uuid primary key,group_id uuid not null references forma_private.academic_groups(id),day date not null check(day between '2020-01-01' and '2045-12-31'),start_min integer not null check(start_min between 0 and 1439),end_min integer not null check(end_min between 1 and 1440),module text not null default '' check(length(module)<=160),cancelled boolean not null default false,check(end_min>start_min));
create index if not exists academic_sessions_day on forma_private.academic_sessions(day) where not cancelled;
create index if not exists academic_sessions_group on forma_private.academic_sessions(group_id);
create table if not exists forma_private.academic_requests(id uuid primary key,actor uuid not null,action text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
create table if not exists forma_private.academic_history(id bigint generated always as identity primary key,actor uuid not null,action text not null,target uuid,snapshot jsonb not null,created_at timestamptz not null default now());
do $$declare t text;begin foreach t in array array['academic_courses','academic_groups','academic_sessions','academic_requests','academic_history'] loop execute format('alter table forma_private.%I enable row level security',t);execute format('revoke all on forma_private.%I from public,anon,authenticated',t);end loop;end$$;
alter table forma_private.agenda_bookings add column if not exists room text not null default '';

-- FORMA: alumnos, contratos y recibos. Aditivo; no modifica datos antiguos.

do $$begin
 if to_regprocedure('forma_private.finance_reports(text,jsonb)') is null or to_regclass('forma_private.crm_enrolments') is null then raise exception 'Primero activar el espacio de FORMA';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Usar exclusivamente FORMA independiente';end if;
end$$;
create table if not exists forma_private.education_enrolments(
 id uuid primary key,person_id uuid not null references forma_private.crm_people(id),crm_id uuid unique references forma_private.crm_enrolments(id),course text not null check(length(trim(course)) between 1 and 120),
 starts_on date,ends_on date,state text not null default 'matriculado' check(state in ('matriculado','activo','pausa','concluido','cancelado')),
 fee_due date not null default ((now() at time zone 'America/Sao_Paulo')::date),fee_cents integer not null check(fee_cents between 0 and 100000000),monthly_cents integer not null check(monthly_cents between 0 and 100000000),installments integer not null check(installments between 0 and 60),first_due date not null,
 total_cents bigint generated always as (fee_cents::bigint+monthly_cents::bigint*installments) stored,version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 check(ends_on is null or starts_on is null or ends_on>=starts_on),check((installments=0 and monthly_cents=0) or (installments>0 and monthly_cents>0)),check(first_due between '2020-01-01' and '2045-12-31'));
alter table forma_private.education_enrolments add column if not exists group_id uuid references forma_private.academic_groups(id);
create index if not exists education_enrolments_group on forma_private.education_enrolments(group_id);
create unique index if not exists education_person_group_unique on forma_private.education_enrolments(person_id,group_id) where group_id is not null and state<>'cancelado';
create index if not exists education_enrolments_person on forma_private.education_enrolments(person_id);
create table if not exists forma_private.education_receipts(
 id uuid primary key,person_id uuid not null references forma_private.crm_people(id),enrolment_id uuid references forma_private.education_enrolments(id),payer_name text not null,area text not null,activity text not null default 'Curso',group_name text not null default '',
 balance_after_cents bigint,amount_cents integer not null check(amount_cents between 1 and 100000000),paid_on date not null,method text not null check(method in ('pix','efectivo','tarjeta','transferencia','bitcoin')),card_type text not null default '' check(card_type in ('','credito','debito')),
 note text not null check(length(note) between 1 and 500),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),voided_at timestamptz,voided_by uuid references auth.users(id),void_reason text not null default '');
create index if not exists education_receipts_enrolment on forma_private.education_receipts(enrolment_id);
create index if not exists education_receipts_person on forma_private.education_receipts(person_id,paid_on);
create index if not exists education_receipts_date on forma_private.education_receipts(paid_on);
create table if not exists forma_private.education_portal(person_id uuid primary key references forma_private.crm_people(id),email text not null unique,user_id uuid unique references auth.users(id),active boolean not null default true,last_seen timestamptz not null default 'epoch',actor uuid not null references auth.users(id),created_at timestamptz not null default now());
create table if not exists forma_private.education_bookings(enrolment_id uuid references forma_private.education_enrolments(id),booking_id uuid references forma_private.agenda_bookings(id),finance_link boolean not null default false,primary key(enrolment_id,booking_id));
create unique index if not exists education_booking_finance_unique on forma_private.education_bookings(booking_id) where finance_link;
create table if not exists forma_private.education_payment_notices(id uuid primary key,person_id uuid not null references forma_private.crm_people(id),enrolment_id uuid not null references forma_private.education_enrolments(id),amount_cents integer not null check(amount_cents between 1 and 100000000),method text not null check(method in ('pix','efectivo','tarjeta','transferencia','bitcoin')),paid_on date not null,note text not null check(length(note) between 3 and 500),state text not null default 'reportado' check(state in ('reportado','confirmado')),receipt_id uuid unique references forma_private.education_receipts(id),created_at timestamptz not null default now());
create table if not exists forma_private.education_requests(id uuid primary key,actor uuid not null,action text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
create table if not exists forma_private.education_events(id uuid primary key default gen_random_uuid(),person_id uuid not null references forma_private.crm_people(id),actor uuid not null,kind text not null,receipt_id uuid references forma_private.education_receipts(id),message text not null,created_at timestamptz not null default now());
do $$declare t text;begin foreach t in array array['education_payment_notices','education_enrolments','education_receipts','education_portal','education_bookings','education_requests','education_events'] loop execute format('alter table forma_private.%I enable row level security',t);execute format('revoke all on forma_private.%I from public,anon,authenticated',t);end loop;end$$;
-- One read-only source, never copies old receipts or creates dummy reservations.
create or replace view forma_private.institution_receipts with (security_invoker=true) as
 select p.id,p.booking_id,p.amount_cents,p.paid_on,p.method,p.note,p.activity,p.area,p.created_by,p.created_at,p.voided_at,p.voided_by,p.void_reason,p.group_name,b.client payer_name,eb.enrolment_id,e.person_id from forma_private.agenda_payments p join forma_private.agenda_bookings b on b.id=p.booking_id left join forma_private.education_bookings eb on eb.booking_id=b.id and eb.finance_link left join forma_private.education_enrolments e on e.id=eb.enrolment_id
 union all
 select p.id,null::uuid,p.amount_cents,p.paid_on,p.method,p.note,p.activity,p.area,p.created_by,p.created_at,p.voided_at,p.voided_by,p.void_reason,p.group_name,p.payer_name,p.enrolment_id,p.person_id from forma_private.education_receipts p;
revoke all on forma_private.institution_receipts from public,anon,authenticated;
create or replace function forma_private.education_debts(p_person uuid default null) returns table(id uuid,client text,phone text,activity text,area text,group_name text,cancelled boolean,start_date date,total_cents bigint,payment_plan text,due_on date,preferred_method text,paid_cents bigint,waived_cents bigint,enrolment_id uuid) language sql set search_path='' as $$
 with amounts as(select e.*,p.name,p.phone,coalesce((select sum(r.amount_cents) from forma_private.institution_receipts r where r.enrolment_id=e.id and r.voided_at is null),0) paid from forma_private.education_enrolments e join forma_private.crm_people p on p.id=e.person_id where p_person is null or e.person_id=p_person),
 charges as(select e.*,n,case when n=0 then e.fee_cents else e.monthly_cents end amount,case when n=0 then e.fee_due else (date_trunc('month',e.first_due)+(n-1)*interval '1 month'+(least(extract(day from e.first_due)::integer,extract(day from date_trunc('month',e.first_due)+n*interval '1 month'-interval '1 day')::integer)-1)*interval '1 day')::date end due,
 case when n=0 then 0 else e.fee_cents::bigint+(n-1)::bigint*e.monthly_cents end prior from amounts e cross join lateral generate_series(0,e.installments)n)
 select (substr(md5(id::text||':'||n),1,8)||'-'||substr(md5(id::text||':'||n),9,4)||'-'||substr(md5(id::text||':'||n),13,4)||'-'||substr(md5(id::text||':'||n),17,4)||'-'||substr(md5(id::text||':'||n),21,12))::uuid,name,phone,'Curso'::text,course,''::text,state='cancelado',starts_on,amount::bigint,'fecha'::text,due,''::text,least(amount::bigint,greatest(0,paid-prior)),0::bigint,id from charges where amount>0 and amount>least(amount::bigint,greatest(0,paid-prior))
$$;
revoke all on function forma_private.education_debts(uuid) from public,anon,authenticated;
-- Student authorization is independent of staff roles; checks a live FORMA session.
create or replace function forma_private.education_student() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();sid uuid;email_value text;pid uuid;begin
 if uid is null or coalesce(auth.jwt()->>'iss','')<>'https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' then raise exception 'Inicia sesión en FORMA' using errcode='42501';end if;
 sid:=(auth.jwt()->>'session_id')::uuid;
 select lower(u.email) into email_value from auth.users u join auth.sessions s on s.user_id=u.id where u.id=uid and s.id=sid and (s.not_after is null or s.not_after>now()) and (u.banned_until is null or u.banned_until<=now()) and u.email_confirmed_at is not null;
 if email_value is null or not forma_private.access_active() then raise exception 'Cuenta verificada requerida' using errcode='42501';end if;
 select person_id into pid from forma_private.education_portal where user_id=uid and active;
 if pid is null then
  update forma_private.education_portal set user_id=uid where email=email_value and user_id is null and active returning person_id into pid;
 end if;return pid;
end$$;
revoke all on function forma_private.education_student() from public,anon,authenticated;
create or replace function forma_private.education_detail(pid uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('version',1,'person',(select jsonb_build_object('id',id,'name',name,'email',email,'phone',phone,'number',number) from forma_private.crm_people where id=pid),
 'payment_notices',coalesce((select jsonb_agg(to_jsonb(n) order by created_at desc) from forma_private.education_payment_notices n where person_id=pid),'[]'::jsonb),
 'enrolments',coalesce((select jsonb_agg((to_jsonb(e)-'created_by')||jsonb_build_object('group_name',(select name from forma_private.academic_groups where id=e.group_id),'instructor',(select instructor from forma_private.academic_groups where id=e.group_id),'room',(select room from forma_private.academic_groups where id=e.group_id),'paid_cents',coalesce((select sum(r.amount_cents) from forma_private.institution_receipts r where r.enrolment_id=e.id and r.voided_at is null),0)) order by e.created_at desc) from forma_private.education_enrolments e where e.person_id=pid),'[]'::jsonb),
 'unconfigured',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'course',e.course,'starts_on',e.starts_on)) from forma_private.crm_enrolments e where e.person_id=pid and e.status='confirmada' and not exists(select 1 from forma_private.education_enrolments x where x.crm_id=e.id)),'[]'::jsonb),
 'receipts',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'voided_by' order by paid_on desc,created_at desc,id) from (select r.*,er.balance_after_cents,er.card_type from forma_private.institution_receipts r left join forma_private.education_receipts er on er.id=r.id where r.person_id=pid) r),'[]'::jsonb),
 'debts',coalesce((select jsonb_agg(to_jsonb(d) order by d.due_on,d.id) from forma_private.education_debts(pid) d join forma_private.education_enrolments e on e.id=d.enrolment_id where e.person_id=pid),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(x order by x->>'day',x->>'start_min') from (
 select jsonb_build_object('enrolment_id',e.id,'course',e.course,'group_name',g.name,'day',s.day,'start_min',s.start_min,'end_min',s.end_min,'instructor',g.instructor,'room',g.room,'module',s.module,'active',g.active,'marker',case when s.id=(select id from forma_private.academic_sessions where group_id=g.id and not cancelled order by day,start_min,id limit 1) then 'INICIO' when s.id=(select id from forma_private.academic_sessions where group_id=g.id and not cancelled order by day desc,start_min desc,id desc limit 1) then 'FINALIZA' else 'ENCUENTRO' end) x from forma_private.education_enrolments e join forma_private.academic_groups g on g.id=e.group_id join forma_private.academic_sessions s on s.group_id=g.id where e.person_id=pid and not s.cancelled and e.state<>'cancelado'
 union all select jsonb_build_object('enrolment_id',eb.enrolment_id,'course',e.course,'day',s.day,'start_min',b.start_hour*60,'end_min',(b.start_hour+b.duration)*60,'instructor',b.instructor,'room',b.room) from forma_private.education_bookings eb join forma_private.education_enrolments e on e.id=eb.enrolment_id join forma_private.agenda_bookings b on b.id=eb.booking_id cross join lateral generate_series(b.start_date::timestamp,(b.start_date+(b.sessions-1)*7)::timestamp,interval '7 days') s(day) where e.person_id=pid and e.group_id is null and not b.cancelled
 )a),'[]'::jsonb),
 'notices',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'message',x.message,'created_at',x.created_at,'receipt_id',x.receipt_id) order by created_at desc) from(select * from forma_private.education_events where person_id=pid order by created_at desc limit 50)x),'[]'::jsonb))
$$;
revoke all on function forma_private.education_detail(uuid) from public,anon,authenticated;
create or replace function forma_private.education(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();role_value text;pid uuid;eid uuid;rid uuid;payment_id uuid;result jsonb;old forma_private.education_requests;person forma_private.crm_people;enrol forma_private.education_enrolments;receipt forma_private.education_receipts;fee integer;monthly integer;qty integer;day_value date;amount integer;paid bigint;email_value text;v_query text;filter_state text;skip integer;bid uuid;begin
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action in ('mine','inbox','seen','payment_notice') then
  pid:=forma_private.education_student();if pid is null then return jsonb_build_object('version',1,'linked',false);end if;
  if p_action='inbox' then return jsonb_build_object('version',1,'linked',true,'unread_count',(select count(*) from forma_private.education_events where person_id=pid and created_at>(select last_seen from forma_private.education_portal where person_id=pid)));end if;
  if p_action='seen' then update forma_private.education_portal set last_seen=now() where person_id=pid and user_id=uid;return jsonb_build_object('version',1,'saved',true);end if;
  if p_action='payment_notice' then
   rid:=(p_data->>'request_id')::uuid;eid:=(p_data->>'enrolment_id')::uuid;amount:=(p_data->>'amount_cents')::integer;day_value:=(p_data->>'paid_on')::date;
   if rid is null or not exists(select 1 from forma_private.education_enrolments where id=eid and person_id=pid) or day_value is null or day_value>(now() at time zone 'America/Sao_Paulo')::date or day_value<'2020-01-01' then raise exception 'Revisa matrícula y fecha' using errcode='22023';end if;
   perform pg_advisory_xact_lock(7860152026::bigint);
   if exists(select 1 from forma_private.education_payment_notices where id=rid) then
    if not exists(select 1 from forma_private.education_payment_notices where id=rid and person_id=pid and enrolment_id=eid and amount_cents=amount and method=p_data->>'method' and paid_on=day_value and note=p_data->>'note') then raise exception 'Operación ya usada' using errcode='22023';end if;
   else
    if (select count(*) from forma_private.education_payment_notices where person_id=pid and state='reportado')>=10 then raise exception 'Tienes avisos pendientes de revisión. Comunícate con administración.' using errcode='22023';end if;
    if amount>(select e.total_cents-coalesce((select sum(r.amount_cents) from forma_private.institution_receipts r where r.enrolment_id=e.id and r.voided_at is null),0) from forma_private.education_enrolments e where e.id=eid) then raise exception 'El importe supera el saldo pendiente. Revisa con administración.' using errcode='22023';end if;
    insert into forma_private.education_payment_notices(id,person_id,enrolment_id,amount_cents,method,paid_on,note) values(rid,pid,eid,amount,p_data->>'method',day_value,p_data->>'note');end if;
   return jsonb_build_object('version',1,'saved',true);
  end if;
  return forma_private.education_detail(pid)||jsonb_build_object('linked',true,'unread_count',(select count(*) from forma_private.education_events where person_id=pid and created_at>(select last_seen from forma_private.education_portal where person_id=pid)));
 end if;
 role_value:=forma_private.agenda_role();if role_value is null or role_value not in ('owner','manager') then raise exception 'Solo administración de FORMA' using errcode='42501';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'education',true);end if;
 if p_action='alerts' then return jsonb_build_object('version',1,'count',(select count(*) from forma_private.education_payment_notices where state='reportado'),'items',coalesce((select jsonb_agg(x) from(select n.id,n.person_id,n.amount_cents,n.method,n.paid_on,p.name from forma_private.education_payment_notices n join forma_private.crm_people p on p.id=n.person_id where n.state='reportado' order by n.created_at limit 100)x),'[]'::jsonb));end if;
 if p_action='list' then
  filter_state:=coalesce(p_data->>'state','');if filter_state not in ('','matriculado','activo','pausa','concluido','cancelado') then raise exception 'Filtro inválido' using errcode='22023';end if;v_query:=forma_private.crm_normalize(trim(coalesce(p_data->>'query','')));skip:=coalesce((p_data->>'offset')::integer,0);if length(v_query)>160 or skip<0 then raise exception 'Consulta inválida' using errcode='22023';end if;
  with people as(select p.*,exists(select 1 from forma_private.education_portal s where s.person_id=p.id and active) portal_active from forma_private.crm_people p where (v_query='' and (exists(select 1 from forma_private.education_enrolments e where e.person_id=p.id) or exists(select 1 from forma_private.crm_enrolments e where e.person_id=p.id and status='confirmada'))) or (v_query<>'' and position(v_query in forma_private.crm_normalize(p.name||' '||p.phone||' '||p.email||' '||coalesce((select string_agg(e.course,' ') from (select course,person_id from forma_private.education_enrolments union all select course,person_id from forma_private.crm_enrolments) e where e.person_id=p.id),'')))>0)),matching as(select * from people p where filter_state='' or exists(select 1 from forma_private.education_enrolments e where e.person_id=p.id and e.state=filter_state)),page as(select * from matching order by name,id limit 30 offset skip)
  select jsonb_build_object('version',1,'count',(select count(*) from matching),'has_more',(select count(*) from matching)>skip+30,'items',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('courses',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'course',e.course,'state',e.state,'starts_on',e.starts_on,'ends_on',e.ends_on,'total_cents',e.total_cents,'paid_cents',coalesce((select sum(r.amount_cents) from forma_private.institution_receipts r where r.enrolment_id=e.id and r.voided_at is null),0))) from forma_private.education_enrolments e where e.person_id=page.id),'[]'::jsonb))) from page),'[]'::jsonb)) into result;return result;
 end if;
 pid:=(p_data->>'person_id')::uuid;
 if p_action='enrolment' then select person_id into pid from forma_private.education_enrolments where id=(p_data->>'enrolment_id')::uuid;return forma_private.education_detail(pid);end if;
 if p_action='detail' then return forma_private.education_detail(pid)||jsonb_build_object('portal',(select jsonb_build_object('active',active,'email',email,'linked',user_id is not null) from forma_private.education_portal where person_id=pid));end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'Falta identificador de operación' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into old from forma_private.education_requests where id=rid;
 if found then if old.actor<>uid or old.action<>p_action or old.payload<>p_data then raise exception 'Operación ya usada con otros datos' using errcode='22023';end if;return old.result||jsonb_build_object('already_saved',true);end if;
 if p_action='person' then
  if not exists(select 1 from forma_private.crm_requests where id=rid) and exists(select 1 from forma_private.crm_people p where (trim(coalesce(p_data->>'email',''))<>'' and lower(p.email)=lower(trim(p_data->>'email'))) or (length(regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g'))>=8 and regexp_replace(p.phone,'[^0-9]','','g')=regexp_replace(p_data->>'phone','[^0-9]','','g'))) then raise exception 'Ya existe una ficha con este correo o teléfono. Búscala antes de crear otra.' using errcode='23505';end if;
  return forma_private.crm('person_save',p_data);
 end if;
 select * into person from forma_private.crm_people where id=pid;if not found then raise exception 'Selecciona una persona existente' using errcode='22023';end if;
 if p_action='enrol' then
  eid:=coalesce(nullif(p_data->>'crm_id','')::uuid,rid);if exists(select 1 from forma_private.education_enrolments where id=eid) then raise exception 'Matrícula existente; actualiza la ficha' using errcode='40001';end if;
  if nullif(p_data->>'crm_id','') is not null and not exists(select 1 from forma_private.crm_enrolments c where c.id=eid and c.person_id=pid and c.status='confirmada' and c.course=trim(p_data->>'course')) then raise exception 'Matrícula comercial no válida' using errcode='22023';end if;
  fee:=(p_data->>'fee_cents')::integer;monthly:=(p_data->>'monthly_cents')::integer;qty:=(p_data->>'installments')::integer;day_value:=(p_data->>'first_due')::date;
  if fee is null or monthly is null or qty is null or day_value is null or length(trim(coalesce(p_data->>'course','')))=0 then raise exception 'Revisa curso y condiciones' using errcode='22023';end if;
  insert into forma_private.education_enrolments(id,person_id,crm_id,course,starts_on,ends_on,fee_due,fee_cents,monthly_cents,installments,first_due,created_by) values(eid,pid,nullif(p_data->>'crm_id','')::uuid,trim(p_data->>'course'),nullif(p_data->>'starts_on','')::date,nullif(p_data->>'ends_on','')::date,coalesce(nullif(p_data->>'fee_due','')::date,(now() at time zone 'America/Sao_Paulo')::date),fee,monthly,qty,day_value,uid);
 elsif p_action='payment' then
  if exists(select 1 from forma_private.agenda_payments where id=rid) then raise exception 'Identificador de cobro anterior: no se puede reutilizar para otro ingreso' using errcode='22023';end if;
  eid:=nullif(p_data->>'enrolment_id','')::uuid;amount:=(p_data->>'amount_cents')::integer;day_value:=(p_data->>'paid_on')::date;
  if p_data->>'confirmed' is distinct from 'true' or amount is null or amount<=0 or day_value is null or day_value<'2020-01-01' or day_value>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Confirma importe y fecha del dinero recibido' using errcode='22023';end if;
  if eid is not null then
   select * into enrol from forma_private.education_enrolments where id=eid and person_id=pid for update;if not found then raise exception 'Matrícula no encontrada' using errcode='22023';end if;
   select coalesce(sum(amount_cents),0) into paid from forma_private.institution_receipts where enrolment_id=eid and voided_at is null;
   if paid+amount>enrol.total_cents then raise exception 'El pago supera el saldo pendiente; revisa el contrato' using errcode='22023';end if;
  end if;
  insert into forma_private.education_receipts(id,person_id,enrolment_id,payer_name,area,group_name,balance_after_cents,amount_cents,paid_on,method,card_type,note,created_by) values(rid,pid,eid,person.name,coalesce(enrol.course,nullif(trim(p_data->>'category'),''),'Ingreso por conciliar'),coalesce((select name from forma_private.academic_groups where id=enrol.group_id),''),case when eid is not null then enrol.total_cents-paid-amount end,amount,day_value,p_data->>'method',coalesce(p_data->>'card_type',''),trim(coalesce(p_data->>'note','Pago recibido')),uid);
  if nullif(p_data->>'notice_id','') is not null then
   update forma_private.education_payment_notices set state='confirmado',receipt_id=rid where id=(p_data->>'notice_id')::uuid and person_id=pid and enrolment_id=eid and amount_cents=amount and method=p_data->>'method' and state='reportado';
   if not found then raise exception 'Aviso ya confirmado o con datos diferentes' using errcode='40001';end if;
  end if;
  payment_id:=rid;
 elsif p_action='void_payment' then
  select * into receipt from forma_private.education_receipts where id=(p_data->>'receipt_id')::uuid and person_id=pid for update;
  if not found or receipt.voided_at is not null or length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Selecciona el recibo vigente e indica el motivo' using errcode='22023';end if;
  update forma_private.education_receipts set voided_at=now(),voided_by=uid,void_reason=trim(p_data->>'reason') where id=receipt.id;payment_id:=receipt.id;
 elsif p_action='portal' then
  email_value:=lower(trim(person.email));if email_value='' or email_value not like '%@%' then raise exception 'Registra primero el correo del alumno en su ficha' using errcode='22023';end if;
  if exists(select 1 from forma_private.education_portal where person_id=pid and email<>email_value) then raise exception 'El correo del portal cambió; dirección debe revisar el vínculo antes de reasignarlo' using errcode='22023';end if;
  insert into forma_private.education_portal(person_id,email,actor) values(pid,email_value,uid) on conflict(person_id) do update set active=true;
 elsif p_action='update' then
  if p_data->>'state'<>'cancelado' and exists(select 1 from forma_private.education_enrolments e join forma_private.academic_groups g on g.id=e.group_id where e.id=(p_data->>'enrolment_id')::uuid and e.person_id=pid and e.state='cancelado' and (select count(*) from forma_private.education_enrolments x where x.group_id=g.id and x.state<>'cancelado')>=g.capacity) then raise exception 'No hay cupo para reactivar esta matrícula' using errcode='22023';end if;
  update forma_private.education_enrolments set starts_on=case when group_id is null then nullif(p_data->>'starts_on','')::date else starts_on end,ends_on=case when group_id is null then nullif(p_data->>'ends_on','')::date else ends_on end,state=p_data->>'state',version=version+1 where id=(p_data->>'enrolment_id')::uuid and person_id=pid and version=(p_data->>'expected')::integer returning * into enrol;
  if not found then raise exception 'La matrícula cambió; actualiza antes de editar' using errcode='40001';end if;
 elsif p_action='link_payments' then
  eid:=(p_data->>'enrolment_id')::uuid;bid:=(p_data->>'booking_id')::uuid;
  select * into enrol from forma_private.education_enrolments where id=eid and person_id=pid;
  if not found or not exists(select 1 from forma_private.crm_booking_people c join forma_private.agenda_contracts k on k.booking_id=c.booking_id where c.booking_id=bid and c.person_id=pid and k.total_cents=enrol.total_cents) or exists(select 1 from forma_private.finance_waivers where booking_id=bid) or exists(select 1 from forma_private.education_bookings where booking_id=bid and finance_link) then raise exception 'Revisa vínculo de persona, contrato y ajustes. No se copiaron pagos.' using errcode='22023';end if;
  if coalesce((select sum(amount_cents) from forma_private.institution_receipts where enrolment_id=eid and voided_at is null),0)+coalesce((select sum(amount_cents) from forma_private.agenda_payments where booking_id=bid and voided_at is null),0)>enrol.total_cents then raise exception 'Los pagos vinculados superarían el contrato; revisar antes de vincular' using errcode='22023';end if;
  insert into forma_private.education_bookings values(eid,bid,true) on conflict(enrolment_id,booking_id) do update set finance_link=true;
 elsif p_action='link_booking' then
  eid:=(p_data->>'enrolment_id')::uuid;bid:=(p_data->>'booking_id')::uuid;
  if not exists(select 1 from forma_private.education_enrolments where id=eid and person_id=pid) or not exists(select 1 from forma_private.agenda_bookings b where b.id=bid and not b.cancelled and (not exists(select 1 from forma_private.crm_booking_people c where c.booking_id=b.id and c.person_id<>pid) or b.group_name<>'')) then raise exception 'Revisa alumno, curso y agenda' using errcode='22023';end if;
  insert into forma_private.education_bookings values(eid,bid,false) on conflict do nothing;
 else raise exception 'Acción no admitida' using errcode='22023';end if;
 insert into forma_private.education_events(person_id,actor,kind,receipt_id,message) values(pid,uid,p_action,payment_id,case when person.language='pt' then case p_action when 'payment' then 'Pagamento registrado: R$ '||to_char(amount::numeric/100,'FM999999990.00')||'. Saldo e comprovante atualizados.'||case when eid is not null and enrol.total_cents-paid-amount=0 then ' Pagamento concluído. Obrigado por investir no seu aprendizado!' else '' end when 'void_payment' then 'Um registro de pagamento foi corrigido. Consulte o saldo e o histórico do comprovante.' when 'enrol' then 'Sua matrícula foi registrada. Consulte o curso, as datas e os pagamentos.' when 'portal' then 'Sua área do aluno está habilitada.' when 'update' then 'As informações do seu curso foram atualizadas.' else 'Sua agenda de aulas foi atualizada.' end else case p_action when 'payment' then 'Pago registrado: R$ '||to_char(amount::numeric/100,'FM999999990.00')||'. Tu saldo y comprobante ya están actualizados.' when 'void_payment' then 'Un registro de pago fue corregido. Revisa tu saldo y el historial del comprobante.' when 'enrol' then 'Tu matrícula fue registrada. Consulta el curso, las fechas y los pagos.' when 'portal' then 'Tu área de alumno está habilitada.' when 'update' then 'La información de tu curso fue actualizada.' else 'Tu agenda de clases fue actualizada.' end end);
 result:=jsonb_build_object('version',1,'saved',true,'person_id',pid,'enrolment_id',eid,'receipt_id',payment_id);
 insert into forma_private.education_requests values(rid,uid,p_action,p_data,result,now());return result;
end$$;
create or replace function public.forma_education(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.education(p_action,p_data)$$;
revoke all on function forma_private.education(text,jsonb),public.forma_education(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.education(text,jsonb),public.forma_education(text,jsonb) to authenticated;
-- Read-report integrations follow below; no historical receipt gets rewritten.
-- BEGIN GENERATED REPORTS
create or replace function forma_private.finance_period_data(d date,e date,bucket text) returns jsonb language sql set search_path='' as $$
 with payments as materialized(select p.*,coalesce(b.client,p.payer_name) client from forma_private.institution_receipts p left join forma_private.agenda_bookings b on b.id=p.booking_id where p.voided_at is null and p.paid_on between d and e),
 outs as materialized(select * from forma_private.finance_outflows where voided_at is null and paid_on between d and e),
 combined as(select 'by_activity' k,activity label,amount_cents from payments union all select 'by_area',area,amount_cents from payments union all select 'by_group',coalesce(nullif(group_name,''),'Sin grupo'),amount_cents from payments union all select 'by_method',method,amount_cents from payments),
 grouped as(select k,label,sum(amount_cents) cents from combined group by k,label),
 breakdown as(select k,jsonb_agg(jsonb_build_object('label',label,'cents',cents) order by cents desc,label) data from grouped group by k),
 days as(select s::date as day from generate_series(d::timestamp,e::timestamp,case when bucket='month' then interval '1 month' else interval '1 day' end)s),
 bookings as(select b.id,b.client,b.activity,b.area,b.group_name,b.cancelled,b.start_date,c.total_cents,c.payment_plan,c.due_on,c.preferred_method,
 coalesce((select sum(p.amount_cents) from forma_private.institution_receipts p where p.booking_id=b.id and p.voided_at is null),0) paid_cents,
 coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=b.id),0) waived_cents
 from forma_private.agenda_bookings b left join forma_private.agenda_contracts c on c.booking_id=b.id where b.start_date between d and e)
 select jsonb_build_object('version',1,'finance_version',1,'report_version',1,'period_from',d,'period_to',e,'as_of',now(),
 'received_cents',coalesce((select sum(amount_cents) from payments),0),'payment_count',(select count(*) from payments),
 'outflow_cents',coalesce((select sum(amount_cents) from outs),0),'expense_cents',coalesce((select sum(amount_cents) from outs where kind='gasto'),0),'refund_cents',coalesce((select sum(amount_cents) from outs where kind='reembolso'),0),
 'by_stream',coalesce((select jsonb_agg(x order by cents desc) from (select case when p.enrolment_id is not null or p.activity in ('Clase grupal','Clase individual','Curso') then 'Cursos / matrículas' when p.booking_id is not null then 'Servicios / agendamientos' else 'Ingresos por conciliar' end label,sum(p.amount_cents) cents from payments p group by 1)x),'[]'::jsonb),'by_activity',coalesce((select data from breakdown where k='by_activity'),'[]'::jsonb),'by_area',coalesce((select data from breakdown where k='by_area'),'[]'::jsonb),'by_group',coalesce((select data from breakdown where k='by_group'),'[]'::jsonb),'by_method',coalesce((select data from breakdown where k='by_method'),'[]'::jsonb),
 'by_outflow_category',coalesce((select jsonb_agg(x order by cents desc) from(select category label,sum(amount_cents) cents from outs group by category)x),'[]'::jsonb),
 'by_outflow_method',coalesce((select jsonb_agg(x order by cents desc) from(select method label,sum(amount_cents) cents from outs group by method)x),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(x order by paid_on desc,created_at desc,id) from(select id,booking_id,client,amount_cents,paid_on,method,activity,area,group_name,note,created_at,enrolment_id,person_id from payments order by paid_on desc,created_at desc,id limit 200)x),'[]'::jsonb),'entries_limited',(select count(*)>200 from payments),
 'outflows',coalesce((select jsonb_agg(x order by paid_on desc,created_at desc,id) from(select id,kind,booking_id,amount_cents,paid_on,method,category,note,created_at from outs order by paid_on desc,created_at desc,id limit 101)x),'[]'::jsonb),'outflows_limited',(select count(*)>100 from outs),
 'bookings',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('pending_cents',case when total_cents is null then null else greatest(0,total_cents-paid_cents-waived_cents) end)) from(select * from bookings order by start_date desc,client,id limit 200)x),'[]'::jsonb),'bookings_limited',(select count(*)>200 from bookings),
 'refunds',coalesce((select jsonb_agg(x) from(select f.id,f.booking_id,f.amount_cents,f.status,f.reason,f.created_at,b.client from forma_private.finance_refunds f join forma_private.agenda_bookings b on b.id=f.booking_id where exists(select 1 from outs o where o.refund_id=f.id) order by f.created_at desc,f.id limit 101)x),'[]'::jsonb),
 'timeline',coalesce((select jsonb_agg(jsonb_build_object('day',day,'incoming',case when day>(now() at time zone 'America/Sao_Paulo')::date then null else coalesce((select sum(amount_cents) from payments p where (case when bucket='month' then date_trunc('month',p.paid_on)::date else p.paid_on end)=day),0) end,'outgoing',case when day>(now() at time zone 'America/Sao_Paulo')::date then null else coalesce((select sum(amount_cents) from outs o where (case when bucket='month' then date_trunc('month',o.paid_on)::date else o.paid_on end)=day),0) end) order by day) from days),'[]'::jsonb))
$$;
revoke all on function forma_private.finance_period_data(date,date,text) from public,anon,authenticated;
create or replace function forma_private.finance_reports(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();uid uuid:=auth.uid();today date:=(now() at time zone 'America/Sao_Paulo')::date;d date;e date;bucket text;skip integer;q text;result jsonb;rid uuid;revision_value integer;reason_value text;old forma_private.finance_closings;
begin
 if r not in ('owner','manager') then raise exception 'Informes requiere gestión de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'periods',true,'closings',true);end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 if p_action='pending' then
  skip:=coalesce((p_data->>'offset')::integer,0);q:=lower(trim(coalesce(p_data->>'query','')));
  if skip<0 or skip>1000000 or length(q)>160 then raise exception 'Consulta inválida' using errcode='22023';end if;
  with amounts as materialized(select b.id,b.client,b.phone,b.activity,b.area,b.group_name,b.cancelled,b.start_date,c.total_cents,c.payment_plan,c.due_on,c.preferred_method,null::uuid enrolment_id,
   coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=b.id and p.voided_at is null),0) paid_cents,
   coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=b.id),0) waived_cents from forma_private.agenda_bookings b join forma_private.agenda_contracts c on c.booking_id=b.id where not exists(select 1 from forma_private.education_bookings eb where eb.booking_id=b.id and eb.finance_link) union all select id,client,phone,activity,area,group_name,cancelled,start_date,total_cents,payment_plan,due_on,preferred_method,enrolment_id,paid_cents,waived_cents from forma_private.education_debts()),
  debts as materialized(select *,greatest(0,total_cents-paid_cents-waived_cents) pending_cents from amounts where total_cents-paid_cents-waived_cents>0),
  matching as materialized(select * from debts where q='' or strpos(lower(client||' '||phone||' '||area||' '||activity),q)>0),
  page as(select * from matching order by due_on nulls last,client,id limit 30 offset skip)
  select jsonb_build_object('version',1,'as_of',now(),'today',today,'total_cents',coalesce((select sum(pending_cents) from debts),0),'total_count',(select count(*) from debts),'filtered_count',(select count(*) from matching),'offset',skip,'has_more',(select count(*) from matching)>skip+30,'items',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('due_status',case when due_on is null then 'Sin fecha' when due_on<today then 'Vencido' when due_on=today then 'Vence hoy' else 'Próximo' end)) from page),'[]'::jsonb)) into result;
  return result;
 end if;
 if p_action='period' then d:=(p_data->>'from')::date;e:=(p_data->>'to')::date;bucket:=coalesce(p_data->>'bucket','day');
 elsif p_action in ('closing_preview','closing_get','close') then d:=(p_data->>'month')::date;e:=(d+interval '1 month'-interval '1 day')::date;bucket:='day';
 else raise exception 'Acción inválida' using errcode='22023';end if;
 if d is null or e is null or d<'2020-01-01' or e>'2045-12-31' or e<d or e-d>366 or bucket not in ('day','month') or (bucket='month' and extract(day from d)<>1) or (p_action<>'period' and extract(day from d)<>1) then raise exception 'Período inválido' using errcode='22023';end if;
 if p_action='period' then return forma_private.finance_period_data(d,e,bucket);end if;
 if p_action='closing_get' then
  select * into old from forma_private.finance_closings where month=d and revision=(p_data->>'revision')::integer;
  if not found then raise exception 'Cierre no encontrado' using errcode='22023';end if;
  return jsonb_build_object('version',1,'id',old.id,'month',old.month,'revision',old.revision,'created_at',old.created_at,'snapshot',old.snapshot,'reason',old.reason);
 end if;
 if p_action='closing_preview' then
  select coalesce(max(revision),0) into revision_value from forma_private.finance_closings where month=d;
  return jsonb_build_object('version',1,'month',d,'can_close',e<today,'latest_revision',revision_value,'snapshot',forma_private.finance_period_data(d,e,'day'),'history',coalesce((select jsonb_agg(jsonb_build_object('revision',revision,'created_at',created_at,'reason',reason) order by revision desc) from forma_private.finance_closings where month=d),'[]'::jsonb));
 end if;
 rid:=(p_data->>'request_id')::uuid;reason_value:=trim(coalesce(p_data->>'reason',''));
 if rid is null then raise exception 'Falta identificador' using errcode='22023';end if;
 select * into old from forma_private.finance_closings where id=rid;
 if found then
  if old.actor<>uid or old.request_data<>p_data then raise exception 'Solicitud ya usada con otros datos' using errcode='22023';end if;
  return jsonb_build_object('version',1,'saved',true,'already_saved',true,'revision',old.revision,'snapshot',old.snapshot);
 end if;
 if e>=today then raise exception 'El mes no terminó; exporta un borrador' using errcode='22023';end if;
 select coalesce(max(revision),0) into revision_value from forma_private.finance_closings where month=d;
 if (p_data->>'expected_revision') is null or (p_data->>'expected_revision')::integer<>revision_value then raise exception 'Otro cierre fue registrado; actualiza antes de continuar' using errcode='40001';end if;
 if length(reason_value)>500 or (revision_value>0 and length(reason_value)<3) then raise exception 'Indica el motivo de la nueva revisión' using errcode='22023';end if;
 result:=forma_private.finance_period_data(d,e,'day');
 insert into forma_private.finance_closings(id,month,revision,actor,reason,request_data,snapshot) values(rid,d,revision_value+1,uid,reason_value,p_data,result);
 insert into forma_private.finance_audit(actor,action,payload) values(uid,'closing',jsonb_build_object('id',rid,'month',d,'revision',revision_value+1,'reason',reason_value));
 return jsonb_build_object('version',1,'saved',true,'revision',revision_value+1,'snapshot',result);
end$$;
create or replace function public.forma_finance_reports(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.finance_reports(p_action,p_data)$$;
revoke all on function forma_private.finance_reports(text,jsonb),public.forma_finance_reports(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.finance_reports(text,jsonb),public.forma_finance_reports(text,jsonb) to authenticated;
create or replace function forma_private.statement(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();d date;e date;skip integer;q text;k text;m text;c text;include_void boolean;result jsonb;
begin
 if r is null or r not in ('owner','manager') then raise exception 'Extracto requiere gestión de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 d:=(p_data->>'from')::date;e:=(p_data->>'to')::date;skip:=coalesce((p_data->>'offset')::integer,0);
 q:=lower(trim(coalesce(p_data->>'query','')));k:=coalesce(p_data->>'kind','');m:=coalesce(p_data->>'method','');c:=coalesce(p_data->>'category','');include_void:=coalesce((p_data->>'include_void')::boolean,false);
 if d is null or e is null or d>e or e-d>365 or d<'2020-01-01' or e>'2045-12-31' or skip<0 or length(q)>160 or length(c)>160 or k not in ('','payment','gasto','reembolso') or m not in ('','pix','efectivo','tarjeta','transferencia','bitcoin') then raise exception 'Filtros inválidos: máximo un año' using errcode='22023';end if;
 with movements as materialized(
 select p.id,p.booking_id,'payment'::text kind,p.paid_on,p.created_at,coalesce(b.client,p.payer_name) label,p.area category,p.activity,p.method,p.amount_cents,p.note,p.voided_at,p.void_reason,p.enrolment_id,p.person_id
 from forma_private.institution_receipts p left join forma_private.agenda_bookings b on b.id=p.booking_id where p.paid_on between d and e
 union all
 select o.id,o.booking_id,o.kind,o.paid_on,o.created_at,coalesce(b.client,o.category),o.category,coalesce(b.activity,''),o.method,o.amount_cents,o.note,o.voided_at,o.void_reason,null::uuid,null::uuid
 from forma_private.finance_outflows o left join forma_private.agenda_bookings b on b.id=o.booking_id where o.paid_on between d and e
 ), matching as materialized(select * from movements x where (include_void or x.voided_at is null) and (k='' or x.kind=k) and (m='' or x.method=m) and (c='' or x.category=c) and (q='' or position(q in lower(concat_ws(' ',x.label,x.category,x.activity,x.note)))>0)),
 page as(select * from matching order by paid_on desc,created_at desc,kind,id limit 30 offset skip)
 select jsonb_build_object('version',1,'from',d,'to',e,'offset',skip,'as_of',now(),'filtered_count',(select count(*) from matching),'has_more',(select count(*) from matching)>skip+30,
 'incoming_cents',coalesce((select sum(amount_cents) from matching where kind='payment' and voided_at is null),0),
 'outgoing_cents',coalesce((select sum(amount_cents) from matching where kind<>'payment' and voided_at is null),0),
 'categories',coalesce((select jsonb_agg(category order by category) from(select distinct category from movements)x),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(to_jsonb(page) order by paid_on desc,created_at desc,kind,id) from page),'[]'::jsonb)) into result;
 return result;
end$$;
create or replace function public.forma_statement(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.statement(p_data)$$;
revoke all on function forma_private.statement(jsonb),public.forma_statement(jsonb) from public,anon,authenticated;
grant execute on function forma_private.statement(jsonb),public.forma_statement(jsonb) to authenticated;
create or replace function forma_private.agenda_income(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();bid uuid;pid uuid;paid bigint;waived bigint;ct forma_private.agenda_contracts;result jsonb;linked uuid;
begin
 if r not in ('owner','manager') then raise exception 'Finanzas requiere gestión' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action in ('month','detail') then result:=forma_private.finance(p_action,p_data);if p_action='detail' then select enrolment_id into linked from forma_private.education_bookings where booking_id=(p_data->>'booking_id')::uuid and finance_link;result:=result||jsonb_build_object('enrolment_id',linked);end if;return result;end if;
 perform pg_advisory_xact_lock(7860152026::bigint);bid:=(p_data->>'booking_id')::uuid;
 if p_action='void' and exists(select 1 from forma_private.finance_refunds where payment_id=(p_data->>'id')::uuid and status in ('pendiente','devuelto')) then raise exception 'El pago tiene una devolución. No se puede anular el cobro original' using errcode='22023';end if;
 if p_action in ('payment','total') then if exists(select 1 from forma_private.education_bookings where booking_id=bid and finance_link) then raise exception 'Los cobros de esta reserva se administran en Matrículas. El historial original se conserva.' using errcode='22023';end if;
  select * into ct from forma_private.agenda_contracts where booking_id=bid;
  select coalesce(sum(amount_cents),0) into paid from forma_private.agenda_payments where booking_id=bid and voided_at is null;
  select coalesce(sum(amount_cents),0) into waived from forma_private.finance_waivers where booking_id=bid;
  if p_action='payment' and not exists(select 1 from forma_private.agenda_payments where id=(p_data->>'id')::uuid) and paid+waived+(p_data->>'amount_cents')::bigint>ct.total_cents then raise exception 'El pago supera el saldo después de los ajustes' using errcode='22023';end if;
  if p_action='total' and (p_data->>'total_cents')::bigint<paid+waived then raise exception 'El total no puede ser menor a cobros y ajustes ya registrados' using errcode='22023';end if;
 end if;
 return forma_private.agenda_income_v4(p_action,p_data);
end$$;
create or replace function forma_private.cash_ledger() returns table(account_id uuid,day date,cents bigint) language sql set search_path='' as $$
 select a.account_id,a.settled_on,p.amount_cents-a.fee_cents from forma_private.cash_allocations a join forma_private.institution_receipts p on a.kind='payment' and p.id=a.record_id where p.voided_at is null
 union all select a.account_id,a.settled_on,-o.amount_cents from forma_private.cash_allocations a join forma_private.finance_outflows o on a.kind='outflow' and o.id=a.record_id where o.voided_at is null
 union all select t.from_account,t.paid_on,-t.amount_cents from forma_private.cash_transfers t
 union all select t.to_account,t.paid_on,t.amount_cents from forma_private.cash_transfers t
$$;
revoke all on function forma_private.cash_ledger() from public,anon,authenticated;
create or replace function forma_private.cash(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();u uuid:=auth.uid();today date:=(now() at time zone 'America/Sao_Paulo')::date;d date;e date;a uuid;b uuid;rid uuid;rec uuid;k text;n bigint;fee bigint;dt date;v integer;ac forma_private.cash_accounts;old forma_private.cash_requests;result jsonb;expected integer;observed bigint;calculated bigint;raw jsonb;bill forma_private.cash_payables;
begin
 if r not in ('owner','manager') or u is null then raise exception 'Acceso de gestión requerido' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'accounts',true,'allocations',true,'reconciliation',true);end if;
 if p_action='payable_alerts' then return jsonb_build_object('version',1,'count',(select count(*) from forma_private.cash_payables where status='pendiente' and due_on<=today),'items',coalesce((select jsonb_agg(x) from(select id,title,amount_cents,due_on from forma_private.cash_payables where status='pendiente' and due_on<=today order by due_on,id limit 101)x),'[]'::jsonb));end if;
 if p_action='report' then
  d:=(p_data->>'from')::date;e:=(p_data->>'to')::date;
  if d is null or e is null or e<d or e-d>366 or d<'2020-01-01' or e>'2045-12-31' then raise exception 'Período inválido' using errcode='22023';end if;
  return jsonb_build_object('version',1,'accounts',coalesce((select jsonb_agg(x) from(select c.*,d>=c.opening_on as covers_start,e>=c.opening_on as covers_end,
   case when d>=c.opening_on then c.opening_cents+coalesce((select sum(l.cents) from forma_private.cash_ledger() l where l.account_id=c.id and l.day>=c.opening_on and l.day<d and l.day<=today),0) end as initial_cents,
   case when e>=c.opening_on then c.opening_cents+coalesce((select sum(l.cents) from forma_private.cash_ledger() l where l.account_id=c.id and l.day>=c.opening_on and l.day<=least(e,today)),0) end as final_cents,
   (select to_jsonb(z) from(select day,observed_cents,calculated_cents,created_at from forma_private.cash_reconciliations where account_id=c.id order by created_at desc,id limit 1)z) as reconciliation
   from forma_private.cash_accounts c order by c.created_at,c.id)x),'[]'::jsonb),
  'payables',coalesce((select jsonb_agg(x) from(select * from forma_private.cash_payables where status='pendiente' and due_on<=e order by due_on,id limit 101)x),'[]'::jsonb),'payable_cents',coalesce((select sum(amount_cents) from forma_private.cash_payables where status='pendiente' and due_on between d and e),0),
  'unassigned_count',(select count(*) from forma_private.institution_receipts p where p.voided_at is null and p.paid_on between coalesce((select min(opening_on) from forma_private.cash_accounts),'2020-01-01') and least(e,today) and not exists(select 1 from forma_private.cash_allocations a where a.kind='payment' and a.record_id=p.id))+(select count(*) from forma_private.finance_outflows o where o.voided_at is null and o.paid_on between coalesce((select min(opening_on) from forma_private.cash_accounts),'2020-01-01') and least(e,today) and not exists(select 1 from forma_private.cash_allocations a where a.kind='outflow' and a.record_id=o.id)),
  'fees_cents',coalesce((select sum(a.fee_cents) from forma_private.cash_allocations a join forma_private.institution_receipts p on a.record_id=p.id and a.kind='payment' where p.voided_at is null and a.settled_on between d and least(e,today)),0),
  'unsettled_cents',coalesce((select sum(p.amount_cents-a.fee_cents) from forma_private.cash_allocations a join forma_private.institution_receipts p on a.record_id=p.id and a.kind='payment' where p.voided_at is null and a.settled_on>today and p.paid_on<=least(e,today)),0),
  'records',coalesce((select jsonb_agg(x) from(select 'payment' kind,p.id,p.amount_cents,p.paid_on,p.method,coalesce(bk.client,p.payer_name) label,a.account_id,a.settled_on,a.fee_cents,a.card_type,a.version from forma_private.institution_receipts p left join forma_private.agenda_bookings bk on bk.id=p.booking_id left join forma_private.cash_allocations a on a.kind='payment' and a.record_id=p.id where p.voided_at is null and p.paid_on between d and e union all select 'outflow',o.id,o.amount_cents,o.paid_on,o.method,o.category,a.account_id,a.settled_on,a.fee_cents,a.card_type,a.version from forma_private.finance_outflows o left join forma_private.cash_allocations a on a.kind='outflow' and a.record_id=o.id where o.voided_at is null and o.paid_on between d and e order by paid_on desc,id limit 101)x),'[]'::jsonb));
 end if;
 if p_action not in ('account','allocate','transfer','reconcile','payable','payable_pay','payable_cancel') then raise exception 'Acción no disponible' using errcode='22023';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'Falta solicitud' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into old from forma_private.cash_requests where id=rid;
 if found then if old.actor<>u or old.action<>p_action or old.payload<>p_data then raise exception 'Solicitud usada con otros datos' using errcode='22023';end if;return old.result||jsonb_build_object('already_saved',true);end if;
 a:=nullif(p_data->>'account_id','')::uuid;dt:=nullif(p_data->>'day','')::date;
 if p_action='payable' then
  n:=(p_data->>'amount_cents')::bigint;
  if dt is null or dt<'2020-01-01' or dt>'2045-12-31' or n is null or n<=0 then raise exception 'Revisa importe y vencimiento' using errcode='22023';end if;
  insert into forma_private.cash_payables(id,title,category,amount_cents,due_on,actor) values(rid,trim(p_data->>'title'),trim(p_data->>'category'),n,dt,u);
 elsif p_action='payable_cancel' then
  if length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'Indica el motivo de cancelación' using errcode='22023';end if;
  update forma_private.cash_payables set status='cancelado' where id=(p_data->>'payable_id')::uuid and status='pendiente';if not found then raise exception 'La cuenta ya cambió. Actualiza' using errcode='40001';end if;
 elsif p_action='account' then
  if r<>'owner' then raise exception 'Solo dirección configura saldos iniciales' using errcode='42501';end if;
  n:=(p_data->>'opening_cents')::bigint;
  if length(trim(coalesce(p_data->>'name','')))<2 or length(p_data->>'name')>100 or n is null or abs(n)>100000000000 or dt is null or dt>today or dt<'2020-01-01' then raise exception 'Revisa cuenta, saldo y fecha inicial' using errcode='22023';end if;
  insert into forma_private.cash_accounts(id,name,opening_on,opening_cents,actor) values(rid,trim(p_data->>'name'),dt,n,u);
 else
  select * into ac from forma_private.cash_accounts where id=a;if not found then raise exception 'Selecciona una cuenta' using errcode='22023';end if;
  if dt is null or dt<ac.opening_on or dt>'2045-12-31' then raise exception 'Fecha anterior al saldo inicial o inválida' using errcode='22023';end if;
  if p_action='payable_pay' then
   select * into bill from forma_private.cash_payables where id=(p_data->>'payable_id')::uuid and status='pendiente' for update;
   if not found then raise exception 'La cuenta ya cambió. Actualiza' using errcode='40001';end if;
   if dt>today then raise exception 'Confirma solo una salida ya realizada' using errcode='22023';end if;
   result:=forma_private.finance('expense',jsonb_build_object('request_id',rid,'amount_cents',bill.amount_cents,'paid_on',dt,'method',p_data->>'method','category',bill.category,'reason','Pago previsto: '||bill.title));
   insert into forma_private.cash_allocations(kind,record_id,account_id,settled_on,fee_cents,actor) values('outflow',rid,a,dt,0,u);
   update forma_private.cash_payables set status='pagado',outflow_id=rid where id=bill.id;
  elsif p_action='allocate' then
   k:=p_data->>'kind';rec:=(p_data->>'record_id')::uuid;fee:=coalesce((p_data->>'fee_cents')::bigint,0);
   if k='payment' then select to_jsonb(p) into raw from forma_private.institution_receipts p where id=rec and voided_at is null;
   elsif k='outflow' then select to_jsonb(o) into raw from forma_private.finance_outflows o where id=rec and voided_at is null;else raise exception 'Movimiento inválido' using errcode='22023';end if;
   if raw is null or fee<0 or fee>(raw->>'amount_cents')::bigint or (k='outflow' and (fee<>0 or dt<>(raw->>'paid_on')::date)) or dt<(raw->>'paid_on')::date or (raw->>'method'<>'tarjeta' and (fee<>0 or dt<>(raw->>'paid_on')::date or coalesce(p_data->>'card_type','')<>'')) then raise exception 'Revisa movimiento, fecha y comisión' using errcode='22023';end if;
   select version into v from forma_private.cash_allocations where kind=k and record_id=rec for update;expected:=nullif(p_data->>'expected','')::integer;
   if v is distinct from expected then raise exception 'La asignación cambió. Actualiza' using errcode='40001';end if;
   insert into forma_private.cash_allocations(kind,record_id,account_id,settled_on,fee_cents,card_type,actor) values(k,rec,a,dt,fee,coalesce(p_data->>'card_type',''),u) on conflict(kind,record_id) do update set account_id=excluded.account_id,settled_on=excluded.settled_on,fee_cents=excluded.fee_cents,card_type=excluded.card_type,version=cash_allocations.version+1,actor=u,updated_at=now();
  elsif p_action='transfer' then
   b:=(p_data->>'to_account')::uuid;n:=(p_data->>'amount_cents')::bigint;
   if dt>today or n is null or n<=0 or n>100000000000 or b=a or not exists(select 1 from forma_private.cash_accounts where id=b and opening_on<=dt) or length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'Revisa transferencia' using errcode='22023';end if;
   insert into forma_private.cash_transfers(id,from_account,to_account,amount_cents,paid_on,note,actor) values(rid,a,b,n,dt,trim(p_data->>'note'),u);
  else
   observed:=(p_data->>'observed_cents')::bigint;
   if observed is null or abs(observed)>100000000000 or dt>today then raise exception 'Saldo observado inválido' using errcode='22023';end if;
   select ac.opening_cents+coalesce(sum(cents),0) into calculated from forma_private.cash_ledger() where account_id=a and day between ac.opening_on and dt;
   insert into forma_private.cash_reconciliations(id,account_id,day,observed_cents,calculated_cents,note,actor) values(rid,a,dt,observed,calculated,coalesce(p_data->>'note',''),u);
  end if;
 end if;
 result:=jsonb_build_object('saved',true,'id',rid);
 insert into forma_private.cash_audit(actor,action,payload) values(u,p_action,p_data);insert into forma_private.cash_requests values(rid,u,p_action,p_data,result,now());return result;
end$$;
revoke all on function forma_private.cash(text,jsonb) from public,anon;grant execute on function forma_private.cash(text,jsonb) to authenticated;
create or replace function public.forma_cash(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.cash(p_action,p_data)$$;
revoke all on function public.forma_cash(text,jsonb) from public,anon;grant execute on function public.forma_cash(text,jsonb) to authenticated;
create or replace function forma_private.monthly_type(v text) returns text language sql immutable set search_path='' as $$
 select case when lower(v) ~ 'clase|curso' then 'Cursos' when lower(v) ~ 'mentor' then 'Mentorías' when lower(v) ~ 'asesor|agendamiento|consulta|orientaci' then 'Asesorías' else 'Otras' end
$$;
revoke all on function forma_private.monthly_type(text) from public,anon,authenticated;
create or replace function forma_private.monthly_summary(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare role_value text:=forma_private.agenda_role();d date;e date;links jsonb:='[]';result jsonb;skip integer:=coalesce((p_data->>'offset')::integer,0);filter_type text:=p_data->>'type';filter_area text:=p_data->>'area';
begin
 if role_value is null or role_value not in ('owner','manager') then raise exception 'Solo gestión de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 d:=(p_data->>'month')::date;e:=(d+interval '1 month'-interval '1 day')::date;
 if d is null or d<'2020-01-01' or d>'2045-12-01' or extract(day from d)<>1 or skip<0 or skip>1000000 or length(coalesce(filter_area,''))>120 or (filter_type is not null and filter_type not in ('Cursos','Mentorías','Asesorías','Otras')) then raise exception 'Consulta inválida' using errcode='22023';end if;
 if to_regclass('forma_private.crm_booking_people') is not null then execute 'select coalesce(jsonb_agg(jsonb_build_object(''booking_id'',booking_id,''person_id'',person_id)),''[]''::jsonb) from forma_private.crm_booking_people' into links;end if;
 with contacts as (select * from jsonb_to_recordset(links) as x(booking_id uuid,person_id uuid)),
 events as materialized(select b.id booking_id,b.client,forma_private.monthly_type(b.activity) type,b.area,b.cancelled,s::date as day,c.person_id,coalesce(a.status,'pendiente') attendance
 from forma_private.agenda_bookings b cross join lateral generate_series(b.start_date::timestamp,(b.start_date+(b.sessions-1)*7)::timestamp,interval '7 days') s
 left join contacts c on c.booking_id=b.id left join forma_private.agenda_attendance a on a.booking_id=b.id and a.day=s::date where s::date between d and e),
 payments as materialized(select p.*,coalesce(b.client,p.payer_name) client from forma_private.institution_receipts p left join forma_private.agenda_bookings b on b.id=p.booking_id where p.voided_at is null and p.paid_on between d and e),
 debt as materialized(select b.id booking_id,b.client,forma_private.monthly_type(b.activity) type,b.area,c.due_on,
 greatest(0,c.total_cents-coalesce((select sum(p.amount_cents) from forma_private.institution_receipts p where p.booking_id=b.id and p.voided_at is null),0)-coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=b.id),0)) amount_cents,null::uuid enrolment_id
 from forma_private.agenda_bookings b join forma_private.agenda_contracts c on c.booking_id=b.id where c.total_cents is not null and not exists(select 1 from forma_private.education_bookings eb where eb.booking_id=b.id and eb.finance_link) union all select null::uuid,client,'Cursos',area,due_on,total_cents-paid_cents,enrolment_id from forma_private.education_debts()),
 refunds as materialized(select o.booking_id,b.client,forma_private.monthly_type(p.activity) type,p.area,o.paid_on,o.amount_cents,o.method from forma_private.finance_outflows o join forma_private.finance_refunds f on f.id=o.refund_id join forma_private.institution_receipts p on p.id=f.payment_id join forma_private.agenda_bookings b on b.id=o.booking_id where o.kind='reembolso' and o.voided_at is null and o.paid_on between d and e),
 rows as materialized(
 select 'encounter' kind,booking_id,client,type,area,day,null::text method,case when cancelled then 0 else 1 end encounters,0::bigint received_cents,0::bigint pending_cents,0::bigint refund_cents,cancelled,attendance,person_id,'booking' target,booking_id target_id from events
 union all select 'payment',booking_id,client,forma_private.monthly_type(activity),area,paid_on,method,0,amount_cents,0,0,false,null,person_id,case when booking_id is null then 'education' else 'booking' end,coalesce(booking_id,enrolment_id) from payments
 union all select 'debt',booking_id,client,type,area,due_on,null,0,0,amount_cents,0,false,null,null::uuid,case when booking_id is null then 'education' else 'booking' end,coalesce(booking_id,enrolment_id) from debt where due_on between d and e and amount_cents>0
 union all select 'refund',booking_id,client,type,area,paid_on,method,0,0,0,amount_cents,false,null,null::uuid,'booking',booking_id from refunds),
 grouped as(select type,area,sum(encounters) encounters,sum(received_cents) received_cents,sum(pending_cents) pending_cents,sum(refund_cents) refund_cents from rows group by type,area),
 by_type as(select type,sum(encounters) encounters,sum(received_cents) received_cents,sum(pending_cents) pending_cents,sum(refund_cents) refund_cents from grouped group by type),
 by_area as(select area,sum(encounters) encounters,sum(received_cents) received_cents,sum(pending_cents) pending_cents,sum(refund_cents) refund_cents from grouped group by area),
 matching as materialized(select * from rows where (filter_type is null or type=filter_type) and (filter_area is null or area=filter_area)),
 page as(select * from matching order by day,kind,client,booking_id limit 50 offset skip)
 select jsonb_build_object('version',1,'exact',true,'from',d,'to',e,'as_of',now(),
 'encounters',(select count(*) from events where not cancelled),'cancelled',(select count(*) from events where cancelled),'people',(select count(distinct person_id) from events where not cancelled),'unlinked',(select count(distinct booking_id) from events where not cancelled and person_id is null),'crm_available',to_regclass('forma_private.crm_booking_people') is not null,
 'realizada',(select count(*) from events where not cancelled and attendance='realizada'),'no_asistio',(select count(*) from events where not cancelled and attendance='no_asistio'),'pendiente',(select count(*) from events where not cancelled and attendance='pendiente'),
 'received_cents',coalesce((select sum(amount_cents) from payments),0),'refund_cents',coalesce((select sum(amount_cents) from refunds),0),'pending_cents',coalesce((select sum(amount_cents) from debt where due_on between d and e),0),'undated_pending_cents',coalesce((select sum(amount_cents) from debt where due_on is null),0),
 'by_type',coalesce((select jsonb_agg(to_jsonb(x) order by type) from by_type x),'[]'::jsonb),'by_area',coalesce((select jsonb_agg(to_jsonb(x) order by area) from by_area x),'[]'::jsonb),'groups',coalesce((select jsonb_agg(to_jsonb(x) order by type,area) from grouped x),'[]'::jsonb),
 'rows',coalesce((select jsonb_agg(to_jsonb(x) order by day,kind,client,booking_id) from page x),'[]'::jsonb),'offset',skip,'detail_count',(select count(*) from matching),'has_more',(select count(*)>skip+50 from matching)) into result;
 return result;
end$$;
revoke all on function forma_private.monthly_summary(jsonb) from public,anon;grant execute on function forma_private.monthly_summary(jsonb) to authenticated;
create or replace function public.forma_monthly_summary(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.monthly_summary(p_data)$$;
revoke all on function public.forma_monthly_summary(jsonb) from public,anon;grant execute on function public.forma_monthly_summary(jsonb) to authenticated;
notify pgrst,'reload schema';


-- Transactional academic groups, meetings and enrollment, in independent FORMA.

create or replace function forma_private.academic_conflict(p_day date,p_start integer,p_end integer,p_instructor text,p_room text,p_group uuid default null) returns boolean language sql set search_path='' as $$
 select exists(select 1 from forma_private.academic_sessions s join forma_private.academic_groups g on g.id=s.group_id where not s.cancelled and g.active and (p_group is null or g.id<>p_group) and s.day=p_day and s.start_min<p_end and p_start<s.end_min and (lower(g.instructor)=lower(p_instructor) or lower(g.room)=lower(p_room)))
 or exists(select 1 from forma_private.agenda_bookings b where not b.cancelled and p_day>=b.start_date and (p_day-b.start_date)%7=0 and (p_day-b.start_date)/7<b.sessions and b.start_hour*60<p_end and p_start<(b.start_hour+b.duration)*60 and (p_instructor=any(b.instructors) or 'Sin asignar'=any(b.instructors) or (b.room<>'' and lower(b.room)=lower(p_room))))
$$;
revoke all on function forma_private.academic_conflict(date,integer,integer,text,text,uuid) from public,anon,authenticated;
create or replace function forma_private.academic_booking_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(7860152026::bigint);
 if length(new.room)>120 then raise exception 'Revisa el nombre de la sala' using errcode='22023';end if;
 if not new.cancelled and new.room<>'' and exists(select 1 from forma_private.agenda_bookings b cross join lateral generate_series(new.start_date::timestamp,(new.start_date+(new.sessions-1)*7)::timestamp,interval '7 days') q(day) where b.id<>new.id and not b.cancelled and lower(b.room)=lower(new.room) and q.day::date>=b.start_date and (q.day::date-b.start_date)%7=0 and (q.day::date-b.start_date)/7<b.sessions and b.start_hour<new.start_hour+new.duration and new.start_hour<b.start_hour+b.duration) then raise exception 'La sala ya está ocupada por otro servicio' using errcode='23P01';end if;
 if not new.cancelled and exists(select 1 from forma_private.academic_sessions s join forma_private.academic_groups g on g.id=s.group_id where not s.cancelled and g.active and s.day>=new.start_date and (s.day-new.start_date)%7=0 and (s.day-new.start_date)/7<new.sessions and s.start_min<(new.start_hour+new.duration)*60 and new.start_hour*60<s.end_min and (g.instructor=any(new.instructors) or 'Sin asignar'=any(new.instructors) or (new.room<>'' and lower(new.room)=lower(g.room)))) then raise exception 'Ocupado por un curso: revisa instructor, sala y horario.' using errcode='23P01';end if;return new;end$$;
revoke all on function forma_private.academic_booking_guard() from public,anon,authenticated;
drop trigger if exists academic_booking_guard on forma_private.agenda_bookings;
create trigger academic_booking_guard before insert or update on forma_private.agenda_bookings for each row execute function forma_private.academic_booking_guard();
create or replace function forma_private.academic(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare who text:=forma_private.agenda_role();uid uuid:=auth.uid();rid uuid;old forma_private.academic_requests;result jsonb;gid uuid;cid uuid;pid uuid;eid uuid;g forma_private.academic_groups;c forma_private.academic_courses;previous_enrol forma_private.education_enrolments;booking forma_private.agenda_bookings;j jsonb;d date;sm integer;em integer;enr jsonb;pay jsonb;paid integer;first_day date;last_day date;student_count integer;matches integer;crm_candidate uuid;begin
 if who is null or who not in ('owner','manager','instructor') then raise exception 'Acceso exclusivo de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='calendar' then
  if p_data->>'from' is null or p_data->>'to' is null or (p_data->>'to')::date-(p_data->>'from')::date not between 0 and 370 then raise exception 'Rango inválido' using errcode='22023';end if;
  return jsonb_build_object('version',1,'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'group_id',g.id,'group_name',g.name,'course',c.name,'day',s.day,'start_min',s.start_min,'end_min',s.end_min,'module',s.module,'instructor',g.instructor,'room',g.room) order by s.day,s.start_min) from forma_private.academic_sessions s join forma_private.academic_groups g on g.id=s.group_id join forma_private.academic_courses c on c.id=g.course_id where not s.cancelled and g.active and s.day between (p_data->>'from')::date and (p_data->>'to')::date and (who in ('owner','manager') or g.instructor=(select instructor from forma_private.agenda_staff where user_id=uid))),'[]'::jsonb));
 end if;
 if who not in ('owner','manager') then raise exception 'Solo administración de FORMA' using errcode='42501';end if;
 if p_action='catalog' then return jsonb_build_object('version',1,'academic',true,'courses',coalesce((select jsonb_agg(to_jsonb(c)-'created_by' order by c.name) from forma_private.academic_courses c),'[]'::jsonb),'groups',coalesce((select jsonb_agg((to_jsonb(g)-'created_by')||jsonb_build_object('course',c.name,'students',(select count(*) from forma_private.education_enrolments e where e.group_id=g.id and e.state<>'cancelado'),'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by day,start_min,id) from forma_private.academic_sessions s where s.group_id=g.id and not s.cancelled),'[]'::jsonb)) order by c.name,g.name) from forma_private.academic_groups g join forma_private.academic_courses c on c.id=g.course_id),'[]'::jsonb));end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'Identificador requerido' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into old from forma_private.academic_requests where id=rid;
 if found then if old.actor<>uid or old.action<>p_action or old.payload<>p_data then raise exception 'Operación usada con otros datos' using errcode='22023';end if;return old.result;end if;
 if p_action='service_person' then
  select * into booking from forma_private.agenda_bookings where id=(p_data->>'booking_id')::uuid;if not found then raise exception 'Reserva no encontrada' using errcode='22023';end if;
  select person_id into pid from forma_private.crm_booking_people where booking_id=booking.id;
  if pid is null and length(regexp_replace(booking.phone,'[^0-9]','','g'))>=8 then
   select count(*),min(p.id::text)::uuid into matches,pid from forma_private.crm_people p where regexp_replace(p.phone,'[^0-9]','','g')=regexp_replace(booking.phone,'[^0-9]','','g');
   if matches>1 or (matches=1 and not exists(select 1 from forma_private.crm_people p where p.id=pid and forma_private.crm_normalize(p.name)=forma_private.crm_normalize(booking.client))) then raise exception 'Hay otra ficha con ese teléfono. Busca y revisa la persona antes de vincular.' using errcode='22023';end if;
  end if;
  if pid is null then enr:=forma_private.education('person',jsonb_build_object('request_id',rid,'name',booking.client,'phone',booking.phone,'email','','language','es','booking_id',booking.id));pid:=(enr->>'person_id')::uuid;end if;
  perform forma_private.crm('link',jsonb_build_object('request_id',gen_random_uuid(),'person_id',pid,'booking_id',booking.id));
 elsif p_action='course_save' then
  cid:=coalesce(nullif(p_data->>'id','')::uuid,rid);select * into c from forma_private.academic_courses where id=cid for update;if found and c.version is distinct from (p_data->>'expected')::integer then raise exception 'El curso cambió; actualiza antes de editar' using errcode='40001';end if;
  if jsonb_typeof(p_data->'modules') is distinct from 'array' or jsonb_array_length(p_data->'modules')>100 or exists(select 1 from jsonb_array_elements(p_data->'modules') x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 160) then raise exception 'Revisa los módulos' using errcode='22023';end if;
  insert into forma_private.academic_courses(id,name,modules,active,created_by) values(cid,trim(p_data->>'name'),p_data->'modules',coalesce((p_data->>'active')::boolean,true),uid) on conflict(id) do update set name=excluded.name,modules=excluded.modules,active=excluded.active,version=academic_courses.version+1;
 elsif p_action='group_save' then
  gid:=coalesce(nullif(p_data->>'id','')::uuid,rid);select * into g from forma_private.academic_groups where id=gid for update;if found and g.version is distinct from (p_data->>'expected')::integer then raise exception 'El grupo cambió; actualiza antes de editar' using errcode='40001';end if;
  cid:=(p_data->>'course_id')::uuid;select * into c from forma_private.academic_courses where id=cid;if not found or not c.active or (g.id is not null and g.course_id<>cid) then raise exception 'Selecciona un curso activo; conserva el curso de un grupo existente' using errcode='22023';end if;
  select count(*) into student_count from forma_private.education_enrolments where group_id=gid and state<>'cancelado';if student_count>coalesce((p_data->>'capacity')::integer,0) then raise exception 'No puedes reducir los cupos por debajo de los alumnos matriculados' using errcode='22023';end if;
  if not (p_data->>'instructor'=any(array['Joel','René','Luis','Emerson','Miguel'])) and not exists(select 1 from forma_private.agenda_staff where active and instructor=p_data->>'instructor') then raise exception 'Selecciona un instructor registrado' using errcode='22023';end if;
  if jsonb_typeof(p_data->'sessions') is distinct from 'array' or jsonb_array_length(p_data->'sessions') not between 1 and 104 then raise exception 'Prepara entre 1 y 104 encuentros' using errcode='22023';end if;
  for j in select value from jsonb_array_elements(p_data->'sessions') loop
   d:=(j->>'day')::date;sm:=(j->>'start_min')::integer;em:=(j->>'end_min')::integer;
   if d is null or sm is null or em is null or d not between '2020-01-01' and '2045-12-31' or sm<0 or sm>=em or em>1440 then raise exception 'Revisa fechas y horas de cada encuentro' using errcode='22023';end if;
   if coalesce((p_data->>'active')::boolean,true) and forma_private.academic_conflict(d,sm,em,p_data->>'instructor',p_data->>'room',gid) then raise exception 'Ocupado: el instructor o la sala ya tiene una actividad' using errcode='23P01';end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_data->'sessions') with ordinality a(x,n) cross join jsonb_array_elements(p_data->'sessions') with ordinality b(y,m) where n<m and x->>'day'=y->>'day' and (x->>'start_min')::integer<(y->>'end_min')::integer and (y->>'start_min')::integer<(x->>'end_min')::integer) then raise exception 'Dos encuentros del grupo se superponen' using errcode='23P01';end if;
  insert into forma_private.academic_groups(id,course_id,name,instructor,room,capacity,fee_cents,monthly_cents,installments,active,created_by) values(gid,cid,trim(p_data->>'name'),trim(p_data->>'instructor'),trim(p_data->>'room'),(p_data->>'capacity')::integer,(p_data->>'fee_cents')::integer,(p_data->>'monthly_cents')::integer,(p_data->>'installments')::integer,coalesce((p_data->>'active')::boolean,true),uid) on conflict(id) do update set name=excluded.name,instructor=excluded.instructor,room=excluded.room,capacity=excluded.capacity,fee_cents=excluded.fee_cents,monthly_cents=excluded.monthly_cents,installments=excluded.installments,active=excluded.active,version=academic_groups.version+1;
  update forma_private.academic_sessions set cancelled=true where group_id=gid;
  for j in select value from jsonb_array_elements(p_data->'sessions') loop insert into forma_private.academic_sessions(id,group_id,day,start_min,end_min,module) values(gen_random_uuid(),gid,(j->>'day')::date,(j->>'start_min')::integer,(j->>'end_min')::integer,coalesce(j->>'module',''));end loop;
  select min(day),max(day) into first_day,last_day from forma_private.academic_sessions where group_id=gid and not cancelled;
  update forma_private.education_enrolments set starts_on=first_day,ends_on=last_day,version=version+1 where group_id=gid;
  insert into forma_private.education_events(person_id,actor,kind,message) select person_id,uid,'schedule',case when p.language='pt' then 'Os encontros do seu curso foram atualizados. Consulte seus horários.' else 'Los encuentros de tu curso fueron actualizados. Revisa tus horarios.' end from forma_private.education_enrolments e join forma_private.crm_people p on p.id=e.person_id where e.group_id=gid;
 elsif p_action='enrol_group' then
  gid:=(p_data->>'group_id')::uuid;pid:=(p_data->>'person_id')::uuid;select * into g from forma_private.academic_groups where id=gid and active for update;if not found or g.version is distinct from (p_data->>'expected')::integer then raise exception 'El grupo cambió o está cerrado; actualiza antes de matricular' using errcode='40001';end if;
  select * into c from forma_private.academic_courses where id=g.course_id and active;if not found then raise exception 'Curso cerrado' using errcode='22023';end if;
  if exists(select 1 from forma_private.education_enrolments where person_id=pid and group_id=gid and state<>'cancelado') then raise exception 'La persona ya está matriculada en este grupo' using errcode='23505';end if;
  select count(*) into student_count from forma_private.education_enrolments where group_id=gid and state<>'cancelado';if student_count>=g.capacity then raise exception 'Grupo completo: no hay vacantes' using errcode='22023';end if;
  select min(day),max(day) into first_day,last_day from forma_private.academic_sessions where group_id=gid and not cancelled;if first_day is null then raise exception 'Grupo sin encuentros' using errcode='22023';end if;
  paid:=coalesce((p_data->>'advance_cents')::integer,0);if paid<0 then raise exception 'Adelanto inválido' using errcode='22023';end if;
  eid:=nullif(p_data->>'existing_enrolment_id','')::uuid;
  if eid is not null then
   select * into previous_enrol from forma_private.education_enrolments e where e.id=eid and e.person_id=pid and e.group_id is null and e.state<>'cancelado' and forma_private.crm_normalize(e.course)=forma_private.crm_normalize(c.name) for update;if not found then raise exception 'Revisa la matrícula existente y el curso' using errcode='22023';end if;
   update forma_private.education_enrolments set group_id=gid,starts_on=first_day,ends_on=last_day,version=version+1 where id=eid;
  else
   if exists(select 1 from forma_private.education_enrolments e where e.person_id=pid and e.group_id is null and e.state<>'cancelado' and forma_private.crm_normalize(e.course)=forma_private.crm_normalize(c.name)) then raise exception 'Ya hay una matrícula de este curso. Selecciona Vincular matrícula existente para conservar sus pagos.' using errcode='22023';end if;
   select count(*),min(x.id::text)::uuid into matches,crm_candidate from forma_private.crm_enrolments x where x.person_id=pid and x.status='confirmada' and x.course=c.name and not exists(select 1 from forma_private.education_enrolments e where e.crm_id=x.id);if matches<>1 then crm_candidate:=null;end if;
   enr:=forma_private.education('enrol',jsonb_build_object('request_id',rid,'person_id',pid,'crm_id',crm_candidate,'course',c.name,'starts_on',first_day,'ends_on',last_day,'fee_cents',g.fee_cents,'monthly_cents',g.monthly_cents,'installments',g.installments,'first_due',p_data->>'first_due','fee_due',p_data->>'fee_due'));eid:=(enr->>'enrolment_id')::uuid;update forma_private.education_enrolments set group_id=gid where id=eid;
  end if;
  if paid>0 then pay:=forma_private.education('payment',jsonb_build_object('request_id',gen_random_uuid(),'person_id',pid,'enrolment_id',eid,'amount_cents',paid,'paid_on',p_data->>'paid_on','method',p_data->>'method','card_type',coalesce(p_data->>'card_type',''),'confirmed',coalesce((p_data->>'confirmed')::boolean,false),'note','Adelanto de matrícula · '||g.name));end if;
  if coalesce((p_data->>'portal')::boolean,false) then perform forma_private.education('portal',jsonb_build_object('request_id',gen_random_uuid(),'person_id',pid));end if;
 else raise exception 'Acción inválida' using errcode='22023';end if;
 result:=jsonb_build_object('version',1,'saved',true,'person_id',pid,'enrolment_id',eid,'receipt_id',pay->>'receipt_id','course_id',cid,'group_id',gid);
 insert into forma_private.academic_requests values(rid,uid,p_action,p_data,result,now());insert into forma_private.academic_history(actor,action,target,snapshot) values(uid,p_action,coalesce(gid,cid),p_data);return result;
end$$;
create or replace function public.forma_academic(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.academic(p_action,p_data)$$;
revoke all on function forma_private.academic(text,jsonb),public.forma_academic(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.academic(text,jsonb),public.forma_academic(text,jsonb) to authenticated;
notify pgrst,'reload schema';

-- BEGIN GENERATED AGENDA SAVE
create or replace function forma_private.agenda_save(p_id uuid,p_expected integer,p_data jsonb,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();old forma_private.agenda_bookings; saved forma_private.agenda_bookings;d date;h int;dur int;n int;i int;j int;k uuid;v_teachers text[];v_primary text;v_state text;v_student text;v_force boolean;v_override text;begin
 if r not in ('owner','manager') then raise exception 'Solo consulta' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or length(trim(coalesce(p_data->>'client','')))=0 or length(p_data->>'client')>160 or length(coalesce(p_data->>'phone',''))>40 or length(coalesce(p_data->>'profession',''))>240 or length(coalesce(p_data->>'group_name',''))>120 or length(coalesce(p_reason,''))>1000 then raise exception 'Revisa los datos' using errcode='22023';end if;
 if (p_data->>'activity') is null or p_data->>'activity' not in ('Mentoría particular','Asesoría','Agendamiento','Clase grupal','Clase individual','Inmersión','Invitación para podcast','Orientación','Otra actividad','Consulta','Asesoría / agendamiento') or length(trim(coalesce(p_data->>'area','')))=0 or length(p_data->>'area')>120 or (p_data->>'instructor') is null or p_data->>'instructor' not in ('Sin asignar','Joel','René','Luis','Emerson','Miguel') then raise exception 'Selecciona actividad, área e instructor válidos' using errcode='22023';end if;

 if p_data ? 'instructors' then
  if jsonb_typeof(p_data->'instructors')<>'array' then raise exception 'Selecciona instructores válidos' using errcode='22023';end if;
  select array_agg(distinct t order by t) into v_teachers from jsonb_array_elements_text(p_data->'instructors') t;
 else v_teachers:=array[p_data->>'instructor'];end if;
 if coalesce(cardinality(v_teachers),0)=0 or cardinality(v_teachers)>5 or not (v_teachers <@ array['Sin asignar','Joel','René','Luis','Emerson','Miguel']::text[]) or array_position(v_teachers,null) is not null or ('Sin asignar'=any(v_teachers) and cardinality(v_teachers)>1) then raise exception 'Selecciona instructores válidos' using errcode='22023';end if;
 v_primary:=case when p_data->>'instructor'=any(v_teachers) then p_data->>'instructor' else v_teachers[1] end;
 v_state:=coalesce(p_data->>'booking_state','por_confirmar');v_student:=trim(coalesce(p_data->>'student_reference',''));
 if v_state not in ('reservado','por_confirmar') or length(v_student)>80 then raise exception 'Estado o referencia inválida' using errcode='22023';end if;
 v_force:=coalesce((p_data->>'override_conflict')::boolean,false);v_override:=trim(coalesce(p_data->>'override_reason',''));
 if v_force and r<>'owner' then raise exception 'Solo el propietario puede autorizar una excepción' using errcode='42501';end if;
 if v_force and (length(v_override)=0 or length(v_override)>1000) then raise exception 'Indica el motivo de la excepción' using errcode='22023';end if;
 d:=(p_data->>'start_date')::date;h:=(p_data->>'start_hour')::int;dur:=(p_data->>'duration')::int;n:=(p_data->>'sessions')::int;
 if d is null or h is null or dur is null or n is null or extract(isodow from d)>6 or h<13 or h>17 or dur<1 or dur>5 or h+dur>18 or n<1 or n>52 then raise exception 'Horario válido: lunes a sábado, 13:00 a 18:00; 1 a 52 sesiones' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 if p_id is not null then
 select * into old from forma_private.agenda_bookings where id=p_id for update;
 if not found or old.cancelled or p_expected is distinct from old.version then raise exception 'La reserva cambió. Actualiza la agenda antes de editar' using errcode='40001';end if;

 end if;
 if not v_force and exists(select 1 from forma_private.agenda_slots s where (p_id is null or s.booking_id<>p_id) and s.day>=d and s.day<=d+7*(n-1) and (s.day-d)%7=0 and s.hour>=h and s.hour<h+dur and (s.instructor=any(v_teachers) or s.instructor='Sin asignar' or 'Sin asignar'=any(v_teachers))) then raise exception 'Hay un horario ocupado en esta serie. No se guardó ningún cambio' using errcode='23P01';end if;
 if p_id is null then
 insert into forma_private.agenda_bookings(client,phone,activity,area,profession,instructor,start_date,start_hour,duration,sessions,created_by,instructors,booking_state,student_reference,override_conflict,override_reason,group_name,room) values(trim(p_data->>'client'),coalesce(p_data->>'phone',''),p_data->>'activity',p_data->>'area',coalesce(p_data->>'profession',''),v_primary,d,h,dur,n,auth.uid(),v_teachers,v_state,v_student,v_force,case when v_force then v_override else '' end,trim(coalesce(p_data->>'group_name','')),trim(coalesce(p_data->>'room',''))) returning * into saved;
 else
 update forma_private.agenda_bookings set room=case when p_data ? 'room' then trim(coalesce(p_data->>'room','')) else old.room end,group_name=case when p_data ? 'group_name' then trim(coalesce(p_data->>'group_name','')) else old.group_name end,client=trim(p_data->>'client'),phone=coalesce(p_data->>'phone',''),activity=p_data->>'activity',area=p_data->>'area',profession=coalesce(p_data->>'profession',''),instructor=v_primary,instructors=v_teachers,booking_state=v_state,student_reference=v_student,override_conflict=v_force,override_reason=case when v_force then v_override else '' end,start_date=d,start_hour=h,duration=dur,sessions=n,version=version+1,updated_at=now() where id=p_id returning * into saved;
 delete from forma_private.agenda_slots where booking_id=p_id;
 end if;
 for i in 0..n-1 loop for j in h..h+dur-1 loop insert into forma_private.agenda_slots(day,hour,booking_id,instructor,override_conflict) select d+7*i,j,saved.id,t,v_force from unnest(v_teachers) t;end loop;end loop;
 insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(saved.id,auth.uid(),case when p_id is null then 'created' else 'updated' end,coalesce(p_reason,'')||case when v_force then ' · Excepción del propietario: '||v_override else '' end,jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(saved)));
 return jsonb_build_object('id',saved.id,'version',saved.version,'saved',true);
end$$;



commit;
select true as forma_actualizada;
