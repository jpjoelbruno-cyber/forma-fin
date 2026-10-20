-- Solo FORMA Personal Independiente / irsuevjqmgpwunvymxbc.
-- Instalador aditivo: no modifica reservas, caja, personas ni presupuestos.
begin;
do $$begin
 if not exists(select 1 from public.forma_admin_members m join auth.users u on u.id=m.user_id where u.id='776893e1-f940-437c-94a7-40a83bccc013' and lower(u.email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto: usar FORMA independiente';end if;
 if to_regprocedure('public.forma_agenda_access()') is null then raise exception 'Falta la validación de sesión de FORMA';end if;
end$$;
create table if not exists forma_private.bank_pilot_links(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 mode text not null check(mode in ('sandbox','live')),state text not null default 'pending' check(state in ('pending','connected','revoked')),
 consent_version text not null check(consent_version='owner-readonly-v1'),consented_at timestamptz not null default now(),
 vault text,connector_id integer,created_at timestamptz not null default now(),revoked_at timestamptz,
 check(vault is null or length(vault) between 32 and 4096));
create unique index if not exists bank_pilot_one_active on forma_private.bank_pilot_links(user_id) where state<>'revoked';
create table if not exists forma_private.bank_pilot_limits(user_id uuid not null references auth.users(id),day date not null,starts integer not null default 0,reads integer not null default 0,primary key(user_id,day));
alter table forma_private.bank_pilot_links enable row level security;
alter table forma_private.bank_pilot_limits enable row level security;
revoke all on forma_private.bank_pilot_links,forma_private.bank_pilot_limits from public,anon,authenticated;
create or replace function forma_private.bank_pilot(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();r forma_private.bank_pilot_links;headers jsonb;d date:=(now() at time zone 'America/Sao_Paulo')::date;n int;
begin
 if uid is distinct from '776893e1-f940-437c-94a7-40a83bccc013'::uuid or forma_private.agenda_role()<>'owner' then raise exception 'Piloto exclusivo de dirección' using errcode='42501';end if;
 headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
 if headers->>'origin' is distinct from 'https://forma-fin.vercel.app' then raise exception 'Origen FORMA requerido' using errcode='42501';end if;
 if p_action='capabilities' then return jsonb_build_object('version',1,'readonly',true);end if;
 perform pg_advisory_xact_lock(891020261::bigint);
 select * into r from forma_private.bank_pilot_links where user_id=uid and state<>'revoked' for update;
 if p_action='state' then return jsonb_build_object('link',case when r.id is null then null else to_jsonb(r) end);end if;
 if p_action in ('begin','read') then
  insert into forma_private.bank_pilot_limits(user_id,day) values(uid,d) on conflict do nothing;
  if p_action='read' then
   update forma_private.bank_pilot_limits set reads=reads+1 where user_id=uid and day=d and reads<60;
   get diagnostics n=row_count;if n<>1 then raise exception 'Límite diario de consultas del piloto alcanzado' using errcode='54000';end if;
   return jsonb_build_object('allowed',true);
  end if;
  if p_data->>'mode' is null or p_data->>'mode' not in ('sandbox','live') or p_data->>'consent_version' is distinct from 'owner-readonly-v1' or p_data->'consent' is distinct from 'true'::jsonb then raise exception 'Consentimiento requerido' using errcode='22023';end if;
  if r.id is not null and (r.state<>'pending' or r.mode<>p_data->>'mode') then raise exception 'Desconecta la prueba actual antes de iniciar otra' using errcode='40001';end if;
  update forma_private.bank_pilot_limits set starts=starts+1 where user_id=uid and day=d and starts<6;
  get diagnostics n=row_count;if n<>1 then raise exception 'Límite diario de intentos del piloto alcanzado' using errcode='54000';end if;
  if r.id is null then insert into forma_private.bank_pilot_links(user_id,mode,consent_version) values(uid,p_data->>'mode','owner-readonly-v1') returning * into r;end if;
  return jsonb_build_object('link',to_jsonb(r));
 end if;
 if r.id is null or r.id is distinct from (p_data->>'id')::uuid then raise exception 'Prueba no encontrada o modificada' using errcode='40001';end if;
 if p_action='bind' then
  if r.state='connected' then return jsonb_build_object('saved',true);end if;
  if p_data->>'vault' is null or length(p_data->>'vault') not between 32 and 4096 or p_data->>'vault' !~ '^[A-Za-z0-9_-]+$' or (p_data->>'connector_id')::int is null or (p_data->>'connector_id')::int<=0 then raise exception 'Referencia inválida' using errcode='22023';end if;
  update forma_private.bank_pilot_links set state='connected',vault=p_data->>'vault',connector_id=(p_data->>'connector_id')::int where id=r.id;
  return jsonb_build_object('saved',true);
 end if;
 if p_action='revoke' then
  update forma_private.bank_pilot_links set state='revoked',vault=null,revoked_at=now() where id=r.id;
  return jsonb_build_object('revoked',true);
 end if;
 raise exception 'Acción no permitida' using errcode='22023';
end$$;
create or replace function public.forma_bank_pilot(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.bank_pilot(p_action,p_data)$$;
revoke all on function forma_private.bank_pilot(text,jsonb),public.forma_bank_pilot(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.bank_pilot(text,jsonb),public.forma_bank_pilot(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.forma_bank_pilot(text,jsonb)') is not null as piloto_bancario_instalado;
