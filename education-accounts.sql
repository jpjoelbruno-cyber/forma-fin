-- FORMÁ ONLY. Run manually in FORMA Personal Independiente (irsuevjqmgpwunvymxbc).
-- No existing financial data or grants are changed; no bank connection or payment is enabled.
begin;
do $$begin
 if not exists(select 1 from public.forma_admin_members where user_id='776893e1-f940-437c-94a7-40a83bccc013')
 or not exists(select 1 from auth.users where id='776893e1-f940-437c-94a7-40a83bccc013' and lower(email)='jp.joelbruno@gmail.com') then
 raise exception 'Wrong project: dedicated FORMA administrator not found'; end if;
end$$;
create table if not exists public.forma_courses(
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 120),
 summary text not null default '' check(length(summary)<=1000),language text not null default 'es' check(language in ('es','pt')),
 icon text not null default '📚' check(length(icon)<=12),access_level text not null default 'free' check(access_level in ('free','subscription')),
 status text not null default 'draft' check(status in ('draft','published','archived')),position integer not null default 0 check(position>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.forma_course_lessons(
 id uuid primary key default gen_random_uuid(),course_id uuid not null references public.forma_courses(id) on delete cascade,
 module_title text not null default 'Primeros pasos' check(length(module_title) between 1 and 120),
 title text not null check(length(title) between 1 and 160),body text not null default '' check(length(body)<=4000),
 action_text text not null default '' check(length(action_text)<=1000),action_panel text check(action_panel in ('resumo','registrar','metas','banco')),
 youtube_id text check(youtube_id ~ '^[A-Za-z0-9_-]{11}$'),position integer not null default 0 check(position>=0),
 status text not null default 'draft' check(status in ('draft','published','archived')),created_at timestamptz not null default now()
);
create index if not exists forma_course_lessons_order on public.forma_course_lessons(course_id,position);
-- Entitlements are exclusively maintained by administrators/server billing, never by the student's client.
create table if not exists forma_private.course_entitlements(
 user_id uuid primary key references auth.users(id) on delete cascade, valid_until timestamptz not null,
 source text not null check(source in ('scholarship','manual','billing')),created_at timestamptz not null default now()
);
alter table forma_private.course_entitlements enable row level security;
revoke all on forma_private.course_entitlements from public,anon,authenticated;
create or replace function forma_private.course_subscriber() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and forma_private.access_active() and exists(select 1 from forma_private.course_entitlements e where e.user_id=auth.uid() and e.valid_until>now())
$$;
revoke all on function forma_private.course_subscriber() from public,anon;
grant execute on function forma_private.course_subscriber() to authenticated;
create table if not exists public.forma_course_progress(
 user_id uuid not null references public.forma_profiles(id) on delete cascade,
 lesson_id uuid not null references public.forma_course_lessons(id) on delete cascade,
 completed_at timestamptz not null default now(),primary key(user_id,lesson_id)
);
create table if not exists public.forma_manual_accounts(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.forma_profiles(id) on delete cascade,
 institution_code text not null check(institution_code in ('nubank','inter','mercadopago','picpay','other')),
 label text not null check(length(label) between 1 and 80 and label !~ '[0-9]{6,}'),
 declared_balance numeric(14,2) check(declared_balance>=0 and declared_balance<=999999999),
 as_of date not null default current_date,source text not null default 'self_reported' check(source='self_reported'),created_at timestamptz not null default now()
);
create index if not exists forma_manual_accounts_owner on public.forma_manual_accounts(user_id);
alter table public.forma_courses enable row level security;
alter table public.forma_course_lessons enable row level security;
alter table public.forma_course_progress enable row level security;
alter table public.forma_manual_accounts enable row level security;
revoke all on public.forma_courses,public.forma_course_lessons,public.forma_course_progress,public.forma_manual_accounts from public,anon,authenticated;
grant select,insert,update on public.forma_courses,public.forma_course_lessons to authenticated;
grant select,insert on public.forma_course_progress to authenticated;
grant select,insert,update on public.forma_manual_accounts to authenticated;
-- Active FORMÁ membership is mandatory for every operation, even for administrators.
do $$declare t text;begin
 foreach t in array array['forma_courses','forma_course_lessons','forma_course_progress','forma_manual_accounts'] loop
 execute format('drop policy if exists forma_active_only on public.%I',t);
 execute format('create policy forma_active_only on public.%I as restrictive for all to authenticated using ((select forma_private.access_active())) with check ((select forma_private.access_active()))',t);
 end loop;
end$$;
drop policy if exists courses_read on public.forma_courses;
create policy courses_read on public.forma_courses for select to authenticated using(status='published' or exists(select 1 from public.forma_admin_members m where m.user_id=(select auth.uid())));
drop policy if exists courses_admin on public.forma_courses;
create policy courses_admin on public.forma_courses for all to authenticated using(exists(select 1 from public.forma_admin_members m where m.user_id=(select auth.uid()))) with check(exists(select 1 from public.forma_admin_members m where m.user_id=(select auth.uid())));
drop policy if exists lessons_read on public.forma_course_lessons;
create policy lessons_read on public.forma_course_lessons for select to authenticated using(status='published' and exists(select 1 from public.forma_courses c where c.id=course_id and c.status='published' and (c.access_level='free' or (select forma_private.course_subscriber()))));
drop policy if exists lessons_admin on public.forma_course_lessons;
create policy lessons_admin on public.forma_course_lessons for all to authenticated using(exists(select 1 from public.forma_admin_members m where m.user_id=(select auth.uid()))) with check(exists(select 1 from public.forma_admin_members m where m.user_id=(select auth.uid())));
drop policy if exists course_progress_read on public.forma_course_progress;
create policy course_progress_read on public.forma_course_progress for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists course_progress_insert on public.forma_course_progress;
create policy course_progress_insert on public.forma_course_progress for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.forma_course_lessons l join public.forma_courses c on c.id=l.course_id where l.id=lesson_id and l.status='published' and c.status='published' and (c.access_level='free' or (select forma_private.course_subscriber()))));
drop policy if exists manual_accounts_self on public.forma_manual_accounts;
create policy manual_accounts_self on public.forma_manual_accounts for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and source='self_reported');
-- Expose only a boolean to the owner of the current session.
create or replace function public.forma_course_access() returns boolean language sql stable security invoker set search_path='' as $$select forma_private.course_subscriber()$$;
revoke all on function public.forma_course_access() from public,anon;
grant execute on function public.forma_course_access() to authenticated;
-- Draft templates: no invented videos, no changes to courses already created.
insert into public.forma_courses(id,title,summary,icon,language,access_level,status,position) values
 ('aba10000-0000-4000-8000-000000000001','Mi primer presupuesto','Descubre cuánto cuesta tu mes y prepara tu plan personal.','🌱','es','free','draft',0),
 ('aba10000-0000-4000-8000-000000000002','Organizo mi dinero','Registra tus gastos y entiende dónde está tu dinero.','📚','es','free','draft',1),
 ('aba10000-0000-4000-8000-000000000003','Mi reserva de emergencia','Construye tu reserva, paso a paso.','🛡️','es','free','draft',2),
 ('aba10000-0000-4000-8000-000000000004','Mis metas personales','Planifica una visita familiar, un viaje u otra meta.','🎯','es','free','draft',3),
 ('aba10000-0000-4000-8000-000000000005','Primeros pasos en inversiones','Aprende después de organizar tus finanzas personales.','📚','es','free','draft',4)
on conflict(id) do nothing;
commit;
-- Verification after applying (read-only):
select tablename,policyname from pg_policies where tablename in ('forma_courses','forma_course_lessons','forma_course_progress','forma_manual_accounts') order by tablename,policyname;
