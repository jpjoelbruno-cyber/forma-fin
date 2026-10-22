-- FORMA independiente: agenda simplificada e ingresos educativos. No borra datos.
-- Reemplaza la actualización anterior del calendario; ejecutar después de agenda-setup.sql.
-- Ejecutar después de agenda-setup.sql. No altera finanzas, acceso general ni otros apps.
begin;
do $$begin
 if not exists(select 1 from public.forma_admin_members m join auth.users u on u.id=m.user_id where u.id='776893e1-f940-437c-94a7-40a83bccc013' and lower(u.email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto';end if;
 if to_regprocedure('forma_private.agenda_role()') is null then raise exception 'Falta instalar Agenda René';end if;
end$$;
select pg_advisory_xact_lock(7860152026::bigint);
alter table forma_private.agenda_bookings add column if not exists room text not null default '' check(length(room)<=120);
alter table forma_private.agenda_bookings add column if not exists group_name text not null default '' check(length(group_name)<=120);
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

create or replace function forma_private.agenda_access() returns jsonb language plpgsql security definer set search_path='' as $$begin return jsonb_build_object('version',1,'role',forma_private.agenda_role(),'calendar_version',4);end$$;
create or replace function forma_private.agenda_list(p_from date,p_to date) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();who text;begin
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>370 then raise exception 'Rango inválido' using errcode='22023';end if;
 select instructor into who from forma_private.agenda_staff where user_id=auth.uid();
 return jsonb_build_object('role',r,'calendar_version',4,'bookings',coalesce((select jsonb_agg((to_jsonb(b)-'created_by'-'phone'-'profession'-'student_reference'-'override_reason')||case when r in ('owner','manager') then jsonb_build_object('phone',b.phone,'profession',b.profession,'student_reference',b.student_reference,'override_reason',b.override_reason) else '{}'::jsonb end order by b.start_date,b.start_hour) from forma_private.agenda_bookings b where not b.cancelled and (r in ('owner','manager') or who=any(b.instructors)) and exists(select 1 from forma_private.agenda_slots s where s.booking_id=b.id and s.day between p_from and p_to)),'[]'::jsonb));
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

-- Educational service ledger only. No student budget, bank account or card data is used.
create table if not exists forma_private.agenda_contracts(
 booking_id uuid primary key references forma_private.agenda_bookings(id),
 total_cents integer not null check(total_cents between 0 and 100000000),
 version integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid not null references auth.users(id));
create table if not exists forma_private.agenda_payments(
 id uuid primary key,booking_id uuid not null references forma_private.agenda_bookings(id),
 amount_cents integer not null check(amount_cents between 1 and 100000000),paid_on date not null,
 method text not null check(method in ('pix','efectivo','tarjeta','transferencia','bitcoin')),
 note text not null default '' check(length(note)<=500),activity text not null,area text not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 voided_at timestamptz,voided_by uuid references auth.users(id),void_reason text not null default '');
alter table forma_private.agenda_contracts enable row level security;
alter table forma_private.agenda_payments enable row level security;
revoke all on forma_private.agenda_contracts,forma_private.agenda_payments from public,anon,authenticated;
create index if not exists agenda_payments_date on forma_private.agenda_payments(paid_on) where voided_at is null;
create index if not exists agenda_payments_booking on forma_private.agenda_payments(booking_id);

alter table forma_private.agenda_contracts add column if not exists payment_plan text not null default 'sin_acuerdo' check(payment_plan in ('sin_acuerdo','presencial','fecha'));
alter table forma_private.agenda_contracts add column if not exists due_on date;
alter table forma_private.agenda_contracts add column if not exists preferred_method text check(preferred_method in ('pix','efectivo','tarjeta','transferencia','bitcoin'));
alter table forma_private.agenda_payments add column if not exists group_name text not null default '' check(length(group_name)<=120);
alter table forma_private.agenda_payments drop constraint if exists agenda_payments_method_check;
alter table forma_private.agenda_payments add constraint agenda_payments_method_check check(method in ('pix','efectivo','tarjeta','transferencia','bitcoin'));

create or replace function forma_private.agenda_catalog() returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();begin
 if r not in ('owner','manager') then raise exception 'Catálogo restringido' using errcode='42501';end if;
 return jsonb_build_object('areas',coalesce((select jsonb_agg(a order by a) from (select distinct area a from forma_private.agenda_bookings) s),'[]'::jsonb));
end$$;
create or replace function public.forma_agenda_catalog() returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_catalog()$$;

create or replace function forma_private.agenda_income(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();b forma_private.agenda_bookings;ct forma_private.agenda_contracts;pay forma_private.agenda_payments;
 bid uuid;pid uuid;amount integer;method_value text;day_value date;note_value text;paid bigint;d date;stop_date date;result jsonb;
begin
 if r not in ('owner','manager') then raise exception 'Ingresos restringidos a propietario y gestor de agenda' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='month' then
  d:=(p_data->>'month')::date;
  if d is null or extract(day from d)<>1 or d<'2020-01-01' or d>'2045-12-01' then raise exception 'Selecciona el mes' using errcode='22023';end if;
  stop_date:=(d+interval '1 month')::date;
  select jsonb_build_object('version',1,'received_cents',coalesce(sum(amount_cents),0),'payment_count',count(*),
   'by_activity',coalesce((select jsonb_agg(to_jsonb(s) order by s.cents desc) from (select activity label,sum(amount_cents) cents,count(*) payments from forma_private.agenda_payments where voided_at is null and paid_on>=d and paid_on<stop_date group by activity)s),'[]'::jsonb),
   'by_group',coalesce((select jsonb_agg(to_jsonb(s) order by s.cents desc) from (select coalesce(nullif(group_name,''),'Sin grupo') label,sum(amount_cents) cents,count(*) payments from forma_private.agenda_payments where voided_at is null and paid_on>=d and paid_on<stop_date group by group_name)s),'[]'::jsonb),
   'by_area',coalesce((select jsonb_agg(to_jsonb(s) order by s.cents desc) from (select area label,sum(amount_cents) cents,count(*) payments from forma_private.agenda_payments where voided_at is null and paid_on>=d and paid_on<stop_date group by area)s),'[]'::jsonb),
   'by_method',coalesce((select jsonb_agg(to_jsonb(s) order by s.cents desc) from (select method label,sum(amount_cents) cents,count(*) payments from forma_private.agenda_payments where voided_at is null and paid_on>=d and paid_on<stop_date group by method)s),'[]'::jsonb),
   'starts_in_month',(select count(*) from forma_private.agenda_bookings where not cancelled and start_date>=d and start_date<stop_date),
   'pending_cents',coalesce((select sum(c.total_cents-coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=c.booking_id and p.voided_at is null),0)) from forma_private.agenda_contracts c),0),
   'unknown_totals',(select count(*) from forma_private.agenda_bookings bb where not bb.cancelled and not exists(select 1 from forma_private.agenda_contracts c where c.booking_id=bb.id)),
   'entries',coalesce((select jsonb_agg(to_jsonb(s) order by s.paid_on desc,s.created_at desc,s.id desc) from (select p.id,p.booking_id,bk.client,p.amount_cents,p.paid_on,p.method,p.activity,p.area,p.group_name,p.note,p.created_at from forma_private.agenda_payments p join forma_private.agenda_bookings bk on bk.id=p.booking_id where p.voided_at is null and p.paid_on>=d and p.paid_on<stop_date order by p.paid_on desc,p.created_at desc,p.id desc limit 200)s),'[]'::jsonb),
   'entries_limited',(select count(*)>200 from forma_private.agenda_payments where voided_at is null and paid_on>=d and paid_on<stop_date),
   'bookings',coalesce((select jsonb_agg(to_jsonb(s) order by s.start_date desc,s.client) from (select bk.id,bk.client,bk.activity,bk.area,bk.group_name,bk.cancelled,bk.start_date,c.total_cents,c.version contract_version,c.payment_plan,c.due_on,c.preferred_method,coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=bk.id and p.voided_at is null),0) paid_cents from forma_private.agenda_bookings bk left join forma_private.agenda_contracts c on c.booking_id=bk.id where (not bk.cancelled and bk.start_date>=d and bk.start_date<stop_date) or (c.total_cents>coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=bk.id and p.voided_at is null),0)) order by bk.start_date desc,bk.client limit 200)s),'[]'::jsonb),
   'bookings_limited',(select count(*)>200 from forma_private.agenda_bookings bk left join forma_private.agenda_contracts c on c.booking_id=bk.id where (not bk.cancelled and bk.start_date>=d and bk.start_date<stop_date) or (c.total_cents>coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=bk.id and p.voided_at is null),0)))) into result
  from forma_private.agenda_payments where voided_at is null and paid_on>=d and paid_on<stop_date;
  return result;
 end if;
 bid:=(p_data->>'booking_id')::uuid;
 if bid is null then raise exception 'Selecciona una reserva guardada' using errcode='22023';end if;
 -- Same lock order as booking edits/cancellation; prevents concurrent overpayments or total changes.
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into b from forma_private.agenda_bookings where id=bid for update;
 if not found then raise exception 'Reserva no disponible' using errcode='22023';end if;
 select * into ct from forma_private.agenda_contracts where booking_id=bid;
 select coalesce(sum(amount_cents),0) into paid from forma_private.agenda_payments where booking_id=bid and voided_at is null;
 if p_action='detail' then
  return jsonb_build_object('version',1,'booking_id',bid,'client',b.client,'cancelled',b.cancelled,'total_cents',ct.total_cents,'contract_version',coalesce(ct.version,0),'paid_cents',paid,'payment_plan',ct.payment_plan,'due_on',ct.due_on,'preferred_method',ct.preferred_method,
   'payments',coalesce((select jsonb_agg(to_jsonb(s) order by s.paid_on desc,s.created_at desc) from (select id,amount_cents,paid_on,method,note,created_at,voided_at,void_reason from forma_private.agenda_payments where booking_id=bid order by paid_on desc,created_at desc limit 500)s),'[]'::jsonb),
   'payments_limited',(select count(*)>500 from forma_private.agenda_payments where booking_id=bid));
 elsif p_action='total' then
  if b.cancelled then raise exception 'La reserva está cancelada' using errcode='22023';end if;
  if coalesce(p_data->>'total_cents','')!~'^[0-9]{1,9}$' then raise exception 'Importe inválido' using errcode='22023';end if;
  amount:=(p_data->>'total_cents')::integer;
  if amount>100000000 or amount<paid then raise exception 'El total no puede ser menor a lo ya recibido' using errcode='22023';end if;
  if coalesce(ct.version,0) is distinct from (p_data->>'expected')::integer then raise exception 'El valor cambió. Actualiza antes de editar' using errcode='40001';end if;
  insert into forma_private.agenda_contracts(booking_id,total_cents,updated_by) values(bid,amount,auth.uid()) on conflict(booking_id) do update set total_cents=excluded.total_cents,version=forma_private.agenda_contracts.version+1,updated_at=now(),updated_by=auth.uid();
  insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(bid,auth.uid(),'agreed_total','Valor total acordado actualizado',jsonb_build_object('before',ct.total_cents,'after',amount));
 elsif p_action='payment' then
  pid:=(p_data->>'id')::uuid;
  if pid is null or coalesce(p_data->>'amount_cents','')!~'^[0-9]{1,9}$' then raise exception 'Pago inválido' using errcode='22023';end if;
  amount:=(p_data->>'amount_cents')::integer;method_value:=p_data->>'method';day_value:=(p_data->>'paid_on')::date;note_value:=trim(coalesce(p_data->>'note',''));
  if amount<1 or amount>100000000 or method_value is null or method_value not in ('pix','efectivo','tarjeta','transferencia','bitcoin') or day_value is null or day_value<'2020-01-01' or day_value>(now() at time zone 'America/Sao_Paulo')::date or length(note_value)>500 then raise exception 'Revisa importe, fecha y medio de pago' using errcode='22023';end if;
  select * into pay from forma_private.agenda_payments where id=pid;
  if found then
   if pay.booking_id<>bid or pay.amount_cents<>amount or pay.method<>method_value or pay.paid_on<>day_value or pay.note<>note_value or pay.created_by<>auth.uid() then raise exception 'Identificador de pago ya utilizado con otros datos' using errcode='22023';end if;
   return jsonb_build_object('saved',true,'id',pay.id,'already_saved',true,'voided',pay.voided_at is not null);
  end if;
  if b.cancelled or ct.booking_id is null or paid+amount>ct.total_cents then raise exception 'Define el total y revisa el saldo de la reserva antes de cobrar' using errcode='22023';end if;
  insert into forma_private.agenda_payments(id,booking_id,amount_cents,paid_on,method,note,activity,area,group_name,created_by) values(pid,bid,amount,day_value,method_value,note_value,b.activity,b.area,b.group_name,auth.uid());
  insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(bid,auth.uid(),'payment','Pago registrado',jsonb_build_object('payment_id',pid,'amount_cents',amount,'method',method_value,'paid_on',day_value,'activity',b.activity,'area',b.area));
 elsif p_action='void' then
  pid:=(p_data->>'id')::uuid;note_value:=trim(coalesce(p_data->>'reason',''));
  if pid is null or length(note_value)=0 or length(note_value)>500 then raise exception 'Indica el motivo de corrección' using errcode='22023';end if;
  select * into pay from forma_private.agenda_payments where id=pid and booking_id=bid for update;
  if not found then raise exception 'Pago no disponible' using errcode='22023';end if;
  if pay.voided_at is not null then return jsonb_build_object('saved',true,'already_voided',true);end if;
  update forma_private.agenda_payments set voided_at=now(),voided_by=auth.uid(),void_reason=note_value where id=pid;
  insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(bid,auth.uid(),'payment_void',note_value,to_jsonb(pay));
 else raise exception 'Acción inválida' using errcode='22023';end if;
 return jsonb_build_object('saved',true);
end$$;
create or replace function public.forma_agenda_income(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_income(p_action,p_data)$$;
revoke all on function forma_private.agenda_catalog(),public.forma_agenda_catalog(),forma_private.agenda_income(text,jsonb),public.forma_agenda_income(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.agenda_catalog(),public.forma_agenda_catalog(),forma_private.agenda_income(text,jsonb),public.forma_agenda_income(text,jsonb) to authenticated;

-- One transaction for a new reservation, its agreed value and initial receipt.
create table if not exists forma_private.agenda_registration_requests(id uuid primary key,actor uuid not null references auth.users(id),payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
alter table forma_private.agenda_registration_requests enable row level security;
revoke all on forma_private.agenda_registration_requests from public,anon,authenticated;
create or replace function forma_private.agenda_register(p_request uuid,p_data jsonb,p_finance jsonb,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();existing forma_private.agenda_registration_requests;kind text;total integer;received integer:=0;bid uuid;result jsonb;payload jsonb;planned text;due date;preferred text;
begin
 if r not in ('owner','manager') then raise exception 'Registro restringido' using errcode='42501';end if;
 if p_request is null or p_finance is null or jsonb_typeof(p_finance)<>'object' then raise exception 'Datos de registro inválidos' using errcode='22023';end if;
 payload:=jsonb_build_object('booking',p_data,'finance',p_finance,'reason',coalesce(p_reason,''));
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into existing from forma_private.agenda_registration_requests where id=p_request;
 if found then
  if existing.actor<>auth.uid() or existing.payload<>payload then raise exception 'Solicitud ya utilizada con otros datos' using errcode='22023';end if;
  return existing.result||jsonb_build_object('already_saved',true);
 end if;
 kind:=p_finance->>'status';
 if kind is null or kind not in ('sin_definir','pendiente','presencial','adelanto','pagado','gratis') then raise exception 'Selecciona la situación de pago' using errcode='22023';end if;
 if kind<>'sin_definir' then
  if coalesce(p_finance->>'total_cents','')!~'^[0-9]{1,9}$' then raise exception 'Indica el valor total' using errcode='22023';end if;
  total:=(p_finance->>'total_cents')::integer;
  if total>100000000 or (kind='gratis' and total<>0) or (kind<>'gratis' and total<=0) then raise exception 'Revisa el valor acordado' using errcode='22023';end if;
  if kind in ('adelanto','pagado') then
   if coalesce(p_finance->>'amount_cents','')!~'^[0-9]{1,9}$' then raise exception 'Indica el importe recibido' using errcode='22023';end if;
   received:=(p_finance->>'amount_cents')::integer;
   if received<=0 or (kind='adelanto' and received>=total) or (kind='pagado' and received<>total) then raise exception 'El importe recibido no coincide con la situación de pago' using errcode='22023';end if;
  elsif coalesce(p_finance->>'amount_cents','0')<>'0' then raise exception 'Un pago pendiente no puede marcar dinero recibido' using errcode='22023';end if;
  planned:=case when kind='presencial' then 'presencial' else coalesce(p_finance->>'payment_plan','sin_acuerdo') end;
  if planned not in ('sin_acuerdo','presencial','fecha') then raise exception 'Acuerdo de pago inválido' using errcode='22023';end if;
  due:=case when planned='fecha' then (p_finance->>'due_on')::date else null end;
  if planned='fecha' and (due is null or due<'2020-01-01' or due>'2045-12-31') then raise exception 'Indica la fecha acordada de pago' using errcode='22023';end if;
  preferred:=nullif(p_finance->>'preferred_method','');
  if preferred is not null and preferred not in ('pix','efectivo','tarjeta','transferencia','bitcoin') then raise exception 'Medio previsto inválido' using errcode='22023';end if;
 end if;
 result:=forma_private.agenda_save(null,null,p_data,p_reason);bid:=(result->>'id')::uuid;
 if kind<>'sin_definir' then
  perform forma_private.agenda_income('total',jsonb_build_object('booking_id',bid,'total_cents',total,'expected',0));
  update forma_private.agenda_contracts set payment_plan=planned,due_on=due,preferred_method=preferred where booking_id=bid;
  if received>0 then
   perform forma_private.agenda_income('payment',jsonb_build_object('id',p_request,'booking_id',bid,'amount_cents',received,'method',p_finance->>'method','paid_on',p_finance->>'paid_on','note',coalesce(p_finance->>'note','')));
  end if;
  insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(bid,auth.uid(),'payment_plan','Situación de pago al registrar',p_finance);
 end if;
 result:=result||jsonb_build_object('finance_saved',kind<>'sin_definir','registration_id',p_request);
 insert into forma_private.agenda_registration_requests(id,actor,payload,result) values(p_request,auth.uid(),payload,result);
 return result;
end$$;
create or replace function public.forma_agenda_register(p_request uuid,p_data jsonb,p_finance jsonb,p_reason text default '') returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_register(p_request,p_data,p_finance,p_reason)$$;
revoke all on function forma_private.agenda_register(uuid,jsonb,jsonb,text),public.forma_agenda_register(uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function forma_private.agenda_register(uuid,jsonb,jsonb,text),public.forma_agenda_register(uuid,jsonb,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
select 'Agenda e ingresos de FORMÁ preparados; registros anteriores conservados' as resultado;
