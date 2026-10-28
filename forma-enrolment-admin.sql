-- FORMÁ · Cambio de grupo y observaciones de matrícula (ADITIVO: no modifica funciones ni tablas existentes).
-- Solo propietario/gerente. Cada cambio guarda el estado anterior en academic_history y deja un aviso al alumno.
-- No toca pagos, recibos ni el calendario de cuotas: el dinero queda en la misma matrícula.
-- Reversible: drop function public.forma_enrolment_admin(text,jsonb); drop function forma_private.enrolment_admin(text,jsonb); drop table forma_private.education_notes;

create table if not exists forma_private.education_notes(
 id uuid primary key default gen_random_uuid(),
 enrolment_id uuid not null references forma_private.education_enrolments(id),
 person_id uuid not null references forma_private.crm_people(id),
 author uuid not null references auth.users(id),
 note text not null check(length(trim(note)) between 1 and 1000),
 created_at timestamptz not null default now());
create index if not exists education_notes_enrolment on forma_private.education_notes(enrolment_id,created_at desc);
alter table forma_private.education_notes enable row level security;
revoke all on forma_private.education_notes from public,anon,authenticated;

create or replace function forma_private.enrolment_admin(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();who text:=forma_private.agenda_role();rid uuid;old forma_private.education_requests;
 enrol forma_private.education_enrolments;g_old forma_private.academic_groups;g_new forma_private.academic_groups;
 first_day date;last_day date;n integer;result jsonb;lang text;
begin
 if who is null or who not in ('owner','manager') then raise exception 'Solo administración de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;

 if p_action='notes_list' then
  return jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(x order by x.created_at desc) from(select id,note,created_at from forma_private.education_notes where enrolment_id=(p_data->>'enrolment_id')::uuid order by created_at desc limit 50)x),'[]'::jsonb));
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
 else raise exception 'Acción no admitida' using errcode='22023';end if;

 insert into forma_private.education_requests values(rid,uid,'enrol_'||p_action,p_data,result,now());
 return result;
end$$;
revoke all on function forma_private.enrolment_admin(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.enrolment_admin(text,jsonb) to authenticated;
create or replace function public.forma_enrolment_admin(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.enrolment_admin(p_action,p_data)$$;
revoke all on function public.forma_enrolment_admin(text,jsonb) from public,anon;
grant execute on function public.forma_enrolment_admin(text,jsonb) to authenticated;
