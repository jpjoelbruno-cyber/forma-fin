-- FORMA private academic catalogue. Additive: no seeds or data deletion.
begin;
do $$begin if position('https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1' in pg_get_functiondef('forma_private.agenda_role()'::regprocedure))=0 then raise exception 'Usar exclusivamente FORMA independiente';end if;end$$;
create table if not exists forma_private.academic_courses(id uuid primary key,name text not null check(length(trim(name)) between 2 and 120),modules jsonb not null default '[]' check(jsonb_typeof(modules)='array' and jsonb_array_length(modules)<=100),active boolean not null default true,version integer not null default 1,created_by uuid not null references auth.users(id));
create table if not exists forma_private.academic_groups(id uuid primary key,course_id uuid not null references forma_private.academic_courses(id),name text not null check(length(trim(name)) between 1 and 120),instructor text not null check(length(trim(instructor)) between 1 and 120),room text not null check(length(trim(room)) between 1 and 120),capacity integer not null check(capacity between 1 and 500),fee_cents integer not null check(fee_cents between 0 and 100000000),monthly_cents integer not null check(monthly_cents between 0 and 100000000),installments integer not null check(installments between 0 and 60),active boolean not null default true,version integer not null default 1,created_by uuid not null references auth.users(id),check((installments=0 and monthly_cents=0) or (installments>0 and monthly_cents>0)));
create table if not exists forma_private.academic_sessions(id uuid primary key,group_id uuid not null references forma_private.academic_groups(id),day date not null check(day between '2020-01-01' and '2045-12-31'),start_min integer not null check(start_min between 0 and 1439),end_min integer not null check(end_min between 1 and 1440),module text not null default '' check(length(module)<=160),cancelled boolean not null default false,check(end_min>start_min));
alter table forma_private.academic_sessions add column if not exists instructor text;
alter table forma_private.academic_sessions add column if not exists room text;
alter table forma_private.academic_groups add column if not exists module_plan jsonb not null default '[]';
-- Stable course definition; dates belong to a group, not to this template.
alter table forma_private.academic_courses add column if not exists encounter_count integer not null default 0 check(encounter_count between 0 and 104);
alter table forma_private.academic_courses add column if not exists module_counts jsonb not null default '{}' check(jsonb_typeof(module_counts)='object');
alter table forma_private.academic_groups add column if not exists planned_count integer not null default 0 check(planned_count between 0 and 104);
create index if not exists academic_sessions_day on forma_private.academic_sessions(day) where not cancelled;
create index if not exists academic_sessions_group on forma_private.academic_sessions(group_id);
create table if not exists forma_private.academic_requests(id uuid primary key,actor uuid not null,action text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
create table if not exists forma_private.academic_history(id bigint generated always as identity primary key,actor uuid not null,action text not null,target uuid,snapshot jsonb not null,created_at timestamptz not null default now());
do $$declare t text;begin foreach t in array array['academic_courses','academic_groups','academic_sessions','academic_requests','academic_history'] loop execute format('alter table forma_private.%I enable row level security',t);execute format('revoke all on forma_private.%I from public,anon,authenticated',t);end loop;end$$;
alter table forma_private.agenda_bookings add column if not exists room text not null default '';
commit;
