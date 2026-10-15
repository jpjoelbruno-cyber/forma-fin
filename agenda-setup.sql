-- SOLO FORMA independiente irsuevjqmgpwunvymxbc. Ejecuta el propietario.
begin;
do $$begin
 if not exists(select 1 from public.forma_admin_members m join auth.users u on u.id=m.user_id where u.id='776893e1-f940-437c-94a7-40a83bccc013' and lower(u.email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto: usar FORMA independiente';end if;
end$$;
create table if not exists forma_private.agenda_staff(user_id uuid primary key references auth.users(id),role text not null check(role in ('manager','instructor')),instructor text check(instructor in ('Joel','René','Luis','Emerson','Miguel')),active boolean not null default true,check(role<>'instructor' or instructor is not null));
create table if not exists forma_private.agenda_bookings(
 id uuid primary key default gen_random_uuid(),client text not null,phone text not null default '',activity text not null,area text not null,profession text not null default '',instructor text not null,
 start_date date not null,start_hour integer not null check(start_hour between 13 and 17),duration integer not null check(duration between 1 and 5),sessions integer not null check(sessions between 1 and 52),cancelled boolean not null default false,version integer not null default 1,created_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),check(start_hour+duration<=18));
create table if not exists forma_private.agenda_slots(day date not null,hour integer not null,booking_id uuid not null references forma_private.agenda_bookings(id),primary key(day,hour));
create index if not exists agenda_slots_booking on forma_private.agenda_slots(booking_id);
create table if not exists forma_private.agenda_history(id bigint generated always as identity primary key,booking_id uuid not null references forma_private.agenda_bookings(id),actor uuid not null references auth.users(id),action text not null,reason text not null,at timestamptz not null default now(),snapshot jsonb not null);
alter table forma_private.agenda_staff enable row level security;
alter table forma_private.agenda_bookings enable row level security;
alter table forma_private.agenda_slots enable row level security;
alter table forma_private.agenda_history enable row level security;
revoke all on forma_private.agenda_staff,forma_private.agenda_bookings,forma_private.agenda_slots,forma_private.agenda_history from public,anon,authenticated;
-- Privileged code is private, fixed-search-path, session-checked and has no financial access.
create or replace function forma_private.agenda_role() returns text language plpgsql security definer set search_path='' as $$
declare r text; sid uuid;begin
 if auth.uid() is null then raise exception 'Inicia sesión en FORMA' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'iss','')<>'https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' then raise exception 'Sesión ajena a FORMA' using errcode='42501';end if;
 sid:=(auth.jwt()->>'session_id')::uuid;
 if sid is null or not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=sid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now()) and (u.banned_until is null or u.banned_until<=now())) or not forma_private.access_active() then raise exception 'Sesión FORMA no activa' using errcode='42501';end if;
 if exists(select 1 from public.forma_admin_members where user_id=auth.uid()) then return 'owner';end if;
 select role into r from forma_private.agenda_staff where user_id=auth.uid() and active;
 if r is null then raise exception 'Esta cuenta no tiene acceso a Agenda René' using errcode='42501';end if;return r;
end$$;
create or replace function forma_private.agenda_access() returns jsonb language plpgsql security definer set search_path='' as $$begin return jsonb_build_object('version',1,'role',forma_private.agenda_role());end$$;
create or replace function forma_private.agenda_list(p_from date,p_to date) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();who text;begin
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>370 then raise exception 'Rango inválido' using errcode='22023';end if;
 select instructor into who from forma_private.agenda_staff where user_id=auth.uid();
 return jsonb_build_object('role',r,'bookings',coalesce((select jsonb_agg((to_jsonb(b)-'created_by'-'phone'-'profession')||case when r in ('owner','manager') then jsonb_build_object('phone',b.phone,'profession',b.profession) else '{}'::jsonb end order by b.start_date,b.start_hour) from forma_private.agenda_bookings b where not b.cancelled and (r in ('owner','manager') or b.instructor=who) and exists(select 1 from forma_private.agenda_slots s where s.booking_id=b.id and s.day between p_from and p_to)),'[]'::jsonb));
end$$;
create or replace function forma_private.agenda_save(p_id uuid,p_expected integer,p_data jsonb,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();old forma_private.agenda_bookings; saved forma_private.agenda_bookings;d date;h int;dur int;n int;i int;j int;k uuid;begin
 if r not in ('owner','manager') then raise exception 'Solo consulta' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or length(trim(coalesce(p_data->>'client','')))=0 or length(p_data->>'client')>160 or length(coalesce(p_data->>'phone',''))>40 or length(coalesce(p_data->>'profession',''))>240 or length(coalesce(p_reason,''))>1000 then raise exception 'Revisa los datos' using errcode='22023';end if;
 if (p_data->>'activity') is null or p_data->>'activity' not in ('Mentoría particular','Asesoría / agendamiento','Clase grupal','Inmersión','Otra actividad','Invitación para podcast') or (p_data->>'area') is null or p_data->>'area' not in ('Educación financiera','Estructura empresarial','Bolsa de valores e inversiones','Creación de carteras de inversión','Informática','Inteligencia artificial','Shopee','TikTok Shop','Shein','Mercado Libre','Gestión de cuentas en marketplaces','Contabilidad y CNPJ','Creación de contenido para emprendedores','Podcast','Otra área') or (p_data->>'instructor') is null or p_data->>'instructor' not in ('Sin asignar','Joel','René','Luis','Emerson','Miguel') then raise exception 'Selecciona actividad, área e instructor válidos' using errcode='22023';end if;
 d:=(p_data->>'start_date')::date;h:=(p_data->>'start_hour')::int;dur:=(p_data->>'duration')::int;n:=(p_data->>'sessions')::int;
 if d is null or h is null or dur is null or n is null or extract(isodow from d)>6 or h<13 or h>17 or dur<1 or dur>5 or h+dur>18 or n<1 or n>52 then raise exception 'Horario válido: lunes a sábado, 13:00 a 18:00; 1 a 52 sesiones' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 if p_id is not null then
 select * into old from forma_private.agenda_bookings where id=p_id for update;
 if not found or old.cancelled or p_expected is distinct from old.version then raise exception 'La reserva cambió. Actualiza la agenda antes de editar' using errcode='40001';end if;
 if (d,h,dur,n) is distinct from (old.start_date,old.start_hour,old.duration,old.sessions) and length(trim(coalesce(p_reason,'')))=0 then raise exception 'Indica el motivo de reprogramación' using errcode='22023';end if;
 end if;
 if exists(select 1 from forma_private.agenda_slots s where (p_id is null or s.booking_id<>p_id) and s.day>=d and s.day<=d+7*(n-1) and (s.day-d)%7=0 and s.hour>=h and s.hour<h+dur) then raise exception 'Hay un horario ocupado en esta serie. No se guardó ningún cambio' using errcode='23P01';end if;
 if p_id is null then
 insert into forma_private.agenda_bookings(client,phone,activity,area,profession,instructor,start_date,start_hour,duration,sessions,created_by) values(trim(p_data->>'client'),coalesce(p_data->>'phone',''),p_data->>'activity',p_data->>'area',coalesce(p_data->>'profession',''),p_data->>'instructor',d,h,dur,n,auth.uid()) returning * into saved;
 else
 update forma_private.agenda_bookings set client=trim(p_data->>'client'),phone=coalesce(p_data->>'phone',''),activity=p_data->>'activity',area=p_data->>'area',profession=coalesce(p_data->>'profession',''),instructor=p_data->>'instructor',start_date=d,start_hour=h,duration=dur,sessions=n,version=version+1,updated_at=now() where id=p_id returning * into saved;
 delete from forma_private.agenda_slots where booking_id=p_id;
 end if;
 for i in 0..n-1 loop for j in h..h+dur-1 loop insert into forma_private.agenda_slots values(d+7*i,j,saved.id);end loop;end loop;
 insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(saved.id,auth.uid(),case when p_id is null then 'created' else 'updated' end,coalesce(p_reason,''),jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(saved)));
 return jsonb_build_object('id',saved.id,'version',saved.version,'saved',true);
end$$;
create or replace function forma_private.agenda_cancel(p_id uuid,p_expected integer,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();old forma_private.agenda_bookings;begin
 if r not in ('owner','manager') then raise exception 'Solo consulta' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,'')))=0 or length(p_reason)>1000 then raise exception 'Indica el motivo de cancelación' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into old from forma_private.agenda_bookings where id=p_id for update;
 if not found or old.cancelled or old.version is distinct from p_expected then raise exception 'La reserva cambió. Actualiza la agenda' using errcode='40001';end if;
 update forma_private.agenda_bookings set cancelled=true,version=version+1,updated_at=now() where id=p_id;
 delete from forma_private.agenda_slots where booking_id=p_id;
 insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(p_id,auth.uid(),'cancelled',p_reason,to_jsonb(old));
 return jsonb_build_object('id',p_id,'cancelled',true);
end$$;
create or replace function forma_private.agenda_audit(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin if forma_private.agenda_role() not in ('owner','manager') then raise exception 'Acceso restringido' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('action',action,'reason',reason,'at',at,'actor',actor) order by at desc,id desc) from forma_private.agenda_history where booking_id=p_id),'[]'::jsonb);end$$;
-- Public functions only delegate; private functions independently authorize every operation.
create or replace function public.forma_agenda_access() returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_access()$$;
create or replace function public.forma_agenda_list(p_from date,p_to date) returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_list(p_from,p_to)$$;
create or replace function public.forma_agenda_save(p_id uuid,p_expected integer,p_data jsonb,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_save(p_id,p_expected,p_data,p_reason)$$;
create or replace function public.forma_agenda_cancel(p_id uuid,p_expected integer,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_cancel(p_id,p_expected,p_reason)$$;
create or replace function public.forma_agenda_audit(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select forma_private.agenda_audit(p_id)$$;
revoke all on function forma_private.agenda_role(),forma_private.agenda_access(),forma_private.agenda_list(date,date),forma_private.agenda_save(uuid,integer,jsonb,text),forma_private.agenda_cancel(uuid,integer,text),forma_private.agenda_audit(uuid),public.forma_agenda_access(),public.forma_agenda_list(date,date),public.forma_agenda_save(uuid,integer,jsonb,text),public.forma_agenda_cancel(uuid,integer,text),public.forma_agenda_audit(uuid) from public,anon,authenticated;
grant usage on schema forma_private to authenticated;
grant execute on function forma_private.agenda_access(),forma_private.agenda_list(date,date),forma_private.agenda_save(uuid,integer,jsonb,text),forma_private.agenda_cancel(uuid,integer,text),forma_private.agenda_audit(uuid),public.forma_agenda_access(),public.forma_agenda_list(date,date),public.forma_agenda_save(uuid,integer,jsonb,text),public.forma_agenda_cancel(uuid,integer,text),public.forma_agenda_audit(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
select 'Agenda René instalada; falta autorizar el correo exacto de René' as resultado;
