-- FORMA independiente · Finanzas v1 · conserva cobros/reservas existentes.
begin;
do $$begin
 if to_regprocedure('forma_private.agenda_income(text,jsonb)') is null or to_regprocedure('forma_private.agenda_role()') is null then raise exception 'Falta activar agenda e ingresos';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Proyecto incorrecto: solo FORMA independiente';end if;
end$$;
create table if not exists forma_private.finance_refunds(id uuid primary key,payment_id uuid not null references forma_private.agenda_payments(id),booking_id uuid not null references forma_private.agenda_bookings(id),amount_cents integer not null check(amount_cents between 1 and 100000000),status text not null default 'pendiente' check(status in ('pendiente','devuelto','rechazado')),reason text not null check(length(trim(reason)) between 3 and 500),decision_note text not null default '',created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists forma_private.finance_outflows(id uuid primary key,kind text not null check(kind in ('gasto','reembolso')),refund_id uuid unique references forma_private.finance_refunds(id),booking_id uuid references forma_private.agenda_bookings(id),amount_cents integer not null check(amount_cents between 1 and 100000000),paid_on date not null,method text not null check(method in ('pix','efectivo','tarjeta','transferencia','bitcoin')),category text not null check(length(trim(category)) between 1 and 120),note text not null check(length(trim(note)) between 3 and 500),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),voided_at timestamptz,voided_by uuid references auth.users(id),void_reason text,check((kind='gasto' and refund_id is null and booking_id is null) or (kind='reembolso' and refund_id is not null and booking_id is not null)));
create table if not exists forma_private.finance_waivers(id uuid primary key,booking_id uuid not null references forma_private.agenda_bookings(id),amount_cents integer not null check(amount_cents between 1 and 100000000),reason text not null check(length(trim(reason)) between 3 and 500),created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create table if not exists forma_private.finance_requests(id uuid primary key,actor uuid not null references auth.users(id),action text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
create table if not exists forma_private.finance_audit(id bigint generated always as identity primary key,actor uuid not null references auth.users(id),action text not null,payload jsonb not null,created_at timestamptz not null default now());
create index if not exists finance_refunds_payment on forma_private.finance_refunds(payment_id,status);
create index if not exists finance_refunds_booking on forma_private.finance_refunds(booking_id);
create index if not exists finance_outflows_month on forma_private.finance_outflows(paid_on) where voided_at is null;
create index if not exists finance_waivers_booking on forma_private.finance_waivers(booking_id);
alter table forma_private.finance_refunds enable row level security;alter table forma_private.finance_outflows enable row level security;alter table forma_private.finance_waivers enable row level security;alter table forma_private.finance_requests enable row level security;alter table forma_private.finance_audit enable row level security;
revoke all on forma_private.finance_refunds,forma_private.finance_outflows,forma_private.finance_waivers,forma_private.finance_requests,forma_private.finance_audit from public,anon,authenticated;
revoke all on sequence forma_private.finance_audit_id_seq from public,anon,authenticated;
-- Preserve a refunded receipt even if an older receipt installer is accidentally rerun.
create or replace function forma_private.finance_guard_receipt() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.voided_at is not null and old.voided_at is null and exists(select 1 from forma_private.finance_refunds where payment_id=old.id and status in ('pendiente','devuelto')) then raise exception 'El cobro tiene una devolución y debe conservarse' using errcode='22023';end if;return new;
end$$;
revoke all on function forma_private.finance_guard_receipt() from public,anon,authenticated;
do $$begin if not exists(select 1 from pg_trigger where tgrelid='forma_private.agenda_payments'::regclass and tgname='finance_guard_receipt') then create trigger finance_guard_receipt before update of voided_at on forma_private.agenda_payments for each row execute function forma_private.finance_guard_receipt();end if;end$$;
-- Retain a private copy of the installed receipt logic; original function keeps its OID.
do $$declare src text;begin
 if to_regprocedure('forma_private.agenda_income_v4(text,jsonb)') is null then
  src:=pg_get_functiondef('forma_private.agenda_income(text,jsonb)'::regprocedure);
  execute replace(src,'FUNCTION forma_private.agenda_income(','FUNCTION forma_private.agenda_income_v4(');
 end if;
end$$;
revoke all on function forma_private.agenda_income_v4(text,jsonb) from public,anon,authenticated;
create or replace function forma_private.finance(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();uid uuid:=auth.uid();today date:=(now() at time zone 'America/Sao_Paulo')::date;rid uuid;bid uuid;pid uuid;fid uuid;amount integer;day_value date;method_value text;note_value text;category_value text;d date;stop_date date;paid bigint;waived bigint;reserved bigint;refunded bigint;spent bigint;expenses bigint;expected_total bigint;result jsonb;req forma_private.finance_requests;ref forma_private.finance_refunds;pay forma_private.agenda_payments;booking forma_private.agenda_bookings;outflow forma_private.finance_outflows;contract forma_private.agenda_contracts;
begin
 if r not in ('owner','manager') then raise exception 'Finanzas requiere acceso de gestión' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'outflows',true,'refunds',true,'waivers',true);end if;
 -- Serialize with receipt/booking edits for consistent balances and refund limits.
 perform pg_advisory_xact_lock(7860152026::bigint);
 if p_action='month' then
  d:=(p_data->>'month')::date;if d is null or extract(day from d)<>1 or d<'2020-01-01' or d>'2045-12-01' then raise exception 'Selecciona el mes' using errcode='22023';end if;stop_date:=(d+interval '1 month')::date;
  result:=forma_private.agenda_income_v4('month',p_data);
  select coalesce(sum(amount_cents),0),coalesce(sum(amount_cents) filter(where kind='reembolso'),0),coalesce(sum(amount_cents) filter(where kind='gasto'),0) into spent,refunded,expenses from forma_private.finance_outflows where voided_at is null and paid_on>=d and paid_on<stop_date;
  return result||jsonb_build_object('finance_version',1,'outflow_cents',spent,'refund_cents',refunded,'expense_cents',expenses,'net_cents',(result->>'received_cents')::bigint-spent,
   'pending_cents',coalesce((select sum(greatest(0,c.total_cents-coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=c.booking_id and p.voided_at is null),0)-coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=c.booking_id),0))) from forma_private.agenda_contracts c),0),
   'refund_pending_cents',coalesce((select sum(amount_cents) from forma_private.finance_refunds where status='pendiente'),0),
   'outflows',coalesce((select jsonb_agg(x) from(select o.id,o.kind,o.booking_id,o.amount_cents,o.paid_on,o.method,o.category,o.note from forma_private.finance_outflows o where o.voided_at is null and o.paid_on>=d and o.paid_on<stop_date order by o.paid_on desc,o.created_at desc,o.id limit 101)x),'[]'::jsonb),
   'refunds',coalesce((select jsonb_agg(x) from(select f.id,f.booking_id,f.amount_cents,f.status,f.reason,b.client,f.created_at from forma_private.finance_refunds f join forma_private.agenda_bookings b on b.id=f.booking_id where f.status='pendiente' or exists(select 1 from forma_private.finance_outflows o where o.refund_id=f.id and o.paid_on>=d and o.paid_on<stop_date) order by f.created_at desc,f.id limit 101)x),'[]'::jsonb),
   'bookings',coalesce((select jsonb_agg(x.value||jsonb_build_object('waived_cents',coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=(x.value->>'id')::uuid),0),'pending_cents',case when x.value->>'total_cents' is null then null else greatest(0,(x.value->>'total_cents')::bigint-(x.value->>'paid_cents')::bigint-coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=(x.value->>'id')::uuid),0)) end)) from jsonb_array_elements(result->'bookings')x),'[]'::jsonb));
 elsif p_action='detail' then
  bid:=(p_data->>'booking_id')::uuid;result:=forma_private.agenda_income_v4('detail',p_data);
  select coalesce(sum(amount_cents),0) into refunded from forma_private.finance_outflows where booking_id=bid and kind='reembolso' and voided_at is null;
  select coalesce(sum(amount_cents),0) into waived from forma_private.finance_waivers where booking_id=bid;
  return result||jsonb_build_object('finance_version',1,'refunded_cents',refunded,'waived_cents',waived,'net_received_cents',(result->>'paid_cents')::bigint-refunded,'pending_cents',case when result->>'total_cents' is null then null else greatest(0,(result->>'total_cents')::bigint-(result->>'paid_cents')::bigint-waived) end,
  'refunds',coalesce((select jsonb_agg(x) from(select id,payment_id,amount_cents,status,reason,decision_note from forma_private.finance_refunds where booking_id=bid order by created_at desc,id limit 101)x),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(x.value||jsonb_build_object('refund_reserved_cents',coalesce((select sum(f.amount_cents) from forma_private.finance_refunds f where f.payment_id=(x.value->>'id')::uuid and f.status in ('pendiente','devuelto')),0))) from jsonb_array_elements(result->'payments')x),'[]'::jsonb));
 end if;
 if p_action not in ('expense','expense_void','refund_request','refund_pay','refund_decline','waive') then raise exception 'Acción no disponible' using errcode='22023';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'Falta identificador de solicitud' using errcode='22023';end if;
 select * into req from forma_private.finance_requests where id=rid;
 if found then if req.actor<>uid or req.action<>p_action or req.payload<>p_data then raise exception 'Solicitud ya usada con otros datos' using errcode='22023';end if;return req.result||jsonb_build_object('already_saved',true);end if;
 note_value:=trim(coalesce(p_data->>'reason',''));if length(note_value)<3 or length(note_value)>500 then raise exception 'Indica un motivo de 3 a 500 caracteres' using errcode='22023';end if;
 if p_action in ('expense','refund_request','waive') then
  if coalesce(p_data->>'amount_cents','')!~'^[0-9]{1,9}$' then raise exception 'Importe inválido' using errcode='22023';end if;amount:=(p_data->>'amount_cents')::integer;
  if amount<1 or amount>100000000 then raise exception 'Importe inválido' using errcode='22023';end if;
 end if;
 if p_action in ('expense','refund_pay') then
  day_value:=(p_data->>'paid_on')::date;method_value:=p_data->>'method';
  if day_value is null or day_value<'2020-01-01' or day_value>today or method_value is null or method_value not in ('pix','efectivo','tarjeta','transferencia','bitcoin') then raise exception 'Confirma fecha real y medio de la salida' using errcode='22023';end if;
 end if;
 if p_action='expense' then
  category_value:=trim(coalesce(p_data->>'category',''));if length(category_value)<1 or length(category_value)>120 then raise exception 'Indica categoría del gasto' using errcode='22023';end if;
  insert into forma_private.finance_outflows(id,kind,amount_cents,paid_on,method,category,note,created_by) values(rid,'gasto',amount,day_value,method_value,category_value,note_value,uid);
 elsif p_action='expense_void' then
  fid:=(p_data->>'outflow_id')::uuid;select * into outflow from forma_private.finance_outflows where id=fid for update;
  if not found or outflow.kind<>'gasto' then raise exception 'Solo se corrigen errores de gastos; un reembolso conserva su movimiento' using errcode='22023';end if;
  if outflow.voided_at is null then update forma_private.finance_outflows set voided_at=now(),voided_by=uid,void_reason=note_value where id=fid;end if;
 elsif p_action='refund_request' then
  pid:=(p_data->>'payment_id')::uuid;select * into pay from forma_private.agenda_payments where id=pid for update;
  if not found or pay.voided_at is not null then raise exception 'Selecciona un pago válido' using errcode='22023';end if;bid:=pay.booking_id;
  select coalesce(sum(amount_cents),0) into reserved from forma_private.finance_refunds where payment_id=pid and status in ('pendiente','devuelto');
  if reserved+amount>pay.amount_cents then raise exception 'La devolución supera el importe disponible de este pago' using errcode='22023';end if;
  insert into forma_private.finance_refunds(id,payment_id,booking_id,amount_cents,reason,created_by) values(rid,pid,bid,amount,note_value,uid);
 elsif p_action in ('refund_pay','refund_decline') then
  fid:=(p_data->>'refund_id')::uuid;select * into ref from forma_private.finance_refunds where id=fid for update;
  if not found or ref.status<>'pendiente' then raise exception 'La solicitud ya no está pendiente. Actualiza antes de continuar' using errcode='40001';end if;bid:=ref.booking_id;
  if p_action='refund_pay' then
   select * into pay from forma_private.agenda_payments where id=ref.payment_id for update;
   if pay.voided_at is not null then raise exception 'El cobro original fue corregido; revisa la solicitud' using errcode='22023';end if;
   if day_value<pay.paid_on then raise exception 'La devolución no puede ocurrir antes del cobro original' using errcode='22023';end if;
   insert into forma_private.finance_outflows(id,kind,refund_id,booking_id,amount_cents,paid_on,method,category,note,created_by) values(rid,'reembolso',fid,bid,ref.amount_cents,day_value,method_value,'Reembolsos',note_value,uid);
   update forma_private.finance_refunds set status='devuelto',decision_note=note_value,updated_at=now() where id=fid;
  else update forma_private.finance_refunds set status='rechazado',decision_note=note_value,updated_at=now() where id=fid;end if;
 elsif p_action='waive' then
  bid:=(p_data->>'booking_id')::uuid;select * into booking from forma_private.agenda_bookings where id=bid for update;
  if not found or not booking.cancelled then raise exception 'Solo se ajusta el saldo de una reserva cancelada' using errcode='22023';end if;
  select * into contract from forma_private.agenda_contracts where booking_id=bid;
  select coalesce(sum(amount_cents),0) into paid from forma_private.agenda_payments where booking_id=bid and voided_at is null;
  select coalesce(sum(amount_cents),0) into waived from forma_private.finance_waivers where booking_id=bid;
  if contract.booking_id is null or amount>contract.total_cents-paid-waived then raise exception 'El ajuste supera el saldo pendiente actual' using errcode='22023';end if;
  insert into forma_private.finance_waivers(id,booking_id,amount_cents,reason,created_by) values(rid,bid,amount,note_value,uid);
 end if;
 result:=jsonb_build_object('saved',true,'id',rid,'booking_id',bid);
 insert into forma_private.finance_audit(actor,action,payload) values(uid,p_action,p_data);
 if bid is not null then insert into forma_private.agenda_history(booking_id,actor,action,reason,snapshot) values(bid,uid,p_action,note_value,p_data);end if;
 insert into forma_private.finance_requests(id,actor,action,payload,result) values(rid,uid,p_action,p_data,result);
 return result;
end$$;
create or replace function forma_private.agenda_income(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();bid uuid;pid uuid;paid bigint;waived bigint;ct forma_private.agenda_contracts;
begin
 if r not in ('owner','manager') then raise exception 'Finanzas requiere gestión' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action in ('month','detail') then return forma_private.finance(p_action,p_data);end if;
 perform pg_advisory_xact_lock(7860152026::bigint);bid:=(p_data->>'booking_id')::uuid;
 if p_action='void' and exists(select 1 from forma_private.finance_refunds where payment_id=(p_data->>'id')::uuid and status in ('pendiente','devuelto')) then raise exception 'El pago tiene una devolución. No se puede anular el cobro original' using errcode='22023';end if;
 if p_action in ('payment','total') then
  select * into ct from forma_private.agenda_contracts where booking_id=bid;
  select coalesce(sum(amount_cents),0) into paid from forma_private.agenda_payments where booking_id=bid and voided_at is null;
  select coalesce(sum(amount_cents),0) into waived from forma_private.finance_waivers where booking_id=bid;
  if p_action='payment' and not exists(select 1 from forma_private.agenda_payments where id=(p_data->>'id')::uuid) and paid+waived+(p_data->>'amount_cents')::bigint>ct.total_cents then raise exception 'El pago supera el saldo después de los ajustes' using errcode='22023';end if;
  if p_action='total' and (p_data->>'total_cents')::bigint<paid+waived then raise exception 'El total no puede ser menor a cobros y ajustes ya registrados' using errcode='22023';end if;
 end if;
 return forma_private.agenda_income_v4(p_action,p_data);
end$$;
create or replace function public.forma_finance(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.finance(p_action,p_data)$$;
revoke all on function forma_private.finance(text,jsonb),public.forma_finance(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.finance(text,jsonb),public.forma_finance(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.forma_finance(text,jsonb)') is not null as finanzas_instaladas;
