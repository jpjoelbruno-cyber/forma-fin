-- FORMA · Personas y Ventas v1. Aditivo: no elimina ni reescribe reservas/pagos.
-- Solo proyecto irsuevjqmgpwunvymxbc, después de agenda-services-upgrade.sql.
begin;
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
 if r not in ('owner','manager') then raise exception 'Personas y Ventas requieren acceso de gestión' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'role',r,'people',true,'sales',true,'enrolments',false,'automatic_messages',false);end if;
 if p_action='search' then
  v_query:=lower(trim(coalesce(p_data->>'query','')));v_offset:=coalesce((p_data->>'offset')::integer,0);
  if length(v_query)>160 or v_offset<0 or v_offset>100000 then raise exception 'Búsqueda inválida' using errcode='22023';end if;
  return jsonb_build_object('people',coalesce((select jsonb_agg(x) from(select p.id,'FOR-'||lpad(p.number::text,greatest(6,length(p.number::text)),'0') as code,p.name,p.phone,p.email,p.language,p.version,(select count(*) from forma_private.crm_booking_people l where l.person_id=p.id) as linked_reservations from forma_private.crm_people p where v_query='' or position(v_query in lower(p.name||' '||p.phone||' '||p.email||' FOR-'||lpad(p.number::text,greatest(6,length(p.number::text)),'0')))>0 or (length(regexp_replace(v_query,'[^0-9]','','g'))>=5 and position(regexp_replace(v_query,'[^0-9]','','g') in regexp_replace(p.phone,'[^0-9]','','g'))>0) order by lower(p.name),p.id limit 31 offset v_offset)x),'[]'::jsonb),'offset',v_offset,
  'legacy',case when length(v_query)>=2 and v_offset=0 then coalesce((select jsonb_agg(x) from(select b.id,b.client as name,b.phone,b.area,b.start_date,b.cancelled from forma_private.agenda_bookings b where not exists(select 1 from forma_private.crm_booking_people l where l.booking_id=b.id) and (position(v_query in lower(b.client||' '||b.phone))>0 or (length(regexp_replace(v_query,'[^0-9]','','g'))>=5 and position(regexp_replace(v_query,'[^0-9]','','g') in regexp_replace(b.phone,'[^0-9]','','g'))>0)) order by b.start_date desc,b.id limit 21)x),'[]'::jsonb) else '[]'::jsonb end);
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
commit;
select to_regprocedure('public.forma_crm(text,jsonb)') is not null as personas_ventas_instalado;
