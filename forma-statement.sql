-- FORMA independiente: extracto de lectura. No borra, inserta ni actualiza datos.
begin;
do $$begin
 if to_regprocedure('forma_private.finance(text,jsonb)') is null then raise exception 'Primero activar Finanzas';end if;
 if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Proyecto incorrecto: solo FORMA independiente';end if;
end$$;
create or replace function forma_private.statement(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=forma_private.agenda_role();d date;e date;skip integer;q text;k text;m text;c text;include_void boolean;result jsonb;
begin
 if r is null or r not in ('owner','manager') then raise exception 'Extracto requiere gestión de FORMA' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Datos inválidos' using errcode='22023';end if;
 d:=(p_data->>'from')::date;e:=(p_data->>'to')::date;skip:=coalesce((p_data->>'offset')::integer,0);
 q:=lower(trim(coalesce(p_data->>'query','')));k:=coalesce(p_data->>'kind','');m:=coalesce(p_data->>'method','');c:=coalesce(p_data->>'category','');include_void:=coalesce((p_data->>'include_void')::boolean,false);
 if d is null or e is null or d>e or e-d>365 or d<'2020-01-01' or e>'2045-12-31' or skip<0 or length(q)>160 or length(c)>160 or k not in ('','payment','gasto','reembolso') or m not in ('','pix','efectivo','tarjeta','transferencia','bitcoin') then raise exception 'Filtros inválidos: máximo un año' using errcode='22023';end if;
 with movements as materialized(
 select p.id,p.booking_id,'payment'::text kind,p.paid_on,p.created_at,b.client label,p.area category,p.activity,p.method,p.amount_cents,p.note,p.voided_at,p.void_reason
 from forma_private.agenda_payments p join forma_private.agenda_bookings b on b.id=p.booking_id where p.paid_on between d and e
 union all
 select o.id,o.booking_id,o.kind,o.paid_on,o.created_at,coalesce(b.client,o.category),o.category,coalesce(b.activity,''),o.method,o.amount_cents,o.note,o.voided_at,o.void_reason
 from forma_private.finance_outflows o left join forma_private.agenda_bookings b on b.id=o.booking_id where o.paid_on between d and e
 ), matching as materialized(select * from movements x where (include_void or x.voided_at is null) and (k='' or x.kind=k) and (m='' or x.method=m) and (c='' or x.category=c) and (q='' or position(q in lower(concat_ws(' ',x.label,x.category,x.activity,x.note)))>0)),
 page as(select * from matching order by paid_on desc,created_at desc,kind,id limit 30 offset skip)
 select jsonb_build_object('version',1,'from',d,'to',e,'offset',skip,'as_of',now(),'filtered_count',(select count(*) from matching),'has_more',(select count(*) from matching)>skip+30,
 'incoming_cents',coalesce((select sum(amount_cents) from matching where kind='payment' and voided_at is null),0),
 'outgoing_cents',coalesce((select sum(amount_cents) from matching where kind<>'payment' and voided_at is null),0),
 'categories',coalesce((select jsonb_agg(category order by category) from(select distinct category from movements)x),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(to_jsonb(page) order by paid_on desc,created_at desc,kind,id) from page),'[]'::jsonb)) into result;
 return result;
end$$;
create or replace function public.forma_statement(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select forma_private.statement(p_data)$$;
revoke all on function forma_private.statement(jsonb),public.forma_statement(jsonb) from public,anon,authenticated;
grant execute on function forma_private.statement(jsonb),public.forma_statement(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.forma_statement(jsonb)') is not null as extracto_instalado;
