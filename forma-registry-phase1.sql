-- FORMA · Registro de instructores y colores de curso · FASE 1 (solo aditiva)
-- NO modifica ninguna tabla ni función existente. No toca datos. Reversible con el bloque ROLLBACK de abajo.
-- Ejecutar SOLO en el proyecto FORMA (irsuevjqmgpwunvymxbc), nunca en Eleva.
begin;

create table if not exists forma_private.academic_instructors(
  name text primary key check(length(trim(name)) between 2 and 60),
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into forma_private.academic_instructors(name) values('Joel'),('René'),('Luis'),('Emerson'),('Miguel') on conflict do nothing;

create table if not exists forma_private.academic_course_colors(
  course_id uuid primary key references forma_private.academic_courses(id),
  color text not null check(color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now()
);

alter table forma_private.academic_instructors enable row level security;
alter table forma_private.academic_course_colors enable row level security;
revoke all on forma_private.academic_instructors,forma_private.academic_course_colors from public,anon,authenticated;

create or replace function forma_private.registry(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();v_name text;v_color text;v_course uuid;
begin
 if r not in ('owner','manager') then raise exception 'Solo para gestión' using errcode='42501';end if;
 if p_action='instructors_list' then
  return jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(jsonb_build_object('name',name,'active',active) order by name) from forma_private.academic_instructors),'[]'::jsonb));
 elsif p_action='instructor_save' then
  v_name:=trim(coalesce(p_data->>'name',''));
  if length(v_name) not between 2 and 60 or v_name in ('Sin asignar') then raise exception 'Revisa el nombre del instructor' using errcode='22023';end if;
  insert into forma_private.academic_instructors(name,active,created_by) values(v_name,coalesce((p_data->>'active')::boolean,true),auth.uid())
   on conflict(name) do update set active=coalesce((p_data->>'active')::boolean,true),updated_at=now();
  return jsonb_build_object('saved',true,'name',v_name);
 elsif p_action='colors_list' then
  return jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(jsonb_build_object('course_id',course_id,'color',color)) from forma_private.academic_course_colors),'[]'::jsonb));
 elsif p_action='color_save' then
  v_course:=(p_data->>'course_id')::uuid;v_color:=upper(coalesce(p_data->>'color',''));
  if v_color!~'^#[0-9A-F]{6}$' or not exists(select 1 from forma_private.academic_courses where id=v_course) then raise exception 'Revisa el curso y el color' using errcode='22023';end if;
  insert into forma_private.academic_course_colors(course_id,color) values(v_course,v_color) on conflict(course_id) do update set color=excluded.color,updated_at=now();
  return jsonb_build_object('saved',true);
 end if;
 raise exception 'Acción no válida' using errcode='22023';
end$$;
create or replace function public.forma_registry(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.registry(p_action,p_data)$$;
revoke all on function forma_private.registry(text,jsonb),public.forma_registry(text,jsonb) from public,anon,authenticated;
grant execute on function forma_private.registry(text,jsonb),public.forma_registry(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;

-- ROLLBACK (solo si hiciera falta deshacer esta fase; no afecta datos existentes):
-- drop function if exists public.forma_registry(text,jsonb);
-- drop function if exists forma_private.registry(text,jsonb);
-- drop table if exists forma_private.academic_course_colors;
-- drop table if exists forma_private.academic_instructors;
