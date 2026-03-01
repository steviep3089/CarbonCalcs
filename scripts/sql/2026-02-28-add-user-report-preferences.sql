create table if not exists public.user_report_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_report_email text null,
  google_drive_folder text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_report_preferences enable row level security;

drop policy if exists "user_report_preferences_select_own" on public.user_report_preferences;
create policy "user_report_preferences_select_own"
  on public.user_report_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_report_preferences_insert_own" on public.user_report_preferences;
create policy "user_report_preferences_insert_own"
  on public.user_report_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_report_preferences_update_own" on public.user_report_preferences;
create policy "user_report_preferences_update_own"
  on public.user_report_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
