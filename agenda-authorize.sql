-- Ejecuta Joel SOLO en FORMA independiente, después de que René cree su cuenta.
-- Sustituye RENÉ_CORREO_CONFIRMADO por el correo exacto. No da administración general.
begin;
do $$declare target uuid; v_email text:='RENÉ_CORREO_CONFIRMADO';begin
 if not exists(select 1 from public.forma_admin_members m join auth.users u on u.id=m.user_id where u.id='776893e1-f940-437c-94a7-40a83bccc013' and lower(u.email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto';end if;
 if v_email='RENÉ_CORREO_CONFIRMADO' or position('@' in v_email)=0 then raise exception 'Primero coloca el correo exacto de René';end if;
 select id into strict target from auth.users where lower(email)=lower(trim(v_email)) and email_confirmed_at is not null and (banned_until is null or banned_until<=now());
 insert into forma_private.agenda_staff(user_id,role,active) values(target,'manager',true) on conflict(user_id) do update set role='manager',instructor=null,active=true;
end$$;
commit;
