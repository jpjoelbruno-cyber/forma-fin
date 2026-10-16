-- FORMA independiente: ampliación de calendario, sin borrar reservas ni historial.
-- Ejecutar después de agenda-setup.sql. No altera finanzas, acceso general ni otros apps.
begin;
do $$begin
 if not exists(select 1 from public.forma_admin_members m join auth.users u on u.id=m.user_id where u.id='776893e1-f940-437c-94a7-40a83bccc013' and lower(u.email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto';end if;
 if to_regprocedure('forma_private.agenda_role()') is null then raise exception 'Falta instalar Agenda René';end if;
end$$;
select pg_advisory_xact_lock(7860152026::bigint);
alter table forma_private.agenda_bookings add column if not exists instructors text[] not null default '{}';
alter table forma_private.agenda_bookings add column if not exists booking_state text not null default 'por_confirmar' check(booking_state in ('reservado','por_confirmar'));
alter table forma_private.agenda_bookings add column if not exists student_reference text not null default '' check(length(student_reference)<=80);
alter table forma_private.agenda_bookings add column if not exists override_conflict boolean not null default false;
alter table forma_private.agenda_bookings add column if not exists override_reason text not null default '';
update forma_private.agenda_bookings set instructors=array[instructor] where cardinality(instructors)=0;
alter table forma_private.agenda_slots add column if not exists instructor text;
alter table forma_private.agenda_slots add column if not exists override_conflict boolean not null default false;
update forma_private.agenda_slots s set instructor=b.instructor from forma_private.agenda_bookings b where s.booking_id=b.id and s.instructor is null;
alter table forma_private.agenda_slots alter column instructor set not null;
alter table forma_private.agenda_slots drop constraint if exists agenda_slots_pkey;
alter table forma_private.agenda_slots add primary key(booking_id,day,hour,instructor);
create unique index if not exists agenda_instructor_no_overlap on forma_private.agenda_slots(day,hour,instructor) where not override_conflict;
create index if not exists agenda_slots_date_instructor on forma_private.agenda_slots(day,instructor);
create or replace function forma_private.agenda_save(p_id uuid,p_expected integer,p_data jsonb,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();old forma_private.agenda_bookings; saved forma_private.agenda_bookings;d date;h int;dur int;n int;i int;j int;k uuid;v_teachers text[];v_primary text;v_state text;v_student text;v_force boolean;v_override text;begin
 if r not in ('owner','manager') then raise exception 'Solo consulta' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or length(trim(coalesce(p_data->>'client','')))=0 or length(p_data->>'client')>160 or length(coalesce(p_data->>'phone',''))>40 or length(coalesce(p_data->>'profession',''))>240 or length(coalesce(p_reason,''))>1000 then raise exception 'Revisa los datos' using errcode='22023';end if;
 if (p_data->>'activity') is null or p_data->>'activity' not in ('Mentoría particular','Asesoría','Agendamiento','Clase grupal','Clase individual','Inmersión','Invitación para podcast','Orientación','Otra actividad','Consulta','Asesoría / agendamiento') or (p_data->>'area') is null or p_data->>'area' not in ('Educación financiera','Estructura empresarial','Bolsa de valores e inversiones','Creación de carteras de inversión','Informática','Inteligencia artificial','Shopee','TikTok Shop','Shein','Mercado Libre','Gestión de cuentas en marketplaces','Contabilidad y CNPJ','Creación de contenido para emprendedores','Podcast','Otra área','Método FORMA','Asesoría / Agendamiento') or (p_data->>'instructor') is null or p_data->>'instructor' not in ('Sin asignar','Joel','René','Luis','Emerson','Miguel') then raise exception 'Selecciona actividad, área e instructor válidos' using errcode='22023';end if;

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
 if (d,h,dur,n) is distinct from (old.start_date,old.start_hour,old.duration,old.sessions) and length(trim(coalesce(p_reason,'')))=0 then raise exception 'Indica el motivo de reprogramación' using errcode='22023';end if;
 end if;
 if not v_force and exists(select 1 from forma_private.agenda_slots s where (p_id is null or s.booking_id<>p_id) and s.day>=d and s.day<=d+7*(n-1) and (s.day-d)%7=0 and s.hour>=h and s.hour<h+dur and (s.instructor=any(v_teachers) or s.instructor='Sin asignar' or 'Sin asignar'=any(v_teachers))) then raise exception 'Hay un horario ocupado en esta serie. No se guardó ningún cambio' using errcode='23P01';end if;
 if p_id is null then
 insert into forma_private.agenda_bookings(client,phone,activity,area,profession,instructor,start_date,start_hour,duration,sessions,created_by,instructors,booking_state,student_reference,override_conflict,override_reason) values(trim(p_data->>'client'),coalesce(p_data->>'phone',''),p_data->>'activity',p_data->>'area',coalesce(p_data->>'profession',''),v_primary,d,h,dur,n,auth.uid(),v_teachers,v_state,v_student,v_force,case when v_force then v_override else '' end) returning * into saved;
 else
 update forma_private.agenda_bookings set client=trim(p_data->>'client'),phone=coalesce(p_data->>'phone',''),activity=p_data->>'activity',area=p_data->>'area',profession=coalesce(p_data->>'profession',''),instructor=v_primary,instructors=v_teachers,booking_state=v_state,student_reference=v_student,override_conflict=v_force,override_reason=case when v_force then v_override else '' end,start_date=d,start_hour=h,duration=dur,sessions=n,version=version+1,updated_at=now() where id=p_id returning * into saved;
 delete from forma_private.agenda_slots where booking_id=p_id;
 end if;
 for i in 0..n-1 loop for j in h..h+dur-1 loop insert into forma_private.agenda_slots(day,hour,booking_id,instructor,override_conflict) select d+7*i,j,saved.id,t,v_force from unnest(v_teachers) t;end loop;end loop;
 insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(saved.id,auth.uid(),case when p_id is null then 'created' else 'updated' end,coalesce(p_reason,'')||case when v_force then ' · Excepción del propietario: '||v_override else '' end,jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(saved)));
 return jsonb_build_object('id',saved.id,'version',saved.version,'saved',true);
end$$;

create or replace function forma_private.agenda_access() returns jsonb language plpgsql security definer set search_path='' as $$begin return jsonb_build_object('version',1,'role',forma_private.agenda_role(),'calendar_version',2);end$$;
create or replace function forma_private.agenda_list(p_from date,p_to date) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();who text;begin
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>370 then raise exception 'Rango inválido' using errcode='22023';end if;
 select instructor into who from forma_private.agenda_staff where user_id=auth.uid();
 return jsonb_build_object('role',r,'calendar_version',2,'bookings',coalesce((select jsonb_agg((to_jsonb(b)-'created_by'-'phone'-'profession'-'student_reference'-'override_reason')||case when r in ('owner','manager') then jsonb_build_object('phone',b.phone,'profession',b.profession,'student_reference',b.student_reference,'override_reason',b.override_reason) else '{}'::jsonb end order by b.start_date,b.start_hour) from forma_private.agenda_bookings b where not b.cancelled and (r in ('owner','manager') or who=any(b.instructors)) and exists(select 1 from forma_private.agenda_slots s where s.booking_id=b.id and s.day between p_from and p_to)),'[]'::jsonb));
end$$;

create index if not exists agenda_history_booking_id on forma_private.agenda_history(booking_id,id desc);
create index if not exists agenda_history_at on forma_private.agenda_history(at desc);
create or replace function forma_private.agenda_history_list(p_from date,p_to date,p_query text,p_before bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();q text:=lower(trim(coalesce(p_query,'')));result jsonb;more boolean;begin
 if r not in ('owner','manager') then raise exception 'Historial restringido' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>370 or length(q)>160 then raise exception 'Rango o búsqueda inválida' using errcode='22023';end if;
 with matching as (select h.id,h.at,h.action,h.reason,h.actor,h.booking_id,b.client,b.phone,b.activity,b.area,b.instructors from forma_private.agenda_history h join forma_private.agenda_bookings b on b.id=h.booking_id where h.at >= (p_from::timestamp at time zone 'America/Sao_Paulo') and h.at < ((p_to+1)::timestamp at time zone 'America/Sao_Paulo') and (p_before is null or h.id<p_before) and (q='' or strpos(lower(b.client||' '||b.phone||' '||b.student_reference||' '||b.activity||' '||b.area||' '||array_to_string(b.instructors,' ')),q)>0 or (length(regexp_replace(q,'[^0-9]','','g'))>=3 and strpos(regexp_replace(b.phone,'[^0-9]','','g'),regexp_replace(q,'[^0-9]','','g'))>0)) order by h.id desc limit 201), page as (select * from matching order by id desc limit 200)
 select coalesce((select jsonb_agg((to_jsonb(p)-'id')||jsonb_build_object('id',p.id::text) order by p.id desc) from page p),'[]'::jsonb),(select count(*)>200 from matching) into result,more;
 return jsonb_build_object('events',result,'has_more',more);
end$$;
create or replace function public.forma_agenda_history_list(p_from date,p_to date,p_query text default '',p_before bigint default null) returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_history_list(p_from,p_to,p_query,p_before)$$;
revoke all on function forma_private.agenda_history_list(date,date,text,bigint),public.forma_agenda_history_list(date,date,text,bigint) from public,anon,authenticated;
grant execute on function forma_private.agenda_history_list(date,date,text,bigint),public.forma_agenda_history_list(date,date,text,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
select 'Calendario por instructor preparado' as resultado,to_regprocedure('public.forma_agenda_history_list(date,date,text,bigint)') is not null as historial_instalado;
