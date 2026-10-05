-- FORMÁ only. Empty schema; no ELEVA tables, users, JWT secrets or sessions are copied.
create table public.forma_profiles (
id uuid not null,
full_name text not null default ''::text,
role text not null default 'student'::text,
teacher_id uuid,
created_at timestamp with time zone default now(),
invite_code text);
create table public.forma_budgets (
id uuid not null default gen_random_uuid(),
user_id uuid not null,
month text not null,
category text not null,
planned numeric(12,2) not null default 0,
created_at timestamp with time zone default now());
create table public.forma_transactions (
id uuid not null default gen_random_uuid(),
user_id uuid not null,
date date not null default CURRENT_DATE,
description text not null default ''::text,
amount numeric(12,2) not null,
type text not null,
category text not null default 'Outros'::text,
source text default 'manual'::text,
external_id text,
created_at timestamp with time zone default now());
create table public.forma_goals (
id uuid not null default gen_random_uuid(),
user_id uuid not null,
name text not null,
target numeric(12,2) not null,
saved numeric(12,2) not null default 0,
deadline date,
created_at timestamp with time zone default now(),
monthly_plan numeric not null default 0,
goal_type text not null default 'custom'::text,
visual text not null default 'auto'::text);
create table public.forma_goal_events (
id uuid not null default gen_random_uuid(),
user_id uuid not null,
goal_id uuid not null,
direction text not null,
amount numeric not null,
institution_code text not null default 'other'::text,
location_label text not null default ''::text,
occurred_on date not null default CURRENT_DATE,
note text not null default ''::text,
source text not null default 'self_reported'::text,
created_at timestamp with time zone not null default now());
create table public.forma_learning_progress (
user_id uuid not null,
lesson_key text not null,
completed_at timestamp with time zone not null default now());
create table public.forma_admin_members (
user_id uuid not null,
created_at timestamp with time zone not null default now());
create table public.forma_support_settings (
id boolean not null default true,
whatsapp text not null default ''::text);
create table public.forma_usage_daily (
user_id uuid not null,
day date not null default CURRENT_DATE,
section text not null,
seen_at timestamp with time zone not null default now());
alter table public.forma_admin_members add constraint forma_admin_members_pkey PRIMARY KEY (user_id);
alter table public.forma_budgets add constraint forma_budgets_month_format CHECK ((month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text));
alter table public.forma_budgets add constraint forma_budgets_nonnegative_planned CHECK ((planned >= (0)::numeric));
alter table public.forma_budgets add constraint forma_budgets_pkey PRIMARY KEY (id);
alter table public.forma_budgets add constraint forma_budgets_user_id_month_category_key UNIQUE (user_id, month, category);
alter table public.forma_goal_events add constraint forma_goal_events_amount_check CHECK (((amount > (0)::numeric) AND (amount <= (999999999)::numeric)));
alter table public.forma_goal_events add constraint forma_goal_events_direction_check CHECK ((direction = ANY (ARRAY['contribution'::text, 'withdrawal'::text])));
alter table public.forma_goal_events add constraint forma_goal_events_institution_code_check CHECK ((institution_code = ANY (ARRAY['nubank'::text, 'inter'::text, 'mercadopago'::text, 'picpay'::text, 'other'::text])));
alter table public.forma_goal_events add constraint forma_goal_events_pkey PRIMARY KEY (id);
alter table public.forma_goal_events add constraint forma_goal_events_source_check CHECK ((source = 'self_reported'::text));
alter table public.forma_goals add constraint forma_goals_monthly_plan_nonnegative CHECK ((monthly_plan >= (0)::numeric));
alter table public.forma_goals add constraint forma_goals_pkey PRIMARY KEY (id);
alter table public.forma_goals add constraint forma_goals_saved_nonnegative CHECK ((saved >= (0)::numeric));
alter table public.forma_goals add constraint forma_goals_target_positive CHECK ((target > (0)::numeric));
alter table public.forma_goals add constraint forma_goals_visual_check CHECK ((visual = ANY (ARRAY['auto'::text, 'house'::text, 'travel'::text, 'family'::text, 'car'::text, 'reserve'::text, 'study'::text, 'custom'::text])));
alter table public.forma_learning_progress add constraint forma_learning_progress_lesson_key_check CHECK ((lesson_key = ANY (ARRAY['budget'::text, 'reserve'::text, 'goals'::text, 'selic'::text, 'investments'::text])));
alter table public.forma_learning_progress add constraint forma_learning_progress_pkey PRIMARY KEY (user_id, lesson_key);
alter table public.forma_profiles add constraint forma_profiles_invite_code_key UNIQUE (invite_code);
alter table public.forma_profiles add constraint forma_profiles_pkey PRIMARY KEY (id);
alter table public.forma_profiles add constraint forma_profiles_role_check CHECK ((role = ANY (ARRAY['teacher'::text, 'student'::text])));
alter table public.forma_support_settings add constraint forma_support_settings_id_check CHECK (id);
alter table public.forma_support_settings add constraint forma_support_settings_pkey PRIMARY KEY (id);
alter table public.forma_support_settings add constraint forma_support_settings_whatsapp_check CHECK (((whatsapp = ''::text) OR (whatsapp ~ '^[1-9][0-9]{7,14}$'::text)));
alter table public.forma_transactions add constraint forma_transactions_pkey PRIMARY KEY (id);
alter table public.forma_transactions add constraint forma_transactions_positive_amount CHECK ((amount > (0)::numeric));
alter table public.forma_transactions add constraint forma_transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])));
alter table public.forma_usage_daily add constraint forma_usage_daily_pkey PRIMARY KEY (user_id, day, section);
alter table public.forma_usage_daily add constraint forma_usage_daily_section_check CHECK ((section = ANY (ARRAY['resumo'::text, 'registrar'::text, 'historico'::text, 'metas'::text, 'aprender'::text, 'anual'::text])));
alter table public.forma_admin_members add constraint forma_admin_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.forma_budgets add constraint forma_budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.forma_goal_events add constraint forma_goal_events_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES forma_goals(id) ON DELETE CASCADE;
alter table public.forma_goal_events add constraint forma_goal_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.forma_goals add constraint forma_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.forma_learning_progress add constraint forma_learning_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.forma_profiles add constraint forma_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.forma_profiles add constraint forma_profiles_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES forma_profiles(id);
alter table public.forma_transactions add constraint forma_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.forma_usage_daily add constraint forma_usage_daily_user_id_fkey FOREIGN KEY (user_id) REFERENCES forma_profiles(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS forma_admin_members_pkey ON public.forma_admin_members USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS forma_budgets_pkey ON public.forma_budgets USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS forma_budgets_user_id_month_category_key ON public.forma_budgets USING btree (user_id, month, category);
CREATE INDEX IF NOT EXISTS idx_forma_budgets_user_month ON public.forma_budgets USING btree (user_id, month);
CREATE INDEX IF NOT EXISTS forma_budgets_owner_month_idx ON public.forma_budgets USING btree (user_id, month);
CREATE UNIQUE INDEX IF NOT EXISTS forma_goal_events_pkey ON public.forma_goal_events USING btree (id);
CREATE INDEX IF NOT EXISTS forma_goal_events_owner_goal_date_idx ON public.forma_goal_events USING btree (user_id, goal_id, occurred_on DESC);
CREATE UNIQUE INDEX IF NOT EXISTS forma_goals_pkey ON public.forma_goals USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS forma_learning_progress_pkey ON public.forma_learning_progress USING btree (user_id, lesson_key);
CREATE UNIQUE INDEX IF NOT EXISTS forma_profiles_pkey ON public.forma_profiles USING btree (id);
CREATE INDEX IF NOT EXISTS idx_forma_profiles_teacher ON public.forma_profiles USING btree (teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS forma_profiles_invite_code_key ON public.forma_profiles USING btree (invite_code);
CREATE UNIQUE INDEX IF NOT EXISTS forma_support_settings_pkey ON public.forma_support_settings USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS forma_transactions_pkey ON public.forma_transactions USING btree (id);
CREATE INDEX IF NOT EXISTS idx_forma_tx_user_date ON public.forma_transactions USING btree (user_id, date DESC);
CREATE INDEX IF NOT EXISTS forma_transactions_owner_date_idx ON public.forma_transactions USING btree (user_id, date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS forma_usage_daily_pkey ON public.forma_usage_daily USING btree (user_id, day, section);
CREATE INDEX IF NOT EXISTS forma_usage_day ON public.forma_usage_daily USING btree (day);
alter table public.forma_profiles enable row level security;revoke all on public.forma_profiles from public,anon,authenticated;
alter table public.forma_budgets enable row level security;revoke all on public.forma_budgets from public,anon,authenticated;
alter table public.forma_transactions enable row level security;revoke all on public.forma_transactions from public,anon,authenticated;
alter table public.forma_goals enable row level security;revoke all on public.forma_goals from public,anon,authenticated;
alter table public.forma_goal_events enable row level security;revoke all on public.forma_goal_events from public,anon,authenticated;
alter table public.forma_learning_progress enable row level security;revoke all on public.forma_learning_progress from public,anon,authenticated;
alter table public.forma_admin_members enable row level security;revoke all on public.forma_admin_members from public,anon,authenticated;
alter table public.forma_support_settings enable row level security;revoke all on public.forma_support_settings from public,anon,authenticated;
alter table public.forma_usage_daily enable row level security;revoke all on public.forma_usage_daily from public,anon,authenticated;
create policy forma_admin_self_read on public.forma_admin_members as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy forma_budget_delete_self on public.forma_budgets as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy forma_budget_insert_self on public.forma_budgets as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy forma_budget_read_self on public.forma_budgets as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy forma_budget_update_self on public.forma_budgets as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy forma_goal_events_insert_self on public.forma_goal_events as PERMISSIVE for INSERT to authenticated with check (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM forma_goals g
  WHERE ((g.id = forma_goal_events.goal_id) AND (g.user_id = ( SELECT auth.uid() AS uid)))))));
create policy forma_goal_events_read_self on public.forma_goal_events as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy forma_goal_delete_self on public.forma_goals as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy forma_goal_insert_self on public.forma_goals as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy forma_goal_read_self on public.forma_goals as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy forma_goal_update_self on public.forma_goals as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy forma_learning_delete_self on public.forma_learning_progress as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy forma_learning_insert_self on public.forma_learning_progress as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
create policy forma_learning_read_self on public.forma_learning_progress as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy forma_profile_insert_self on public.forma_profiles as PERMISSIVE for INSERT to authenticated with check (((id = ( SELECT auth.uid() AS uid)) AND (role = 'student'::text) AND (teacher_id IS NULL) AND (invite_code IS NULL)));
create policy forma_profile_read_self on public.forma_profiles as PERMISSIVE for SELECT to authenticated using ((id = ( SELECT auth.uid() AS uid)));
create policy forma_profile_update_self on public.forma_profiles as PERMISSIVE for UPDATE to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
create policy forma_support_admin_update on public.forma_support_settings as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM forma_admin_members a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid))))) with check ((EXISTS ( SELECT 1
   FROM forma_admin_members a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid)))));
create policy forma_support_read on public.forma_support_settings as PERMISSIVE for SELECT to authenticated using (true);
create policy forma_tx_delete_manual on public.forma_transactions as PERMISSIVE for DELETE to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (source = 'manual'::text)));
create policy forma_tx_insert_manual on public.forma_transactions as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (source = 'manual'::text) AND (external_id IS NULL) AND (amount > (0)::numeric)));
create policy forma_tx_read_self on public.forma_transactions as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy forma_tx_update_manual on public.forma_transactions as PERMISSIVE for UPDATE to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (source = 'manual'::text))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (source = 'manual'::text) AND (external_id IS NULL) AND (amount > (0)::numeric)));
create policy forma_usage_insert on public.forma_usage_daily as PERMISSIVE for INSERT to authenticated with check (((( SELECT auth.uid() AS uid) = user_id) AND (day = CURRENT_DATE) AND ((seen_at >= date_trunc('day'::text, now())) AND (seen_at <= (now() + '00:01:00'::interval)))));
create policy forma_usage_read on public.forma_usage_daily as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy forma_usage_update on public.forma_usage_daily as PERMISSIVE for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = user_id) AND (day = CURRENT_DATE))) with check (((( SELECT auth.uid() AS uid) = user_id) AND (day = CURRENT_DATE) AND ((seen_at >= date_trunc('day'::text, now())) AND (seen_at <= (now() + '00:01:00'::interval)))));
grant SELECT on public.forma_admin_members to authenticated;
grant INSERT on public.forma_budgets to authenticated;
grant SELECT on public.forma_budgets to authenticated;
grant UPDATE on public.forma_budgets to authenticated;
grant DELETE on public.forma_budgets to authenticated;
grant INSERT on public.forma_goal_events to authenticated;
grant SELECT on public.forma_goal_events to authenticated;
grant INSERT on public.forma_goals to authenticated;
grant SELECT on public.forma_goals to authenticated;
grant UPDATE on public.forma_goals to authenticated;
grant DELETE on public.forma_goals to authenticated;
grant INSERT on public.forma_learning_progress to authenticated;
grant SELECT on public.forma_learning_progress to authenticated;
grant DELETE on public.forma_learning_progress to authenticated;
grant SELECT on public.forma_profiles to authenticated;
grant SELECT on public.forma_support_settings to authenticated;
grant UPDATE on public.forma_support_settings to authenticated;
grant SELECT on public.forma_transactions to authenticated;
grant DELETE on public.forma_transactions to authenticated;
grant INSERT on public.forma_usage_daily to authenticated;
grant SELECT on public.forma_usage_daily to authenticated;
grant UPDATE on public.forma_usage_daily to authenticated;
grant INSERT (amount,category,date,description,source,type,user_id) on public.forma_transactions to authenticated;
grant UPDATE (amount,category,date,description,type) on public.forma_transactions to authenticated;
grant INSERT (full_name,id) on public.forma_profiles to authenticated;
grant UPDATE (full_name) on public.forma_profiles to authenticated;
insert into public.forma_support_settings(id) values(true) on conflict do nothing;
create function public.handle_new_forma_user() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.forma_profiles(id,full_name,role) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)),120),'student') on conflict(id) do nothing;return new;end$$;
revoke all on function public.handle_new_forma_user() from public,anon,authenticated;
create trigger on_forma_user_created after insert on auth.users for each row execute function public.handle_new_forma_user();

