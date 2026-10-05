-- Applies only to FORMÁ. No ELEVA/Taller grants or data are modified.
-- A client-generated UUID makes retries idempotent; ownership RLS remains mandatory.
grant insert(id) on public.forma_transactions to authenticated;
create or replace function public.forma_save_movement(p_id uuid,p_date date,p_amount numeric,p_type text,p_category text,p_description text default '') returns uuid
language plpgsql security invoker set search_path='' as $$
declare row public.forma_transactions; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_id is null or p_amount is null or p_amount<=0 or p_amount>999999999 or p_amount<>round(p_amount,2) or p_date is null or p_type not in ('income','expense') or p_type is null or p_category is null or length(p_category)>500 or length(p_category)=0 or length(coalesce(p_description,''))>500 then raise exception 'Invalid movement' using errcode='22023';end if;
 insert into public.forma_transactions(id,user_id,date,amount,type,category,description,source) values(p_id,uid,p_date,p_amount,p_type,p_category,coalesce(p_description,''),'manual') on conflict(id) do nothing;
 select * into row from public.forma_transactions where id=p_id and user_id=uid;
 if row.id is null then raise exception 'Movement unavailable' using errcode='42501';end if;
 if row.date<>p_date or row.amount<>p_amount or row.type<>p_type or row.category<>p_category or coalesce(row.description,'')<>coalesce(p_description,'') or row.source<>'manual' then raise exception 'Retry differs from saved movement' using errcode='22023';end if;
 return row.id;
end $$;
revoke all on function public.forma_save_movement(uuid,date,numeric,text,text,text) from public,anon;
grant execute on function public.forma_save_movement(uuid,date,numeric,text,text,text) to authenticated;

create table if not exists forma_private.voice_daily(user_id uuid not null references auth.users(id) on delete cascade,day date not null,requests integer not null default 0,bytes bigint not null default 0,primary key(user_id,day));
alter table forma_private.voice_daily enable row level security;
revoke all on forma_private.voice_daily from public,anon,authenticated;
create or replace function forma_private.voice_claim(p_bytes integer) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();sid uuid;d date:=(now() at time zone 'America/Sao_Paulo')::date;n integer;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when invalid_text_representation then return false;end;
 if not exists(select 1 from auth.sessions where id=sid and user_id=uid and (not_after is null or not_after>now())) or not exists(select 1 from public.forma_profiles where id=uid) then return false;end if;
 if p_bytes is null or p_bytes<=0 or p_bytes>2097152 then return false;end if;
 insert into forma_private.voice_daily(user_id,day) values(uid,d) on conflict do nothing;
 update forma_private.voice_daily set requests=requests+1,bytes=bytes+p_bytes where user_id=uid and day=d and requests<40 and bytes+p_bytes<=16777216;
 get diagnostics n=row_count;return n=1;
end $$;
revoke all on function forma_private.voice_claim(integer) from public,anon;
grant execute on function forma_private.voice_claim(integer) to authenticated;
create or replace function public.forma_voice_claim(p_bytes integer) returns boolean language sql security invoker set search_path='' as $$select forma_private.voice_claim(p_bytes)$$;
revoke all on function public.forma_voice_claim(integer) from public,anon;
grant execute on function public.forma_voice_claim(integer) to authenticated;
