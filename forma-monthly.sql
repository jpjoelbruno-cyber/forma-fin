-- FORMA monthly summary: read-only RPC. Does not alter existing data.
begin;
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
