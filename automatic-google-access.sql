-- MODALIDAD ANTERIOR: solo Google. Para Google Y correo usa automatic-account-access.sql.
-- FORMÁ independiente: acceso automático de alumno al iniciar sesión con Google.
-- Ejecutar SOLO en FORMA Personal Independiente / irsuevjqmgpwunvymxbc.
-- No aprueba cuentas en bloque, no crea administradores y no modifica finanzas.
begin;
do $$begin
 if not exists(select 1 from public.forma_admin_members where user_id='776893e1-f940-437c-94a7-40a83bccc013') or not exists(select 1 from auth.users where id='776893e1-f940-437c-94a7-40a83bccc013' and lower(email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto: falta administrador de FORMA independiente';end if;
end$$;
create or replace function forma_private.access_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();sid uuid;v_status text;v_reason text;v_name text;v_google boolean;v_admin boolean;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or auth.jwt()->>'iss' is distinct from 'https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' then
  raise exception 'Autenticación permanente de FORMA requerida' using errcode='42501';
 end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when invalid_text_representation then sid:=null;end;
 if sid is null or not exists(select 1 from auth.sessions s where s.id=sid and s.user_id=uid and (s.not_after is null or s.not_after>now())) then
  raise exception 'Sesión activa de FORMA requerida' using errcode='42501';
 end if;
 select left(coalesce(u.raw_user_meta_data->>'full_name',split_part(u.email,'@',1),''),120),
  u.email_confirmed_at is not null and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google')
  and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt()->'amr')='array' then auth.jwt()->'amr' else '[]'::jsonb end) m where m->>'method'='oauth')
 into v_name,v_google from auth.users u where u.id=uid and (u.banned_until is null or u.banned_until<=now());
 if not found then raise exception 'Cuenta no disponible' using errcode='42501';end if;
 -- user_metadata solo se usa como nombre visible; nunca autoriza acceso ni roles.
 insert into forma_private.app_access(user_id,status,display_name,reason,requested_at)
 values(uid,'pending_validation',v_name,'explicit_access_request',now())
 on conflict(user_id) do update set requested_at=now(),display_name=excluded.display_name
 where app_access.status='pending_validation';
 select status,reason into v_status,v_reason from forma_private.app_access where user_id=uid for update;
 v_admin:=exists(select 1 from public.forma_admin_members where user_id=uid);
 if v_admin then
  update forma_private.app_access set status='active',reason='existing_admin',updated_at=now() where user_id=uid;
 elsif v_google and v_status='pending_validation' and v_reason in ('explicit_access_request','initial_evidence_review') then
  -- Solo el usuario de ESTA sesión se activa. Una restricción manual no se levanta.
  update forma_private.app_access set status='active',reason='automatic_verified_google',updated_at=now() where user_id=uid;
  insert into forma_private.app_access_audit(user_id,actor_id,previous_status,new_status) values(uid,uid,v_status,'active');
 end if;
 select status into v_status from forma_private.app_access where user_id=uid;
 return jsonb_build_object('status',v_status,'reference',uid);
end$$;
revoke all on function forma_private.access_status() from public,anon;
grant execute on function forma_private.access_status() to authenticated;
-- La API existente sigue ligada al usuario actual; no acepta user_id desde el cliente.
create or replace function public.forma_access_status() returns jsonb language sql security invoker set search_path='' as $$select forma_private.access_status()$$;
revoke all on function public.forma_access_status() from public,anon;
grant execute on function public.forma_access_status() to authenticated;
notify pgrst,'reload schema';
commit;
-- Comprobación de instalación (no cambia datos):
select position('automatic_verified_google' in pg_get_functiondef('forma_private.access_status()'::regprocedure))>0 as acceso_google_automatico_instalado;
