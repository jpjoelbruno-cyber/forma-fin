-- Transactional academic groups, meetings and enrollment, in independent FORMA.
begin;
create or replace function forma_private.academic_conflict(p_day date,p_start integer,p_end integer,p_instructor text,p_room text,p_group uuid default null) returns boolean language sql set search_path='' as $$
 select exists(select 1 from forma_private.academic_sessions s join forma_private.academic_groups g on g.id=s.group_id where not s.cancelled and g.active and (p_group is null or g.id<>p_group) and s.day=p_day and s.start_min<p_end and p_start<s.end_min and (lower(g.instructor)=lower(p_instructor) or lower(g.room)=lower(p_room)))
 or exists(select 1 from forma_private.agenda_bookings b where not b.cancelled and p_day>=b.start_date and (p_day-b.start_date)%7=0 and (p_day-b.start_date)/7<b.sessions and b.start_hour*60<p_end and p_start<(b.start_hour+b.duration)*60 and (p_instructor=any(b.instructors) or 'Sin asignar'=any(b.instructors) or (b.room<>'' and lower(b.room)=lower(p_room))))
$$;
revoke all on function forma_private.academic_conflict(date,integer,integer,text,text,uuid) from public,anon,authenticated;
create or replace function forma_private.academic_booking_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(7860152026::bigint);
 if not new.cancelled and exists(select 1 from forma_private.academic_sessions s join forma_private.academic_groups g on g.id=s.group_id where not s.cancelled and g.active and s.day>=new.start_date and (s.day-new.start_date)%7=0 and (s.day-new.start_date)/7<new.sessions and s.start_min<(new.start_hour+new.duration)*60 and new.start_hour*60<s.end_min and (g.instructor=any(new.instructors) or 'Sin asignar'=any(new.instructors) or (new.room<>'' and lower(new.room)=lower(g.room)))) then raise exception 'Ocupado por un curso: revisa instructor, sala y horario.' using errcode='23P01';end if;return new;end$$;
revoke all on function forma_private.academic_booking_guard() from public,anon,authenticated;
drop trigger if exists academic_booking_guard on forma_private.agenda_bookings;
create trigger academic_booking_guard before insert or update on forma_private.agenda_bookings for each row execute function forma_private.academic_booking_guard();
create or replace function forma_private.academic(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare who text:=forma_private.agenda_role();uid uuid:=auth.uid();rid uuid;old forma_private.academic_requests;result jsonb;gid uuid;cid uuid;pid uuid;eid uuid;g forma_private.academic_groups;c forma_private.academic_courses;previous_enrol forma_private.education_enrolments;booking forma_private.agenda_bookings;j jsonb;d date;sm integer;em integer;enr jsonb;pay jsonb;paid integer;first_day date;last_day date;student_count integer;matches integer;begin
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
   enr:=forma_private.education('enrol',jsonb_build_object('request_id',rid,'person_id',pid,'course',c.name,'starts_on',first_day,'ends_on',last_day,'fee_cents',g.fee_cents,'monthly_cents',g.monthly_cents,'installments',g.installments,'first_due',p_data->>'first_due','fee_due',p_data->>'fee_due'));eid:=(enr->>'enrolment_id')::uuid;update forma_private.education_enrolments set group_id=gid where id=eid;
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
commit;
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


