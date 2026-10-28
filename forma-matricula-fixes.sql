-- FORMÁ · Correcciones de matrícula (28/10/2026). ADITIVO y reversible. Ejecutar completo en el SQL Editor de FORMA.
-- 1) CPF del alumno en tabla privada aparte (no viaja en fichas, auditorías ni comprobantes).
-- 2) Un servicio de Agenda ya no bloquea guardar un grupo en Cursos (se conserva el choque REAL entre grupos de cursos; no se validan fechas pasadas).
-- 3) Cancelar/reactivar un grupo sin reenviar todos sus encuentros (acción group_set_active en forma_enrolment_admin).
-- La Agenda conserva su validación: un servicio nuevo sigue sin poder pisar una clase de un curso (trigger academic_booking_guard intacto).
-- Reversión: drop table forma_private.person_documents; drop function forma_private.cpf_valid(text);
--   y volver a ejecutar las funciones originales academic_conflict / academic_conflict_detail de forma-education-upgrade.sql (líneas 1095-1103)
--   y forma-enrolment-admin.sql para la función enrolment_admin.

create table if not exists forma_private.person_documents(
 person_id uuid primary key references forma_private.crm_people(id),
 cpf text check(cpf is null or cpf ~ '^[0-9]{11}$'),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now());
create unique index if not exists person_documents_cpf_unique on forma_private.person_documents(cpf) where cpf is not null;
alter table forma_private.person_documents enable row level security;
revoke all on forma_private.person_documents from public,anon,authenticated;

create or replace function forma_private.cpf_valid(v text) returns boolean language plpgsql immutable set search_path='' as $$
declare d text:=regexp_replace(coalesce(v,''),'[^0-9]','','g');s integer;i integer;r integer;
begin
 if length(d)<>11 or d ~ '^(.)\1{10}$' then return false;end if;
 s:=0;for i in 1..9 loop s:=s+substr(d,i,1)::integer*(11-i);end loop;r:=(s*10)%11;if r=10 then r:=0;end if;if r<>substr(d,10,1)::integer then return false;end if;
 s:=0;for i in 1..10 loop s:=s+substr(d,i,1)::integer*(12-i);end loop;r:=(s*10)%11;if r=10 then r:=0;end if;return r=substr(d,11,1)::integer;
end$$;
revoke all on function forma_private.cpf_valid(text) from public,anon,authenticated;

create or replace function forma_private.academic_conflict(p_day date,p_start integer,p_end integer,p_instructor text,p_room text,p_group uuid default null) returns boolean language sql set search_path='' as $$
 select p_day>=(now() at time zone 'America/Sao_Paulo')::date and exists(select 1 from forma_private.academic_sessions s join forma_private.academic_groups g on g.id=s.group_id where not s.cancelled and g.active and (p_group is null or g.id<>p_group) and s.day=p_day and s.start_min<p_end and p_start<s.end_min and (lower(coalesce(nullif(s.instructor,''),g.instructor))=lower(p_instructor) or lower(coalesce(nullif(s.room,''),g.room))=lower(p_room)))
$$;
revoke all on function forma_private.academic_conflict(date,integer,integer,text,text,uuid) from public,anon,authenticated;
create or replace function forma_private.academic_conflict_detail(d date,sm integer,em integer,teacher text,room_value text,gid uuid) returns text language sql set search_path='' as $$
 select coalesce((select 'Curso: '||c.name||' · '||g.name||' · '||coalesce(nullif(s.instructor,''),g.instructor)||' · '||coalesce(nullif(s.room,''),g.room) from forma_private.academic_sessions s join forma_private.academic_groups g on g.id=s.group_id join forma_private.academic_courses c on c.id=g.course_id where not s.cancelled and g.active and (gid is null or g.id<>gid) and s.day=d and s.start_min<em and sm<s.end_min and (lower(coalesce(nullif(s.instructor,''),g.instructor))=lower(teacher) or lower(coalesce(nullif(s.room,''),g.room))=lower(room_value)) order by s.start_min limit 1),'Revisa instructor y sala')
$$;
revoke all on function forma_private.academic_conflict_detail(date,integer,integer,text,text,uuid) from public,anon,authenticated;

create or replace function forma_private.enrolment_admin(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();who text:=forma_private.agenda_role();rid uuid;old forma_private.education_requests;
 enrol forma_private.education_enrolments;g_old forma_private.academic_groups;g_new forma_private.academic_groups;
 first_day date;last_day date;n integer;result jsonb;lang text;cpfv text;dig text;other_name text;pid uuid;sess forma_private.academic_sessions;flag boolean;
begin
 if who is null or who not in ('owner','manager') then raise exception 'Solo administración de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;

 if p_action='notes_list' then
  return jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(x order by x.created_at desc) from(select id,note,created_at from forma_private.education_notes where enrolment_id=(p_data->>'enrolment_id')::uuid order by created_at desc limit 50)x),'[]'::jsonb));
 end if;

 if p_action='cpf_get' then
  select cpf into cpfv from forma_private.person_documents where person_id=(p_data->>'person_id')::uuid;
  return jsonb_build_object('version',1,'has_cpf',cpfv is not null,'masked',case when cpfv is null then null else '***.***.'||substr(cpfv,7,3)||'-'||substr(cpfv,10,2) end);
 end if;
 if p_action='cpf_set' then
  pid:=(p_data->>'person_id')::uuid;
  if not exists(select 1 from forma_private.crm_people where id=pid) then raise exception 'No se encontró la persona' using errcode='22023';end if;
  dig:=regexp_replace(coalesce(p_data->>'cpf',''),'[^0-9]','','g');
  if dig='' then raise exception 'Escribe el CPF' using errcode='22023';end if;
  if not forma_private.cpf_valid(dig) then raise exception 'El CPF no es válido: revisa los 11 dígitos' using errcode='22023';end if;
  select p.name into other_name from forma_private.person_documents x join forma_private.crm_people p on p.id=x.person_id where x.cpf=dig and x.person_id<>pid limit 1;
  if found then raise exception 'Ese CPF ya está registrado en la ficha de %. Abre esa ficha en lugar de crear otra.',other_name using errcode='22023';end if;
  insert into forma_private.person_documents(person_id,cpf,updated_by) values(pid,dig,uid) on conflict(person_id) do update set cpf=excluded.cpf,updated_by=excluded.updated_by,updated_at=now();
  return jsonb_build_object('version',1,'saved',true,'masked','***.***.'||substr(dig,7,3)||'-'||substr(dig,10,2));
 end if;

 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'Falta identificador de operación' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into old from forma_private.education_requests where id=rid;
 if found then if old.actor<>uid or old.action<>'enrol_'||p_action or old.payload<>p_data then raise exception 'Operación ya usada con otros datos' using errcode='22023';end if;return old.result||jsonb_build_object('already_saved',true);end if;

 if p_action='note_add' then
  select * into enrol from forma_private.education_enrolments where id=(p_data->>'enrolment_id')::uuid;
  if not found or length(trim(coalesce(p_data->>'note','')))<1 or length(p_data->>'note')>1000 then raise exception 'Revisa la matrícula y la observación (máximo 1000 caracteres)' using errcode='22023';end if;
  insert into forma_private.education_notes(enrolment_id,person_id,author,note) values(enrol.id,enrol.person_id,uid,trim(p_data->>'note'));
  result:=jsonb_build_object('version',1,'saved',true,'enrolment_id',enrol.id);

 elsif p_action='move_group' then
  select * into enrol from forma_private.education_enrolments where id=(p_data->>'enrolment_id')::uuid and version=(p_data->>'expected')::integer for update;
  if not found then raise exception 'La matrícula cambió; actualiza la ficha antes de mover' using errcode='40001';end if;
  if enrol.state='cancelado' then raise exception 'La matrícula está cancelada; reactívala antes de moverla' using errcode='22023';end if;
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Indica el motivo del cambio' using errcode='22023';end if;
  select * into g_new from forma_private.academic_groups where id=(p_data->>'group_id')::uuid and active for update;
  if not found then raise exception 'El grupo de destino no existe o está cancelado' using errcode='22023';end if;
  if enrol.group_id is null then raise exception 'Esta matrícula no tiene grupo; usa Matricular en un grupo' using errcode='22023';end if;
  if enrol.group_id=g_new.id then raise exception 'Ya está en ese grupo' using errcode='22023';end if;
  select * into g_old from forma_private.academic_groups where id=enrol.group_id;
  if g_old.course_id<>g_new.course_id then raise exception 'Solo se puede cambiar entre grupos del mismo curso' using errcode='22023';end if;
  if exists(select 1 from forma_private.education_enrolments where person_id=enrol.person_id and group_id=g_new.id and state<>'cancelado') then raise exception 'La persona ya está matriculada en el grupo de destino' using errcode='23505';end if;
  select count(*) into n from forma_private.education_enrolments where group_id=g_new.id and state<>'cancelado';
  if n>=g_new.capacity then raise exception 'El grupo de destino está completo' using errcode='22023';end if;
  select min(day),max(day) into first_day,last_day from forma_private.academic_sessions where group_id=g_new.id and not cancelled;
  if first_day is null then raise exception 'El grupo de destino no tiene encuentros' using errcode='22023';end if;
  insert into forma_private.academic_history(actor,action,target,snapshot) values(uid,'move_group_before',enrol.id,to_jsonb(enrol)||jsonb_build_object('reason',trim(p_data->>'reason'),'from_group',g_old.name,'to_group',g_new.name,'to_group_id',g_new.id));
  update forma_private.education_enrolments set group_id=g_new.id,starts_on=first_day,ends_on=last_day,version=version+1 where id=enrol.id;
  insert into forma_private.education_notes(enrolment_id,person_id,author,note) values(enrol.id,enrol.person_id,uid,'Cambio de grupo: '||g_old.name||' → '||g_new.name||'. Motivo: '||left(trim(p_data->>'reason'),700));
  select language into lang from forma_private.crm_people where id=enrol.person_id;
  insert into forma_private.education_events(person_id,actor,kind,message) values(enrol.person_id,uid,'schedule',case when lang='pt' then 'Você foi transferido para outro grupo. Consulte seus novos horários.' else 'Te cambiamos de grupo. Revisa tus nuevos horarios.' end);
  result:=jsonb_build_object('version',1,'saved',true,'enrolment_id',enrol.id,'group_id',g_new.id);
 elsif p_action='group_set_active' then
  flag:=(p_data->>'active')::boolean;
  if flag is null then raise exception 'Indica si el grupo se activa o se cancela' using errcode='22023';end if;
  select * into g_new from forma_private.academic_groups where id=(p_data->>'group_id')::uuid and version=(p_data->>'expected')::integer for update;
  if not found then raise exception 'El grupo cambió; actualiza antes de cambiar su estado' using errcode='40001';end if;
  if g_new.active is distinct from flag then
   if flag then
    for sess in select * from forma_private.academic_sessions where group_id=g_new.id and not cancelled and day>=(now() at time zone 'America/Sao_Paulo')::date loop
     if forma_private.academic_conflict(sess.day,sess.start_min,sess.end_min,coalesce(nullif(sess.instructor,''),g_new.instructor),coalesce(nullif(sess.room,''),g_new.room),g_new.id) then
      raise exception 'No se puede reactivar: el % choca con otro grupo (mismo instructor o sala y horario)',to_char(sess.day,'DD/MM') using errcode='23P01';end if;
    end loop;
   end if;
   insert into forma_private.academic_history(actor,action,target,snapshot) values(uid,'group_active_before',g_new.id,to_jsonb(g_new));
   update forma_private.academic_groups set active=flag,version=version+1 where id=g_new.id;
  end if;
  result:=jsonb_build_object('version',1,'saved',true,'group_id',g_new.id,'active',flag);
 else raise exception 'Acción no admitida' using errcode='22023';end if;

 insert into forma_private.education_requests values(rid,uid,'enrol_'||p_action,p_data,result,now());
 return result;
end$$;
revoke all on function forma_private.enrolment_admin(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.enrolment_admin(text,jsonb) to authenticated;
create or replace function public.forma_enrolment_admin(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.enrolment_admin(p_action,p_data)$$;
revoke all on function public.forma_enrolment_admin(text,jsonb) from public,anon;
grant execute on function public.forma_enrolment_admin(text,jsonb) to authenticated;
notify pgrst,'reload schema';
