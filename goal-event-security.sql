-- FORMÁ independiente: ejecutar manualmente SOLO en irsuevjqmgpwunvymxbc.
-- No borra registros ni modifica otras apps. Operación atómica e idempotente.
begin;
do $$begin
 if not exists(select 1 from public.forma_admin_members where user_id='776893e1-f940-437c-94a7-40a83bccc013') or not exists(select 1 from auth.users where id='776893e1-f940-437c-94a7-40a83bccc013' and lower(email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto: falta administrador FORMA independiente';end if;
end$$;
create or replace function forma_private.check_goal_event() returns trigger language plpgsql security definer set search_path='' as $$
declare g public.forma_goals%rowtype; balance numeric;u uuid:=auth.uid();
begin
 if u is null or new.user_id is distinct from u or not forma_private.access_active() then raise exception 'Acceso FORMA no activo' using errcode='42501';end if;
 -- El mismo bloqueo para cada aporte/retiro; evita dos retiros simultáneos.
 select * into g from public.forma_goals where id=new.goal_id and user_id=u for update;
 if not found then raise exception 'Meta no disponible' using errcode='42501';end if;
 if new.amount is null or new.amount<=0 or new.amount>999999999 or new.amount<>round(new.amount,2) or new.direction is null or new.direction not in ('contribution','withdrawal') or new.source is distinct from 'self_reported' then raise exception 'Movimiento inválido' using errcode='22023';end if;
 select g.saved+coalesce(sum(case when direction='contribution' then amount else -amount end),0) into balance from public.forma_goal_events where goal_id=g.id;
 if new.direction='withdrawal' and new.amount>balance then raise exception 'El retiro supera el saldo de la meta' using errcode='23514';end if;
 return new;
end$$;
revoke all on function forma_private.check_goal_event() from public,anon,authenticated;
drop trigger if exists forma_goal_event_balance on public.forma_goal_events;
create trigger forma_goal_event_balance before insert on public.forma_goal_events for each row execute function forma_private.check_goal_event();
create or replace function forma_private.save_goal_event(p_id uuid,p_goal uuid,p_direction text,p_amount numeric,p_institution text,p_location text,p_date date) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();g uuid;e public.forma_goal_events%rowtype;
begin
 if u is null or not forma_private.access_active() then raise exception 'Acceso FORMA no activo' using errcode='42501';end if;
 if p_id is null or p_date is null or p_date not between date '1900-01-01' and date '2100-12-31' or p_location is null or length(p_location)>120 or p_institution is null or p_institution not in ('nubank','inter','mercadopago','picpay','other') then raise exception 'Datos inválidos' using errcode='22023';end if;
 select id into g from public.forma_goals where id=p_goal and user_id=u for update;
 if g is null then raise exception 'Meta no disponible' using errcode='42501';end if;
 select * into e from public.forma_goal_events where id=p_id;
 if found then
  if e.user_id is distinct from u or e.goal_id is distinct from p_goal or e.direction is distinct from p_direction or e.amount is distinct from p_amount or e.institution_code is distinct from p_institution or e.location_label is distinct from p_location or e.occurred_on is distinct from p_date then raise exception 'Referencia usada con otros datos' using errcode='22023';end if;
  return jsonb_build_object('id',e.id);
 end if;
 insert into public.forma_goal_events(id,user_id,goal_id,direction,amount,institution_code,location_label,occurred_on,source) values(p_id,u,p_goal,p_direction,p_amount,p_institution,p_location,p_date,'self_reported');
 return jsonb_build_object('id',p_id);
end$$;
create or replace function public.forma_save_goal_event(p_id uuid,p_goal uuid,p_direction text,p_amount numeric,p_institution text,p_location text,p_date date) returns jsonb language sql security invoker set search_path='' as $$select forma_private.save_goal_event(p_id,p_goal,p_direction,p_amount,p_institution,p_location,p_date)$$;
revoke all on function forma_private.save_goal_event(uuid,uuid,text,numeric,text,text,date), public.forma_save_goal_event(uuid,uuid,text,numeric,text,text,date) from public,anon;
grant execute on function forma_private.save_goal_event(uuid,uuid,text,numeric,text,text,date), public.forma_save_goal_event(uuid,uuid,text,numeric,text,text,date) to authenticated;
revoke insert on public.forma_goal_events from public,anon,authenticated;
-- Retira permisos por columna también, si existían.
do $$declare c record;begin for c in select attname from pg_attribute where attrelid='public.forma_goal_events'::regclass and attnum>0 and not attisdropped loop execute format('revoke insert (%I) on public.forma_goal_events from public,anon,authenticated',c.attname);end loop;end$$;
-- El saldo inicial queda inmutable después de crear/importar la meta.
revoke update on public.forma_goals from public,anon,authenticated;
do $$declare c record;begin for c in select attname from pg_attribute where attrelid='public.forma_goals'::regclass and attnum>0 and not attisdropped loop execute format('revoke update (%I) on public.forma_goals from public,anon,authenticated',c.attname);end loop;end$$;
grant update(name,target,monthly_plan,deadline,visual,goal_type) on public.forma_goals to authenticated;
revoke execute on function forma_private.admin_report(integer) from public,anon;
notify pgrst,'reload schema';
commit;
