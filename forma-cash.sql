-- FORMA institutional accounts: additive allocation of confirmed transactions.
-- Never reimports receipts or changes reservations. Run only in independent FORMA.
begin;
do $$begin
 if to_regprocedure('forma_private.finance(text,jsonb)') is null then raise exception 'Activar Finanzas v1 primero';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Proyecto incorrecto';end if;
end$$;
create table if not exists forma_private.cash_accounts(id uuid primary key,name text not null check(length(trim(name)) between 2 and 100),opening_on date not null check(opening_on between '2020-01-01' and '2045-12-31'),opening_cents bigint not null check(abs(opening_cents)<=100000000000),actor uuid not null references auth.users(id),created_at timestamptz not null default now());
create table if not exists forma_private.cash_allocations(kind text not null check(kind in ('payment','outflow')),record_id uuid not null,account_id uuid not null references forma_private.cash_accounts(id),settled_on date not null,fee_cents bigint not null default 0 check(fee_cents>=0),card_type text not null default '' check(card_type in ('','credito','debito')),version integer not null default 1,actor uuid not null references auth.users(id),updated_at timestamptz not null default now(),primary key(kind,record_id));
create table if not exists forma_private.cash_payables(id uuid primary key,title text not null check(length(trim(title)) between 2 and 160),category text not null check(length(category) between 1 and 120),amount_cents bigint not null check(amount_cents>0 and amount_cents<=100000000000),due_on date not null check(due_on between '2020-01-01' and '2045-12-31'),status text not null default 'pendiente' check(status in ('pendiente','pagado','cancelado')),outflow_id uuid references forma_private.finance_outflows(id),actor uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table forma_private.cash_payables enable row level security;revoke all on forma_private.cash_payables from public,anon,authenticated;
create index if not exists cash_allocations_account on forma_private.cash_allocations(account_id,settled_on);
create table if not exists forma_private.cash_transfers(id uuid primary key,from_account uuid not null references forma_private.cash_accounts(id),to_account uuid not null references forma_private.cash_accounts(id),amount_cents bigint not null check(amount_cents>0 and amount_cents<=100000000000),paid_on date not null,note text not null check(length(note) between 3 and 300),actor uuid not null references auth.users(id),created_at timestamptz not null default now(),check(from_account<>to_account));
create table if not exists forma_private.cash_reconciliations(id uuid primary key,account_id uuid not null references forma_private.cash_accounts(id),day date not null,observed_cents bigint not null,calculated_cents bigint not null,note text not null check(length(note)<=500),actor uuid not null references auth.users(id),created_at timestamptz not null default now());
create table if not exists forma_private.cash_requests(id uuid primary key,actor uuid not null references auth.users(id),action text not null,payload jsonb not null,result jsonb not null,at timestamptz not null default now());
create table if not exists forma_private.cash_audit(id bigint generated always as identity primary key,actor uuid not null references auth.users(id),action text not null,payload jsonb not null,at timestamptz not null default now());
alter table forma_private.cash_accounts enable row level security;alter table forma_private.cash_allocations enable row level security;alter table forma_private.cash_transfers enable row level security;alter table forma_private.cash_reconciliations enable row level security;alter table forma_private.cash_requests enable row level security;alter table forma_private.cash_audit enable row level security;
revoke all on forma_private.cash_accounts,forma_private.cash_allocations,forma_private.cash_transfers,forma_private.cash_reconciliations,forma_private.cash_requests,forma_private.cash_audit from public,anon,authenticated;
revoke all on sequence forma_private.cash_audit_id_seq from public,anon,authenticated;
-- Live ledger excludes voided originals; a future card settlement is not available cash.
create or replace function forma_private.cash_ledger() returns table(account_id uuid,day date,cents bigint) language sql set search_path='' as $$
 select a.account_id,a.settled_on,p.amount_cents-a.fee_cents from forma_private.cash_allocations a join forma_private.agenda_payments p on a.kind='payment' and p.id=a.record_id where p.voided_at is null
 union all select a.account_id,a.settled_on,-o.amount_cents from forma_private.cash_allocations a join forma_private.finance_outflows o on a.kind='outflow' and o.id=a.record_id where o.voided_at is null
 union all select t.from_account,t.paid_on,-t.amount_cents from forma_private.cash_transfers t
 union all select t.to_account,t.paid_on,t.amount_cents from forma_private.cash_transfers t
$$;
revoke all on function forma_private.cash_ledger() from public,anon,authenticated;
create or replace function forma_private.cash(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();u uuid:=auth.uid();today date:=(now() at time zone 'America/Sao_Paulo')::date;d date;e date;a uuid;b uuid;rid uuid;rec uuid;k text;n bigint;fee bigint;dt date;v integer;ac forma_private.cash_accounts;old forma_private.cash_requests;result jsonb;expected integer;observed bigint;calculated bigint;raw jsonb;bill forma_private.cash_payables;
begin
 if r not in ('owner','manager') or u is null then raise exception 'Acceso de gestión requerido' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'accounts',true,'allocations',true,'reconciliation',true);end if;
 if p_action='payable_alerts' then return jsonb_build_object('version',1,'count',(select count(*) from forma_private.cash_payables where status='pendiente' and due_on<=today),'items',coalesce((select jsonb_agg(x) from(select id,title,amount_cents,due_on from forma_private.cash_payables where status='pendiente' and due_on<=today order by due_on,id limit 101)x),'[]'::jsonb));end if;
 if p_action='report' then
  d:=(p_data->>'from')::date;e:=(p_data->>'to')::date;
  if d is null or e is null or e<d or e-d>366 or d<'2020-01-01' or e>'2045-12-31' then raise exception 'Período inválido' using errcode='22023';end if;
  return jsonb_build_object('version',1,'accounts',coalesce((select jsonb_agg(x) from(select c.*,d>=c.opening_on as covers_start,e>=c.opening_on as covers_end,
   case when d>=c.opening_on then c.opening_cents+coalesce((select sum(l.cents) from forma_private.cash_ledger() l where l.account_id=c.id and l.day>=c.opening_on and l.day<d and l.day<=today),0) end as initial_cents,
   case when e>=c.opening_on then c.opening_cents+coalesce((select sum(l.cents) from forma_private.cash_ledger() l where l.account_id=c.id and l.day>=c.opening_on and l.day<=least(e,today)),0) end as final_cents,
   (select to_jsonb(z) from(select day,observed_cents,calculated_cents,created_at from forma_private.cash_reconciliations where account_id=c.id order by created_at desc,id limit 1)z) as reconciliation
   from forma_private.cash_accounts c order by c.created_at,c.id)x),'[]'::jsonb),
  'payables',coalesce((select jsonb_agg(x) from(select * from forma_private.cash_payables where status='pendiente' and due_on<=e order by due_on,id limit 101)x),'[]'::jsonb),'payable_cents',coalesce((select sum(amount_cents) from forma_private.cash_payables where status='pendiente' and due_on between d and e),0),
  'unassigned_count',(select count(*) from forma_private.agenda_payments p where p.voided_at is null and p.paid_on between coalesce((select min(opening_on) from forma_private.cash_accounts),'2020-01-01') and least(e,today) and not exists(select 1 from forma_private.cash_allocations a where a.kind='payment' and a.record_id=p.id))+(select count(*) from forma_private.finance_outflows o where o.voided_at is null and o.paid_on between coalesce((select min(opening_on) from forma_private.cash_accounts),'2020-01-01') and least(e,today) and not exists(select 1 from forma_private.cash_allocations a where a.kind='outflow' and a.record_id=o.id)),
  'fees_cents',coalesce((select sum(a.fee_cents) from forma_private.cash_allocations a join forma_private.agenda_payments p on a.record_id=p.id and a.kind='payment' where p.voided_at is null and a.settled_on between d and least(e,today)),0),
  'unsettled_cents',coalesce((select sum(p.amount_cents-a.fee_cents) from forma_private.cash_allocations a join forma_private.agenda_payments p on a.record_id=p.id and a.kind='payment' where p.voided_at is null and a.settled_on>today and p.paid_on<=least(e,today)),0),
  'records',coalesce((select jsonb_agg(x) from(select 'payment' kind,p.id,p.amount_cents,p.paid_on,p.method,bk.client label,a.account_id,a.settled_on,a.fee_cents,a.card_type,a.version from forma_private.agenda_payments p join forma_private.agenda_bookings bk on bk.id=p.booking_id left join forma_private.cash_allocations a on a.kind='payment' and a.record_id=p.id where p.voided_at is null and p.paid_on between d and e union all select 'outflow',o.id,o.amount_cents,o.paid_on,o.method,o.category,a.account_id,a.settled_on,a.fee_cents,a.card_type,a.version from forma_private.finance_outflows o left join forma_private.cash_allocations a on a.kind='outflow' and a.record_id=o.id where o.voided_at is null and o.paid_on between d and e order by paid_on desc,id limit 101)x),'[]'::jsonb));
 end if;
 if p_action not in ('account','allocate','transfer','reconcile','payable','payable_pay','payable_cancel') then raise exception 'Acción no disponible' using errcode='22023';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'Falta solicitud' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7860152026::bigint);
 select * into old from forma_private.cash_requests where id=rid;
 if found then if old.actor<>u or old.action<>p_action or old.payload<>p_data then raise exception 'Solicitud usada con otros datos' using errcode='22023';end if;return old.result||jsonb_build_object('already_saved',true);end if;
 a:=nullif(p_data->>'account_id','')::uuid;dt:=nullif(p_data->>'day','')::date;
 if p_action='payable' then
  n:=(p_data->>'amount_cents')::bigint;
  if dt is null or dt<'2020-01-01' or dt>'2045-12-31' or n is null or n<=0 then raise exception 'Revisa importe y vencimiento' using errcode='22023';end if;
  insert into forma_private.cash_payables(id,title,category,amount_cents,due_on,actor) values(rid,trim(p_data->>'title'),trim(p_data->>'category'),n,dt,u);
 elsif p_action='payable_cancel' then
  if length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'Indica el motivo de cancelación' using errcode='22023';end if;
  update forma_private.cash_payables set status='cancelado' where id=(p_data->>'payable_id')::uuid and status='pendiente';if not found then raise exception 'La cuenta ya cambió. Actualiza' using errcode='40001';end if;
 elsif p_action='account' then
  if r<>'owner' then raise exception 'Solo dirección configura saldos iniciales' using errcode='42501';end if;
  n:=(p_data->>'opening_cents')::bigint;
  if length(trim(coalesce(p_data->>'name','')))<2 or length(p_data->>'name')>100 or n is null or abs(n)>100000000000 or dt is null or dt>today or dt<'2020-01-01' then raise exception 'Revisa cuenta, saldo y fecha inicial' using errcode='22023';end if;
  insert into forma_private.cash_accounts(id,name,opening_on,opening_cents,actor) values(rid,trim(p_data->>'name'),dt,n,u);
 else
  select * into ac from forma_private.cash_accounts where id=a;if not found then raise exception 'Selecciona una cuenta' using errcode='22023';end if;
  if dt is null or dt<ac.opening_on or dt>'2045-12-31' then raise exception 'Fecha anterior al saldo inicial o inválida' using errcode='22023';end if;
  if p_action='payable_pay' then
   select * into bill from forma_private.cash_payables where id=(p_data->>'payable_id')::uuid and status='pendiente' for update;
   if not found then raise exception 'La cuenta ya cambió. Actualiza' using errcode='40001';end if;
   if dt>today then raise exception 'Confirma solo una salida ya realizada' using errcode='22023';end if;
   result:=forma_private.finance('expense',jsonb_build_object('request_id',rid,'amount_cents',bill.amount_cents,'paid_on',dt,'method',p_data->>'method','category',bill.category,'reason',bill.title));
   insert into forma_private.cash_allocations(kind,record_id,account_id,settled_on,fee_cents,actor) values('outflow',rid,a,dt,0,u);
   update forma_private.cash_payables set status='pagado',outflow_id=rid where id=bill.id;
  elsif p_action='allocate' then
   k:=p_data->>'kind';rec:=(p_data->>'record_id')::uuid;fee:=coalesce((p_data->>'fee_cents')::bigint,0);
   if k='payment' then select to_jsonb(p) into raw from forma_private.agenda_payments p where id=rec and voided_at is null;
   elsif k='outflow' then select to_jsonb(o) into raw from forma_private.finance_outflows o where id=rec and voided_at is null;else raise exception 'Movimiento inválido' using errcode='22023';end if;
   if raw is null or fee<0 or fee>(raw->>'amount_cents')::bigint or (k='outflow' and (fee<>0 or dt<>(raw->>'paid_on')::date)) or dt<(raw->>'paid_on')::date or (raw->>'method'<>'tarjeta' and (fee<>0 or dt<>(raw->>'paid_on')::date or coalesce(p_data->>'card_type','')<>'')) then raise exception 'Revisa movimiento, fecha y comisión' using errcode='22023';end if;
   select version into v from forma_private.cash_allocations where kind=k and record_id=rec for update;expected:=nullif(p_data->>'expected','')::integer;
   if v is distinct from expected then raise exception 'La asignación cambió. Actualiza' using errcode='40001';end if;
   insert into forma_private.cash_allocations(kind,record_id,account_id,settled_on,fee_cents,card_type,actor) values(k,rec,a,dt,fee,coalesce(p_data->>'card_type',''),u) on conflict(kind,record_id) do update set account_id=excluded.account_id,settled_on=excluded.settled_on,fee_cents=excluded.fee_cents,card_type=excluded.card_type,version=cash_allocations.version+1,actor=u,updated_at=now();
  elsif p_action='transfer' then
   b:=(p_data->>'to_account')::uuid;n:=(p_data->>'amount_cents')::bigint;
   if dt>today or n is null or n<=0 or n>100000000000 or b=a or not exists(select 1 from forma_private.cash_accounts where id=b and opening_on<=dt) or length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'Revisa transferencia' using errcode='22023';end if;
   insert into forma_private.cash_transfers(id,from_account,to_account,amount_cents,paid_on,note,actor) values(rid,a,b,n,dt,trim(p_data->>'note'),u);
  else
   observed:=(p_data->>'observed_cents')::bigint;
   if observed is null or abs(observed)>100000000000 or dt>today then raise exception 'Saldo observado inválido' using errcode='22023';end if;
   select ac.opening_cents+coalesce(sum(cents),0) into calculated from forma_private.cash_ledger() where account_id=a and day between ac.opening_on and dt;
   insert into forma_private.cash_reconciliations(id,account_id,day,observed_cents,calculated_cents,note,actor) values(rid,a,dt,observed,calculated,coalesce(p_data->>'note',''),u);
  end if;
 end if;
 result:=jsonb_build_object('saved',true,'id',rid);
 insert into forma_private.cash_audit(actor,action,payload) values(u,p_action,p_data);insert into forma_private.cash_requests values(rid,u,p_action,p_data,result,now());return result;
end$$;
revoke all on function forma_private.cash(text,jsonb) from public,anon;grant execute on function forma_private.cash(text,jsonb) to authenticated;
create or replace function public.forma_cash(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.cash(p_action,p_data)$$;
revoke all on function public.forma_cash(text,jsonb) from public,anon;grant execute on function public.forma_cash(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
