-- Week 10 · daily screenshot limit (10 per user per day, Mexico City time).
-- Run once in the Supabase SQL editor of the "semestre" project, after w10_tables.sql.
-- Stores only who and when: no image, no extracted data.

create table if not exists public.w10_extraction_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists w10_extraction_log_user_day on public.w10_extraction_log (user_id, created_at);

alter table public.w10_extraction_log enable row level security;

-- Users can read and add their own rows, but not update or delete them (so the count can't be reset).
drop policy if exists "w10 own log read" on public.w10_extraction_log;
create policy "w10 own log read" on public.w10_extraction_log
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "w10 own log insert" on public.w10_extraction_log;
create policy "w10 own log insert" on public.w10_extraction_log
  for insert to authenticated with check (user_id = auth.uid());
