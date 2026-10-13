-- SOLO FORMA Personal Independiente / irsuevjqmgpwunvymxbc.
-- Conserva importes existentes. NULL = por estimar; 0 = no hay gasto/entrada.
begin;
do $$begin
 if not exists(select 1 from public.forma_admin_members where user_id='776893e1-f940-437c-94a7-40a83bccc013') or not exists(select 1 from auth.users where id='776893e1-f940-437c-94a7-40a83bccc013' and lower(email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto: usar FORMA independiente';end if;
end$$;
alter table public.forma_budgets alter column planned drop not null;
create table if not exists public.forma_budget_sections(
 user_id uuid not null references auth.users(id) on delete cascade,
 month text not null check(month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 section text not null check(section ~ '^[a-z][a-z_-]{0,39}$'),
 reviewed boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,month,section)
);
alter table public.forma_budget_sections enable row level security;
revoke all on public.forma_budget_sections from public,anon,authenticated;
grant select,insert on public.forma_budget_sections to authenticated;
grant update(reviewed,updated_at) on public.forma_budget_sections to authenticated;
drop policy if exists forma_budget_sections_owner on public.forma_budget_sections;
create policy forma_budget_sections_owner on public.forma_budget_sections to authenticated
 using(user_id=(select auth.uid()) and (select forma_private.access_active()))
 with check(user_id=(select auth.uid()) and (select forma_private.access_active()));
create or replace function public.forma_budget_review_state(p_month text) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not forma_private.access_active() then raise exception 'Acceso FORMA no activo' using errcode='42501';end if;
 if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Mes inválido' using errcode='22023';end if;
 return jsonb_build_object('version',1,'supports_pending',not (select attnotnull from pg_attribute where attrelid='public.forma_budgets'::regclass and attname='planned'),
  'reviewed',coalesce((select jsonb_agg(section order by section) from public.forma_budget_sections where user_id=auth.uid() and month=p_month and reviewed),'[]'::jsonb));
end$$;
create or replace function public.forma_budget_review_mark(p_month text,p_section text,p_reviewed boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not forma_private.access_active() then raise exception 'Acceso FORMA no activo' using errcode='42501';end if;
 if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or p_section is null or p_section !~ '^[a-z][a-z_-]{0,39}$' or p_reviewed is null then raise exception 'Revisión inválida' using errcode='22023';end if;
 insert into public.forma_budget_sections(user_id,month,section,reviewed) values(auth.uid(),p_month,p_section,p_reviewed)
 on conflict(user_id,month,section) do update set reviewed=excluded.reviewed,updated_at=now();
 return jsonb_build_object('section',p_section,'reviewed',p_reviewed);
end$$;
revoke all on function public.forma_budget_review_state(text),public.forma_budget_review_mark(text,text,boolean) from public,anon;
grant execute on function public.forma_budget_review_state(text),public.forma_budget_review_mark(text,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
select not attnotnull as pendientes_habilitados from pg_attribute where attrelid='public.forma_budgets'::regclass and attname='planned';
