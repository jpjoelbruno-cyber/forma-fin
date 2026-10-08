-- FORMÁ ONLY. Ejecutar manualmente en irsuevjqmgpwunvymxbc.
-- Conserva el progreso manual anterior; no toca finanzas, bancos ni otras apps.
begin;
do $$begin
 if not exists(select 1 from public.forma_admin_members where user_id='776893e1-f940-437c-94a7-40a83bccc013') or not exists(select 1 from auth.users where id='776893e1-f940-437c-94a7-40a83bccc013' and lower(email)='jp.joelbruno@gmail.com') then raise exception 'Proyecto incorrecto: administrador de FORMA independiente no encontrado'; end if;
end$$;
create table if not exists forma_private.lesson_checks(
 lesson_id uuid primary key references public.forma_course_lessons(id) on delete cascade,
 revision integer not null default 1, video_id text, duration_seconds integer not null check(duration_seconds between 1 and 14400),
 question text not null check(length(question) between 1 and 500),options text[] not null check(cardinality(options)=3),correct_option integer not null check(correct_option between 0 and 2)
);
create table if not exists forma_private.verified_learning(
 user_id uuid not null references auth.users(id) on delete cascade,lesson_id uuid not null references public.forma_course_lessons(id) on delete cascade,
 revision integer not null, watched int4multirange not null default '{}'::int4multirange,
 video_completed boolean not null default false, quiz_passed boolean not null default false,
 completed_at timestamptz,last_quiz_at timestamptz,last_position double precision not null default 0,
 primary key(user_id,lesson_id)
);
create table if not exists forma_private.learning_sessions(
 user_id uuid primary key references auth.users(id) on delete cascade,lesson_id uuid not null references public.forma_course_lessons(id) on delete cascade,
 token uuid not null unique,revision integer not null,auth_session text not null,expires_at timestamptz not null,
 last_at timestamptz not null default clock_timestamp(),last_position double precision not null default 0,last_playing boolean not null default false
);
alter table forma_private.lesson_checks enable row level security;
alter table forma_private.verified_learning enable row level security;
alter table forma_private.learning_sessions enable row level security;
revoke all on forma_private.lesson_checks,forma_private.verified_learning,forma_private.learning_sessions from public,anon,authenticated;
create index if not exists forma_learning_check_course_order on public.forma_course_lessons(course_id,position,id) where status='published';
-- These helpers only ever evaluate progress for auth.uid(), never a supplied user ID.
create or replace function forma_private.learning_course_done(p_course uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and forma_private.access_active()
 and exists(select 1 from public.forma_course_lessons l where l.course_id=p_course and l.status='published')
 and not exists(select 1 from public.forma_course_lessons l left join forma_private.lesson_checks k on k.lesson_id=l.id left join forma_private.verified_learning v on v.lesson_id=l.id and v.user_id=auth.uid() where l.course_id=p_course and l.status='published' and (k.lesson_id is null or k.video_id is distinct from l.youtube_id or v.completed_at is null or v.revision is distinct from k.revision));
$$;
create or replace function forma_private.learning_course_open(p_course uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and forma_private.access_active() and exists(
 select 1 from public.forma_courses c where c.id=p_course and c.status='published' and (c.access_level='free' or forma_private.course_subscriber())
 and not exists(select 1 from public.forma_courses prior where prior.status='published' and (prior.position,prior.id)<(c.position,c.id) and not forma_private.learning_course_done(prior.id)));
$$;
create or replace function forma_private.learning_lesson_open(p_lesson uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and forma_private.access_active() and exists(select 1 from public.forma_course_lessons l where l.id=p_lesson and l.status='published' and forma_private.learning_course_open(l.course_id)
 and not exists(select 1 from public.forma_course_lessons prior left join forma_private.lesson_checks k on k.lesson_id=prior.id left join forma_private.verified_learning v on v.lesson_id=prior.id and v.user_id=auth.uid() where prior.course_id=l.course_id and prior.status='published' and (prior.position,prior.id)<(l.position,l.id) and (k.lesson_id is null or k.video_id is distinct from prior.youtube_id or v.completed_at is null or v.revision is distinct from k.revision)));
$$;
-- Only metadata for locked lessons is returned. Their video/body/activity stay behind RLS.
create or replace function forma_private.learning_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null or not forma_private.access_active() then raise exception 'Acceso FORMA no activo';end if;
 select jsonb_build_object('version',1,'courses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'open',forma_private.learning_course_open(c.id),'done',forma_private.learning_course_done(c.id),'total',(select count(*) from public.forma_course_lessons l where l.course_id=c.id and l.status='published')) order by c.position,c.id) from public.forma_courses c where c.status='published'),'[]'::jsonb),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'course_id',l.course_id,'title',l.title,'position',l.position,'module_title',l.module_title,'open',forma_private.learning_lesson_open(l.id),'configured',k.lesson_id is not null and k.video_id is not distinct from l.youtube_id,
 'duration',case when forma_private.learning_lesson_open(l.id) then k.duration_seconds end,
 'question',case when forma_private.learning_lesson_open(l.id) then k.question end,'options',case when forma_private.learning_lesson_open(l.id) then to_jsonb(k.options) end,
 'watched_seconds',case when v.revision=k.revision and k.video_id is not distinct from l.youtube_id then coalesce((select sum(upper(r)-lower(r)) from unnest(v.watched) r),0) else 0 end,
 'video_completed',coalesce(v.revision=k.revision and k.video_id is not distinct from l.youtube_id and v.video_completed,false),
 'completed_at',case when v.revision=k.revision and k.video_id is not distinct from l.youtube_id then v.completed_at end,'last_position',case when v.revision=k.revision then v.last_position else 0 end)
 order by c.position,c.id,l.position,l.id) from public.forma_course_lessons l join public.forma_courses c on c.id=l.course_id left join forma_private.lesson_checks k on k.lesson_id=l.id left join forma_private.verified_learning v on v.lesson_id=l.id and v.user_id=u where l.status='published' and c.status='published'),'[]'::jsonb)) into result;
 return result;
end$$;
create or replace function forma_private.learning_start(p_lesson uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();k forma_private.lesson_checks; t uuid:=gen_random_uuid(); sid text:=auth.jwt()->>'session_id';
begin
 if u is null or sid is null or not forma_private.learning_lesson_open(p_lesson) then raise exception 'Clase bloqueada o acceso no activo';end if;
 select * into k from forma_private.lesson_checks where lesson_id=p_lesson;
 if not found or k.video_id is distinct from (select youtube_id from public.forma_course_lessons where id=p_lesson) then raise exception 'Clase pendiente de configurar';end if;
 insert into forma_private.verified_learning(user_id,lesson_id,revision) values(u,p_lesson,k.revision) on conflict(user_id,lesson_id) do update set revision=excluded.revision,watched=case when verified_learning.revision=excluded.revision then verified_learning.watched else '{}'::int4multirange end,video_completed=case when verified_learning.revision=excluded.revision then verified_learning.video_completed else false end,quiz_passed=case when verified_learning.revision=excluded.revision then verified_learning.quiz_passed else false end,completed_at=case when verified_learning.revision=excluded.revision then verified_learning.completed_at else null end,last_position=case when verified_learning.revision=excluded.revision then verified_learning.last_position else 0 end;
 insert into forma_private.learning_sessions(user_id,lesson_id,token,revision,auth_session,expires_at) values(u,p_lesson,t,k.revision,sid,clock_timestamp()+interval '8 hours') on conflict(user_id) do update set lesson_id=excluded.lesson_id,token=excluded.token,revision=excluded.revision,auth_session=excluded.auth_session,expires_at=excluded.expires_at,last_at=clock_timestamp(),last_position=0,last_playing=false;
 return jsonb_build_object('token',t,'duration',k.duration_seconds);
end$$;
create or replace function forma_private.learning_tick(p_token uuid,p_position double precision,p_playing boolean,p_rate double precision,p_ended boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();s forma_private.learning_sessions;k forma_private.lesson_checks;elapsed double precision;delta double precision;a integer;b integer;coverage integer;now_at timestamptz:=clock_timestamp();
begin
 if u is null or not forma_private.access_active() then raise exception 'Acceso no activo';end if;
 select * into s from forma_private.learning_sessions where user_id=u and token=p_token for update;
 if not found or s.auth_session is distinct from (auth.jwt()->>'session_id') or s.expires_at<now_at or not forma_private.learning_lesson_open(s.lesson_id) then raise exception 'Sesión de clase inválida';end if;
 select * into k from forma_private.lesson_checks where lesson_id=s.lesson_id for share;
 if k.revision is distinct from s.revision or k.video_id is distinct from (select youtube_id from public.forma_course_lessons where id=s.lesson_id) then raise exception 'Contenido actualizado';end if;
 if p_position is null or not(p_position between 0 and k.duration_seconds+2) or p_rate is null or not(p_rate between 0.25 and 2) or p_playing is null or p_ended is null then raise exception 'Reproducción inválida';end if;
 elapsed:=extract(epoch from now_at-s.last_at);delta:=p_position-s.last_position;
 -- Credit unique whole seconds only for continuous playback within server time.
 -- Seeking, pausing, background playback and repeated viewing cannot inflate coverage.
 if s.last_playing and (p_playing or p_ended) and elapsed between 0.5 and 15 and delta>0 and delta<=elapsed*p_rate+1 then
 a:=greatest(0,floor(s.last_position)::integer);b:=least(k.duration_seconds,floor(p_position)::integer);
 if b>a then update forma_private.verified_learning set watched=watched+int4multirange(int4range(a,b,'[)')) where user_id=u and lesson_id=s.lesson_id and revision=k.revision;end if;
 end if;
 update forma_private.learning_sessions set last_at=now_at,last_position=p_position,last_playing=p_playing where user_id=u;
 select coalesce(sum(upper(r)-lower(r)),0) into coverage from forma_private.verified_learning v cross join lateral unnest(v.watched) r where v.user_id=u and v.lesson_id=s.lesson_id;
 update forma_private.verified_learning set last_position=p_position,video_completed=video_completed or (p_ended and p_position>=k.duration_seconds-2 and coverage>=ceil(k.duration_seconds*0.95)),completed_at=case when quiz_passed and (video_completed or (p_ended and p_position>=k.duration_seconds-2 and coverage>=ceil(k.duration_seconds*0.95))) then coalesce(completed_at,now_at) else completed_at end where user_id=u and lesson_id=s.lesson_id;
 return jsonb_build_object('watched_seconds',coverage,'duration',k.duration_seconds,'video_completed',(select video_completed from forma_private.verified_learning where user_id=u and lesson_id=s.lesson_id));
end$$;
create or replace function forma_private.learning_quiz(p_lesson uuid,p_option integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();k forma_private.lesson_checks;v forma_private.verified_learning;ok boolean;
begin
 if u is null or not forma_private.learning_lesson_open(p_lesson) then raise exception 'Clase bloqueada';end if;
 select * into k from forma_private.lesson_checks where lesson_id=p_lesson for share;
 select * into v from forma_private.verified_learning where user_id=u and lesson_id=p_lesson for update;
 if not found or not v.video_completed or v.revision is distinct from k.revision or k.video_id is distinct from (select youtube_id from public.forma_course_lessons where id=p_lesson) then raise exception 'Completa la reproducción primero';end if;
 if v.last_quiz_at>clock_timestamp()-interval '10 seconds' then raise exception 'Espera unos segundos antes de reintentar';end if;
 if p_option is null or p_option not between 0 and 2 then raise exception 'Opción inválida';end if;
 ok:=p_option=k.correct_option;
 update forma_private.verified_learning set last_quiz_at=clock_timestamp(),quiz_passed=quiz_passed or ok,completed_at=case when ok then coalesce(completed_at,clock_timestamp()) else completed_at end where user_id=u and lesson_id=p_lesson;
 return jsonb_build_object('passed',ok,'state',forma_private.learning_state());
end$$;
create or replace function forma_private.learning_config(p_lesson uuid,p_duration integer default null,p_question text default null,p_options text[] default null,p_correct integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare k forma_private.lesson_checks;vid text;
begin
 if auth.uid() is null or not forma_private.access_active() or not exists(select 1 from public.forma_admin_members where user_id=auth.uid()) then raise exception 'Solo administrador FORMA';end if;
 select youtube_id into vid from public.forma_course_lessons where id=p_lesson;
 if not found then raise exception 'Clase inexistente';end if;
 if p_duration is not null then
 if vid is null or p_duration not between 1 and 14400 or p_question is null or length(trim(p_question)) not between 1 and 500 or cardinality(p_options) is distinct from 3 or p_correct is null or p_correct not between 0 and 2 or exists(select 1 from unnest(p_options) o where o is null or length(trim(o)) not between 1 and 200) then raise exception 'Revisa duración, pregunta y tres opciones';end if;
 insert into forma_private.lesson_checks(lesson_id,video_id,duration_seconds,question,options,correct_option) values(p_lesson,vid,p_duration,trim(p_question),p_options,p_correct) on conflict(lesson_id) do update set revision=case when (lesson_checks.video_id,lesson_checks.duration_seconds,lesson_checks.question,lesson_checks.options,lesson_checks.correct_option) is distinct from (excluded.video_id,excluded.duration_seconds,excluded.question,excluded.options,excluded.correct_option) then lesson_checks.revision+1 else lesson_checks.revision end,video_id=excluded.video_id,duration_seconds=excluded.duration_seconds,question=excluded.question,options=excluded.options,correct_option=excluded.correct_option;
 end if;
 select * into k from forma_private.lesson_checks where lesson_id=p_lesson;
 return case when found then to_jsonb(k) else '{}'::jsonb end;
end$$;
-- Every privileged implementation is private and checks auth.uid + active FORMÁ access.
-- Public functions are narrow SECURITY INVOKER wrappers; no client receives answer keys.
create or replace function public.forma_learning_state() returns jsonb language sql security invoker set search_path='' as $$select forma_private.learning_state()$$;
create or replace function public.forma_learning_start(p_lesson uuid) returns jsonb language sql security invoker set search_path='' as $$select forma_private.learning_start(p_lesson)$$;
create or replace function public.forma_learning_tick(p_token uuid,p_position double precision,p_playing boolean,p_rate double precision,p_ended boolean default false) returns jsonb language sql security invoker set search_path='' as $$select forma_private.learning_tick(p_token,p_position,p_playing,p_rate,p_ended)$$;
create or replace function public.forma_learning_quiz(p_lesson uuid,p_option integer) returns jsonb language sql security invoker set search_path='' as $$select forma_private.learning_quiz(p_lesson,p_option)$$;
create or replace function public.forma_learning_config(p_lesson uuid,p_duration integer default null,p_question text default null,p_options text[] default null,p_correct integer default null) returns jsonb language sql security invoker set search_path='' as $$select forma_private.learning_config(p_lesson,p_duration,p_question,p_options,p_correct)$$;
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='forma_private' and p.proname in ('learning_course_done','learning_course_open','learning_lesson_open','learning_state','learning_start','learning_tick','learning_quiz','learning_config')) or (n.nspname='public' and p.proname in ('forma_learning_state','forma_learning_start','forma_learning_tick','forma_learning_quiz','forma_learning_config')) loop
 execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end$$;
-- No more self-reported course completions. Keep historic rows as declarations only.
revoke insert,update,delete on public.forma_course_progress,public.forma_learning_progress from authenticated;
drop policy if exists lessons_read on public.forma_course_lessons;
create policy lessons_read on public.forma_course_lessons for select to authenticated using(forma_private.learning_lesson_open(id));
commit;
select 'FORMÁ: validación de aprendizaje instalada' as resultado;
