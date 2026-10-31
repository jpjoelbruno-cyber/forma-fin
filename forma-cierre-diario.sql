-- FORMÁ · Cierre de caja diario (31/10/2026)
-- ADITIVO y reversible: crea una tabla nueva (finance_day_closings) y una función nueva (forma_day_close).
-- No modifica ni borra datos existentes. El cierre mensual ya existente (finance_closings) no se toca.
-- Reversión: drop function public.forma_day_close(text,jsonb); drop function forma_private.day_close(text,jsonb);
--            drop table forma_private.finance_day_closings;
-- Seguridad: solo roles owner/manager; los importes los calcula el servidor (no se confía en el navegador);
--            los cierres son inmutables (una corrección crea una nueva revisión con motivo); RLS activa sin acceso directo.

create table if not exists forma_private.finance_day_closings(
 id uuid primary key,
 day date not null,
 revision integer not null check(revision>0),
 actor uuid not null references auth.users(id),
 note text not null default '' check(length(note)<=500),
 request_data jsonb not null,
 cash_expected_cents bigint not null,
 cash_counted_cents bigint check(cash_counted_cents is null or cash_counted_cents between 0 and 100000000000),
 snapshot jsonb not null,
 created_at timestamptz not null default now(),
 unique(day,revision));
alter table forma_private.finance_day_closings enable row level security;
revoke all on forma_private.finance_day_closings from public,anon,authenticated;
create index if not exists finance_day_closings_day on forma_private.finance_day_closings(day);

create or replace function forma_private.finance_day_closing_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Los cierres se conservan; registra una nueva revisión' using errcode='22023';end$$;
revoke all on function forma_private.finance_day_closing_immutable() from public,anon,authenticated;
drop trigger if exists finance_day_closing_immutable on forma_private.finance_day_closings;
create trigger finance_day_closing_immutable before update or delete on forma_private.finance_day_closings for each row execute function forma_private.finance_day_closing_immutable();

create or replace function forma_private.day_close(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();uid uuid:=auth.uid();today date:=(now() at time zone 'America/Sao_Paulo')::date;
 d date;f date;t date;snap jsonb;rev integer;exp bigint;cnt bigint;rid uuid;note_v text;old forma_private.finance_day_closings;
begin
 if r not in ('owner','manager') then raise exception 'El cierre de caja requiere acceso de gestión' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 if p_action='list' then
  f:=(p_data->>'from')::date;t:=(p_data->>'to')::date;
  if f is null or t is null or t<f or t-f>400 or f<'2020-01-01' then raise exception 'Período inválido' using errcode='22023';end if;
  return jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(x order by x.day desc) from(
   select distinct on(c.day) c.day,c.revision,c.created_at,(c.snapshot->>'received_cents')::bigint received_cents,(c.snapshot->>'outflow_cents')::bigint outflow_cents,c.cash_expected_cents,c.cash_counted_cents,c.note
   from forma_private.finance_day_closings c where c.day between f and t order by c.day,c.revision desc)x),'[]'::jsonb));
 end if;
 if p_action not in ('preview','close') then raise exception 'Acción inválida' using errcode='22023';end if;
 d:=(p_data->>'day')::date;
 if d is null or d<'2020-01-01' or d>today then raise exception 'Día inválido (no puede ser futuro)' using errcode='22023';end if;
 snap:=forma_private.finance_period_data(d,d,'day');
 exp:=coalesce((select (x->>'cents')::bigint from jsonb_array_elements(snap->'by_method') x where x->>'label'='efectivo' limit 1),0)
     -coalesce((select (x->>'cents')::bigint from jsonb_array_elements(snap->'by_outflow_method') x where x->>'label'='efectivo' limit 1),0);
 select coalesce(max(revision),0) into rev from forma_private.finance_day_closings where day=d;
 if p_action='preview' then
  return jsonb_build_object('version',1,'day',d,'latest_revision',rev,'snapshot',snap,'cash_expected_cents',exp,
   'closings',coalesce((select jsonb_agg(jsonb_build_object('revision',c.revision,'created_at',c.created_at,'note',c.note,'cash_counted_cents',c.cash_counted_cents,'cash_expected_cents',c.cash_expected_cents,'snapshot',c.snapshot) order by c.revision desc) from forma_private.finance_day_closings c where c.day=d),'[]'::jsonb));
 end if;
 rid:=(p_data->>'request_id')::uuid;
 if rid is null then raise exception 'Falta identificador de solicitud' using errcode='22023';end if;
 select * into old from forma_private.finance_day_closings where id=rid;
 if found then
  if old.actor<>uid or old.request_data<>p_data then raise exception 'Solicitud ya usada con otros datos' using errcode='22023';end if;
  return jsonb_build_object('version',1,'saved',true,'already_saved',true,'revision',old.revision,'snapshot',old.snapshot,'cash_expected_cents',old.cash_expected_cents,'cash_counted_cents',old.cash_counted_cents,'created_at',old.created_at);
 end if;
 if (p_data->>'expected_revision') is null or (p_data->>'expected_revision')::integer<>rev then raise exception 'Otro cierre fue registrado; actualiza antes de continuar' using errcode='40001';end if;
 note_v:=trim(coalesce(p_data->>'note',''));
 if length(note_v)>500 or (rev>0 and length(note_v)<3) then raise exception 'Indica el motivo de la corrección (mínimo 3 letras)' using errcode='22023';end if;
 if coalesce(p_data->>'cash_counted_cents','')<>'' then
  if (p_data->>'cash_counted_cents')!~'^[0-9]{1,11}$' then raise exception 'Efectivo contado inválido' using errcode='22023';end if;
  cnt:=(p_data->>'cash_counted_cents')::bigint;
 end if;
 insert into forma_private.finance_day_closings(id,day,revision,actor,note,request_data,cash_expected_cents,cash_counted_cents,snapshot) values(rid,d,rev+1,uid,note_v,p_data,exp,cnt,snap);
 insert into forma_private.finance_audit(actor,action,payload) values(uid,'day_close',jsonb_build_object('id',rid,'day',d,'revision',rev+1,'note',note_v));
 return jsonb_build_object('version',1,'saved',true,'revision',rev+1,'snapshot',snap,'cash_expected_cents',exp,'cash_counted_cents',cnt,'created_at',now());
end$$;
create or replace function public.forma_day_close(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.day_close(p_action,p_data)$$;
revoke all on function forma_private.day_close(text,jsonb),public.forma_day_close(text,jsonb) from public,anon;
grant execute on function forma_private.day_close(text,jsonb),public.forma_day_close(text,jsonb) to authenticated;
notify pgrst,'reload schema';
