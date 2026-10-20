-- FORMA 19 octubre 2026. Activación atómica y aditiva. Solo proyecto independiente.
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
 id uuid primary key,person_id uuid not null references forma_private.crm_people(id),area text not null check(length(trim(area)) between 1 and 120),stage text not null check(stage in ('nuevo','conversacion','seguimiento','preparar_matricula','cerrado')),source text not null check(source in ('presencial','whatsapp','tiktok','instagram','facebook','recomendacion','desconocido')),next_action text not null default '' check(length(next_action)<=400),due_on date check(due_on between '2020-01-01' and '2045-12-31'),note text not null default '' check(length(note)<=1000),close_reason text not null default '' check(length(close_reason)<=400),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
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
declare r text:=forma_private.agenda_role();uid uuid:=auth.uid();pid uuid;bid uuid;rid uuid;v_query text;v_offset integer;v_name text;v_phone text;v_email text;v_language text;v_stage text;v_source text;v_area text;v_due date;v_id uuid;v_expected integer;v_person forma_private.crm_people;v_interest forma_private.crm_interests;v_request forma_private.crm_requests;v_booking forma_private.agenda_bookings;result jsonb;payload jsonb;today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if r is null or uid is null or r not in ('owner','manager') then raise exception 'Personas y Ventas requieren acceso de gestión' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'role',r,'people',true,'sales',true,'enrolments',false,'automatic_messages',false,'enhanced_sales',true,'catalog',true);end if;
 if p_action='catalog_list' then return jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(x) from(select * from forma_private.crm_catalog where approved or r='owner' order by title,id limit 301)x),'[]'::jsonb));end if;
 if p_action='alerts' then return jsonb_build_object('version',1,'total_count',(select count(*) from forma_private.crm_interests where stage<>'cerrado' and due_on<=today),'items',coalesce((select jsonb_agg(x) from(select i.id,i.person_id,i.area,i.next_action,i.due_on,i.due_time,p.name,p.phone from forma_private.crm_interests i join forma_private.crm_people p on p.id=i.person_id where i.stage<>'cerrado' and i.due_on<=today order by i.due_on,i.due_time nulls last,i.id limit 101)x),'[]'::jsonb));end if;
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
  'interests',coalesce((select jsonb_agg(x) from(select * from forma_private.crm_interests where person_id=pid order by updated_at desc,id limit 101)x),'[]'::jsonb));
 elsif p_action='sales' then
  v_stage:=coalesce(p_data->>'stage','');v_offset:=coalesce((p_data->>'offset')::integer,0);
  if v_offset<0 or v_offset>100000 or v_stage not in ('','nuevo','conversacion','seguimiento','preparar_matricula','cerrado') then raise exception 'Filtro inválido' using errcode='22023';end if;
  return jsonb_build_object('counts',coalesce((select jsonb_object_agg(stage,n) from(select stage,count(*) n from forma_private.crm_interests group by stage)x),'{}'::jsonb),
  'items',coalesce((select jsonb_agg(x) from(select i.*,p.name,p.phone from forma_private.crm_interests i join forma_private.crm_people p on p.id=i.person_id where v_stage='' or i.stage=v_stage order by i.due_on nulls last,i.updated_at desc,i.id limit 51 offset v_offset)x),'[]'::jsonb),'offset',v_offset);
 end if;
 if p_action not in ('person_save','link','interest_save','reserve') then raise exception 'Acción no disponible' using errcode='22023';end if;
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
 elsif p_action='interest_save' then
  if not exists(select 1 from forma_private.crm_people where id=pid) then raise exception 'Selecciona una persona' using errcode='22023';end if;
  v_id:=(p_data->>'id')::uuid;v_stage:=p_data->>'stage';v_source:=p_data->>'source';v_area:=trim(coalesce(p_data->>'area',''));v_due:=nullif(p_data->>'due_on','')::date;
  if v_stage is null or v_stage not in ('nuevo','conversacion','seguimiento','preparar_matricula','cerrado') or v_source is null or v_source not in ('presencial','whatsapp','tiktok','instagram','facebook','recomendacion','desconocido') or length(v_area)<1 or length(v_area)>120 or length(coalesce(p_data->>'next_action',''))>400 or length(coalesce(p_data->>'note',''))>1000 or length(coalesce(p_data->>'close_reason',''))>400 or (v_stage='cerrado' and length(trim(coalesce(p_data->>'close_reason','')))=0) or (v_due is not null and (v_due<'2020-01-01' or v_due>'2045-12-31')) then raise exception 'Revisa interés, etapa y motivo de cierre' using errcode='22023';end if;
  if v_id is null then
   v_id:=rid;insert into forma_private.crm_interests(id,person_id,area,stage,source,next_action,due_on,note,close_reason,created_by) values(v_id,pid,v_area,v_stage,v_source,trim(coalesce(p_data->>'next_action','')),v_due,coalesce(p_data->>'note',''),coalesce(p_data->>'close_reason',''),uid);
  else
   select * into v_interest from forma_private.crm_interests where id=v_id and person_id=pid for update;
   if not found or v_interest.version is distinct from (p_data->>'expected')::integer then raise exception 'El seguimiento cambió. Actualiza' using errcode='40001';end if;
   update forma_private.crm_interests set area=v_area,stage=v_stage,source=v_source,next_action=trim(coalesce(p_data->>'next_action','')),due_on=v_due,note=coalesce(p_data->>'note',''),close_reason=coalesce(p_data->>'close_reason',''),version=version+1,updated_at=now() where id=v_id;
  end if;
  if coalesce(p_data->>'temperature','') not in ('','frio','tibio','caliente','muy_caliente') or coalesce(p_data->>'outcome','') not in ('','ganado','perdido','retomar') or (nullif(p_data->>'due_time','') is not null and v_due is null) then raise exception 'Revisa temperatura, resultado y fecha' using errcode='22023';end if;
  update forma_private.crm_interests set temperature=case when p_data?'temperature' then coalesce(p_data->>'temperature','') else temperature end,due_time=case when p_data?'due_time' then nullif(p_data->>'due_time','')::time else due_time end,outcome=case when v_stage<>'cerrado' then '' when p_data?'outcome' then coalesce(p_data->>'outcome','') else outcome end where id=v_id;
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

select to_regprocedure('public.forma_crm(text,jsonb)') is not null as personas_ventas_instalado;

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

select to_regprocedure('public.forma_finance_reports(text,jsonb)') is not null as informes_y_cierres_instalados;

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

commit;
