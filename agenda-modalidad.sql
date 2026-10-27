-- Presencial / Virtual para clases y servicios de la agenda (FORMA Gestión).
-- ADITIVO y REVERSIBLE: crea una tabla y una función nuevas. No modifica ni borra reservas, grupos ni pagos.
-- Ejecutar SOLO en el proyecto FORMA independiente irsuevjqmgpwunvymxbc. NO ejecutar en Eleva.
-- Reversión: drop function public.forma_agenda_modality(text,jsonb); drop table forma_private.agenda_modality;
-- Estado: PREPARADO, NO APLICADO (pendiente de aprobación/ejecución).

create table if not exists forma_private.agenda_modality(
  kind text not null check (kind in ('booking','group')),
  ref_id uuid not null,
  modality text not null default 'presencial' check (modality in ('presencial','virtual')),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (kind, ref_id)
);
alter table forma_private.agenda_modality enable row level security;
revoke all on forma_private.agenda_modality from public, anon, authenticated;

create or replace function public.forma_agenda_modality(p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text := forma_private.agenda_role(); k text; v text; ids uuid[];
begin
  if r not in ('owner','manager','instructor') then raise exception 'Sin acceso' using errcode='42501'; end if;
  if p_action = 'list' then
    select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p_data->'ids','[]'::jsonb)) x;
    if array_length(ids,1) > 500 then raise exception 'Demasiados registros' using errcode='22023'; end if;
    return jsonb_build_object('items', coalesce((select jsonb_object_agg(ref_id::text, modality) from forma_private.agenda_modality where ref_id = any(ids)), '{}'::jsonb));
  elsif p_action = 'set' then
    if r not in ('owner','manager') then raise exception 'Solo consulta' using errcode='42501'; end if;
    k := p_data->>'kind'; v := p_data->>'modality';
    if k not in ('booking','group') or v not in ('presencial','virtual') or (p_data->>'ref_id') is null then raise exception 'Revisa los datos' using errcode='22023'; end if;
    insert into forma_private.agenda_modality(kind, ref_id, modality, updated_by)
      values (k, (p_data->>'ref_id')::uuid, v, auth.uid())
      on conflict (kind, ref_id) do update set modality = excluded.modality, updated_by = auth.uid(), updated_at = now();
    return jsonb_build_object('saved', true);
  end if;
  raise exception 'Acción no disponible' using errcode='22023';
end $$;
revoke all on function public.forma_agenda_modality(text,jsonb) from public, anon;
grant execute on function public.forma_agenda_modality(text,jsonb) to authenticated;
