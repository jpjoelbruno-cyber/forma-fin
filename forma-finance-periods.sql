-- FORMA independiente · informes por período y cierres versionados.
-- No modifica ni elimina reservas, contratos, pagos o movimientos existentes.
begin;
do $$begin
 if to_regprocedure('forma_private.finance(text,jsonb)') is null then raise exception 'Primero activar Finanzas v1';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Proyecto incorrecto: usar solo FORMA independiente';end if;
end$$;
create table if not exists forma_private.finance_closings(
 id uuid primary key,month date not null check(extract(day from month)=1),revision integer not null check(revision>0),
 actor uuid not null references auth.users(id),reason text not null check(length(reason)<=500),request_data jsonb not null,
 snapshot jsonb not null,created_at timestamptz not null default now(),unique(month,revision));
alter table forma_private.finance_closings enable row level security;
revoke all on forma_private.finance_closings from public,anon,authenticated;
create or replace function forma_private.finance_closing_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Los cierres se conservan; registra una nueva revisión' using errcode='22023';end$$;
revoke all on function forma_private.finance_closing_immutable() from public,anon,authenticated;
drop trigger if exists finance_closing_immutable on forma_private.finance_closings;
create trigger finance_closing_immutable before update or delete on forma_private.finance_closings for each row execute function forma_private.finance_closing_immutable();
-- Internal helper has no direct API grant. Reports are exact even when row lists are capped.
create or replace function forma_private.finance_period_data(d date,e date,bucket text) returns jsonb language sql set search_path='' as $$
 with payments as materialized(select p.*,b.client from forma_private.agenda_payments p join forma_private.agenda_bookings b on b.id=p.booking_id where p.voided_at is null and p.paid_on between d and e),
 outs as materialized(select * from forma_private.finance_outflows where voided_at is null and paid_on between d and e),
 combined as(select 'by_activity' k,activity label,amount_cents from payments union all select 'by_area',area,amount_cents from payments union all select 'by_group',coalesce(nullif(group_name,''),'Sin grupo'),amount_cents from payments union all select 'by_method',method,amount_cents from payments),
 grouped as(select k,label,sum(amount_cents) cents from combined group by k,label),
 breakdown as(select k,jsonb_agg(jsonb_build_object('label',label,'cents',cents) order by cents desc,label) data from grouped group by k),
 days as(select s::date as day from generate_series(d::timestamp,e::timestamp,case when bucket='month' then interval '1 month' else interval '1 day' end)s),
 bookings as(select b.id,b.client,b.activity,b.area,b.group_name,b.cancelled,b.start_date,c.total_cents,c.payment_plan,c.due_on,c.preferred_method,
 coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=b.id and p.voided_at is null),0) paid_cents,
 coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=b.id),0) waived_cents
 from forma_private.agenda_bookings b left join forma_private.agenda_contracts c on c.booking_id=b.id where b.start_date between d and e)
 select jsonb_build_object('version',1,'finance_version',1,'report_version',1,'period_from',d,'period_to',e,'as_of',now(),
 'received_cents',coalesce((select sum(amount_cents) from payments),0),'payment_count',(select count(*) from payments),
 'outflow_cents',coalesce((select sum(amount_cents) from outs),0),'expense_cents',coalesce((select sum(amount_cents) from outs where kind='gasto'),0),'refund_cents',coalesce((select sum(amount_cents) from outs where kind='reembolso'),0),
 'by_activity',coalesce((select data from breakdown where k='by_activity'),'[]'::jsonb),'by_area',coalesce((select data from breakdown where k='by_area'),'[]'::jsonb),'by_group',coalesce((select data from breakdown where k='by_group'),'[]'::jsonb),'by_method',coalesce((select data from breakdown where k='by_method'),'[]'::jsonb),
 'by_outflow_category',coalesce((select jsonb_agg(x order by cents desc) from(select category label,sum(amount_cents) cents from outs group by category)x),'[]'::jsonb),
 'by_outflow_method',coalesce((select jsonb_agg(x order by cents desc) from(select method label,sum(amount_cents) cents from outs group by method)x),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(x order by paid_on desc,created_at desc,id) from(select id,booking_id,client,amount_cents,paid_on,method,activity,area,group_name,note,created_at from payments order by paid_on desc,created_at desc,id limit 200)x),'[]'::jsonb),'entries_limited',(select count(*)>200 from payments),
 'outflows',coalesce((select jsonb_agg(x order by paid_on desc,created_at desc,id) from(select id,kind,booking_id,amount_cents,paid_on,method,category,note,created_at from outs order by paid_on desc,created_at desc,id limit 101)x),'[]'::jsonb),'outflows_limited',(select count(*)>100 from outs),
 'bookings',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('pending_cents',case when total_cents is null then null else greatest(0,total_cents-paid_cents-waived_cents) end)) from(select * from bookings order by start_date desc,client,id limit 200)x),'[]'::jsonb),'bookings_limited',(select count(*)>200 from bookings),
 'refunds',coalesce((select jsonb_agg(x) from(select f.id,f.booking_id,f.amount_cents,f.status,f.reason,f.created_at,b.client from forma_private.finance_refunds f join forma_private.agenda_bookings b on b.id=f.booking_id where exists(select 1 from outs o where o.refund_id=f.id) order by f.created_at desc,f.id limit 101)x),'[]'::jsonb),
 'timeline',coalesce((select jsonb_agg(jsonb_build_object('day',day,'incoming',case when day>(now() at time zone 'America/Sao_Paulo')::date then null else coalesce((select sum(amount_cents) from payments p where (case when bucket='month' then date_trunc('month',p.paid_on)::date else p.paid_on end)=day),0) end,'outgoing',case when day>(now() at time zone 'America/Sao_Paulo')::date then null else coalesce((select sum(amount_cents) from outs o where (case when bucket='month' then date_trunc('month',o.paid_on)::date else o.paid_on end)=day),0) end) order by day) from days),'[]'::jsonb))
$$;
revoke all on function forma_private.finance_period_data(date,date,text) from public,anon,authenticated;
create or replace function forma_private.finance_reports(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();uid uuid:=auth.uid();today date:=(now() at time zone 'America/Sao_Paulo')::date;d date;e date;bucket text;skip integer;q text;result jsonb;rid uuid;revision_value integer;reason_value text;old forma_private.finance_closings;
begin
 if r not in ('owner','manager') then raise exception 'Informes requiere gestión de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'periods',true,'closings',true);end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 if p_action='pending' then
  skip:=coalesce((p_data->>'offset')::integer,0);q:=lower(trim(coalesce(p_data->>'query','')));
  if skip<0 or skip>1000000 or length(q)>160 then raise exception 'Consulta inválida' using errcode='22023';end if;
  with amounts as materialized(select b.id,b.client,b.phone,b.activity,b.area,b.group_name,b.cancelled,b.start_date,c.total_cents,c.payment_plan,c.due_on,c.preferred_method,
   coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=b.id and p.voided_at is null),0) paid_cents,
   coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=b.id),0) waived_cents from forma_private.agenda_bookings b join forma_private.agenda_contracts c on c.booking_id=b.id),
  debts as materialized(select *,greatest(0,total_cents-paid_cents-waived_cents) pending_cents from amounts where total_cents-paid_cents-waived_cents>0),
  matching as materialized(select * from debts where q='' or strpos(lower(client||' '||phone||' '||area||' '||activity),q)>0),
  page as(select * from matching order by due_on nulls last,client,id limit 30 offset skip)
  select jsonb_build_object('version',1,'as_of',now(),'today',today,'total_cents',coalesce((select sum(pending_cents) from debts),0),'total_count',(select count(*) from debts),'filtered_count',(select count(*) from matching),'offset',skip,'has_more',(select count(*) from matching)>skip+30,'items',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('due_status',case when due_on is null then 'Sin fecha' when due_on<today then 'Vencido' when due_on=today then 'Vence hoy' else 'Próximo' end)) from page),'[]'::jsonb)) into result;
  return result;
 end if;
 if p_action='period' then d:=(p_data->>'from')::date;e:=(p_data->>'to')::date;bucket:=coalesce(p_data->>'bucket','day');
 elsif p_action in ('closing_preview','closing_get','close') then d:=(p_data->>'month')::date;e:=(d+interval '1 month'-interval '1 day')::date;bucket:='day';
 else raise exception 'Acción inválida' using errcode='22023';end if;
 if d is null or e is null or d<'2020-01-01' or e>'2045-12-31' or e<d or e-d>366 or bucket not in ('day','month') or (bucket='month' and extract(day from d)<>1) or (p_action<>'period' and extract(day from d)<>1) then raise exception 'Período inválido' using errcode='22023';end if;
 if p_action='period' then return forma_private.finance_period_data(d,e,bucket);end if;
 if p_action='closing_get' then
  select * into old from forma_private.finance_closings where month=d and revision=(p_data->>'revision')::integer;
  if not found then raise exception 'Cierre no encontrado' using errcode='22023';end if;
  return jsonb_build_object('version',1,'id',old.id,'month',old.month,'revision',old.revision,'created_at',old.created_at,'snapshot',old.snapshot,'reason',old.reason);
 end if;
 if p_action='closing_preview' then
  select coalesce(max(revision),0) into revision_value from forma_private.finance_closings where month=d;
  return jsonb_build_object('version',1,'month',d,'can_close',e<today,'latest_revision',revision_value,'snapshot',forma_private.finance_period_data(d,e,'day'),'history',coalesce((select jsonb_agg(jsonb_build_object('revision',revision,'created_at',created_at,'reason',reason) order by revision desc) from forma_private.finance_closings where month=d),'[]'::jsonb));
 end if;
 rid:=(p_data->>'request_id')::uuid;reason_value:=trim(coalesce(p_data->>'reason',''));
 if rid is null then raise exception 'Falta identificador' using errcode='22023';end if;
 select * into old from forma_private.finance_closings where id=rid;
 if found then
  if old.actor<>uid or old.request_data<>p_data then raise exception 'Solicitud ya usada con otros datos' using errcode='22023';end if;
  return jsonb_build_object('version',1,'saved',true,'already_saved',true,'revision',old.revision,'snapshot',old.snapshot);
 end if;
 if e>=today then raise exception 'El mes no terminó; exporta un borrador' using errcode='22023';end if;
 select coalesce(max(revision),0) into revision_value from forma_private.finance_closings where month=d;
 if (p_data->>'expected_revision') is null or (p_data->>'expected_revision')::integer<>revision_value then raise exception 'Otro cierre fue registrado; actualiza antes de continuar' using errcode='40001';end if;
 if length(reason_value)>500 or (revision_value>0 and length(reason_value)<3) then raise exception 'Indica el motivo de la nueva revisión' using errcode='22023';end if;
 result:=forma_private.finance_period_data(d,e,'day');
 insert into forma_private.finance_closings(id,month,revision,actor,reason,request_data,snapshot) values(rid,d,revision_value+1,uid,reason_value,p_data,result);
 insert into forma_private.finance_audit(actor,action,payload) values(uid,'closing',jsonb_build_object('id',rid,'month',d,'revision',revision_value+1,'reason',reason_value));
 return jsonb_build_object('version',1,'saved',true,'revision',revision_value+1,'snapshot',result);
end$$;
create or replace function public.forma_finance_reports(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.finance_reports(p_action,p_data)$$;
revoke all on function forma_private.finance_reports(text,jsonb),public.forma_finance_reports(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.finance_reports(text,jsonb),public.forma_finance_reports(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.forma_finance_reports(text,jsonb)') is not null as informes_y_cierres_instalados;
