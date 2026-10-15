-- Ejecuta el propietario después de agenda-setup.sql, SOLO en FORMA independiente.
begin;
do $$begin if not exists(select 1 from public.forma_admin_members m join auth.users u on u.id=m.user_id where u.id='776893e1-f940-437c-94a7-40a83bccc013' and lower(u.email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto';end if;end$$;
create table if not exists forma_private.agenda_tasks(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),title text not null check(length(trim(title)) between 1 and 240),due_date date not null,done boolean not null default false,version integer not null default 1,updated_at timestamptz not null default now());
create table if not exists forma_private.agenda_attendance(booking_id uuid not null references forma_private.agenda_bookings(id),day date not null,status text not null check(status in ('realizada','no_asistio','pendiente')),actor uuid not null references auth.users(id),version integer not null default 1,updated_at timestamptz not null default now(),primary key(booking_id,day));
create table if not exists forma_private.agenda_preferences(user_id uuid primary key references auth.users(id),reminder_minutes integer not null default 30 check(reminder_minutes in (15,30,60)),updated_at timestamptz not null default now());
create table if not exists forma_private.agenda_feedback(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),rating text not null check(rating in ('me_ayuda','cambiar','no_me_ayuda')),comment text not null check(length(comment)<=800),created_at timestamptz not null default now());
create index if not exists agenda_tasks_owner_due on forma_private.agenda_tasks(user_id,done,due_date);
create index if not exists agenda_attendance_day on forma_private.agenda_attendance(day);
create index if not exists agenda_feedback_owner_date on forma_private.agenda_feedback(user_id,created_at desc);
alter table forma_private.agenda_tasks enable row level security;alter table forma_private.agenda_attendance enable row level security;alter table forma_private.agenda_preferences enable row level security;alter table forma_private.agenda_feedback enable row level security;
revoke all on forma_private.agenda_tasks,forma_private.agenda_attendance,forma_private.agenda_preferences,forma_private.agenda_feedback from public,anon,authenticated;
create or replace function forma_private.agenda_work(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();uid uuid:=auth.uid();d date:=(now() at time zone 'America/Sao_Paulo')::date;v_id uuid;v_day date;v_status text;v_expected integer;v_version integer;v_minutes integer;v_booking forma_private.agenda_bookings;v_task forma_private.agenda_tasks;
begin
 if r not in ('owner','manager') then raise exception 'Acceso de gestión requerido' using errcode='42501';end if;
 if p_action='state' then return jsonb_build_object('version',1,'server_now',now(),'bookings',forma_private.agenda_list(d-7,d+7)->'bookings',
 'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.done,t.due_date,t.updated_at) from (select * from forma_private.agenda_tasks where user_id=uid or r='owner' order by done,due_date,updated_at limit 300) t),'[]'::jsonb),
 'attendance',coalesce((select jsonb_agg(to_jsonb(a)) from forma_private.agenda_attendance a where day between d-7 and d+7),'[]'::jsonb),
 'reminder_minutes',coalesce((select reminder_minutes from forma_private.agenda_preferences where user_id=uid),30),
 'feedback',coalesce((select jsonb_agg(to_jsonb(f) order by created_at desc) from (select * from forma_private.agenda_feedback where user_id=uid or r='owner' order by created_at desc limit 50) f),'[]'::jsonb));
 elsif p_action='task_add' then
 if length(trim(coalesce(p_data->>'title','')))=0 or length(p_data->>'title')>240 or p_data->>'due_date' is null then raise exception 'Indica tarea y fecha' using errcode='22023';end if;
 insert into forma_private.agenda_tasks(user_id,title,due_date) values(uid,trim(p_data->>'title'),(p_data->>'due_date')::date) returning id into v_id;return jsonb_build_object('saved',true,'id',v_id);
 elsif p_action='task_toggle' then
 v_id:=(p_data->>'id')::uuid;v_expected:=(p_data->>'version')::integer;
 select * into v_task from forma_private.agenda_tasks where id=v_id and user_id=uid for update;
 if not found then raise exception 'Tarea ajena o no disponible' using errcode='42501';end if;
 if v_task.version is distinct from v_expected then raise exception 'La tarea cambió. Actualiza' using errcode='40001';end if;
 update forma_private.agenda_tasks set done=not done,version=version+1,updated_at=now() where id=v_id;return jsonb_build_object('saved',true,'id',v_id);
 elsif p_action='preference' then
 v_minutes:=(p_data->>'minutes')::integer;if v_minutes is null or v_minutes not in (15,30,60) then raise exception 'Aviso inválido' using errcode='22023';end if;
 insert into forma_private.agenda_preferences values(uid,v_minutes,now()) on conflict(user_id) do update set reminder_minutes=excluded.reminder_minutes,updated_at=now();return jsonb_build_object('saved',true);
 elsif p_action='feedback' then
 if p_data->>'rating' is null or p_data->>'rating' not in ('me_ayuda','cambiar','no_me_ayuda') or length(coalesce(p_data->>'comment',''))>800 then raise exception 'Evaluación inválida' using errcode='22023';end if;
 insert into forma_private.agenda_feedback(user_id,rating,comment) values(uid,p_data->>'rating',coalesce(p_data->>'comment','')) returning id into v_id;return jsonb_build_object('saved',true,'id',v_id);
 elsif p_action='attendance' then
 v_id:=(p_data->>'id')::uuid;v_day:=(p_data->>'day')::date;v_status:=p_data->>'status';v_expected:=coalesce((p_data->>'version')::int,0);
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into v_booking from forma_private.agenda_bookings where id=v_id and not cancelled;
 if not found or v_day is null or v_day<v_booking.start_date or v_day>v_booking.start_date+7*(v_booking.sessions-1) or (v_day-v_booking.start_date)%7<>0 then raise exception 'Sesión no disponible' using errcode='22023';end if;
 if v_status is null or v_status not in ('realizada','no_asistio','pendiente') then raise exception 'Estado inválido' using errcode='22023';end if;
 if v_day+(v_booking.start_hour+v_booking.duration)*interval '1 hour'>now() at time zone 'America/Sao_Paulo' then raise exception 'Espera a que termine el horario previsto' using errcode='22023';end if;
 select version into v_version from forma_private.agenda_attendance where booking_id=v_id and day=v_day for update;
 if coalesce(v_version,0)<>v_expected then raise exception 'La asistencia cambió. Actualiza' using errcode='40001';end if;
 insert into forma_private.agenda_attendance(booking_id,day,status,actor) values(v_id,v_day,v_status,uid) on conflict(booking_id,day) do update set status=excluded.status,actor=uid,version=agenda_attendance.version+1,updated_at=now();
 insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(v_id,uid,'attendance','Registro de asistencia',jsonb_build_object('day',v_day,'status',v_status));return jsonb_build_object('saved',true);
 else raise exception 'Acción no disponible' using errcode='22023';end if;
end$$;
create or replace function public.forma_agenda_work(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_work(p_action,p_data)$$;
revoke all on function forma_private.agenda_work(text,jsonb),public.forma_agenda_work(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.agenda_work(text,jsonb),public.forma_agenda_work(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
select 'Asistente de Agenda René preparado' as resultado;
