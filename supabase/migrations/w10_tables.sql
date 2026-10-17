-- Week 10 · Mis pagos a plazos
-- Run once in the Supabase SQL editor of the "semestre" project.
-- Tables are prefixed w10_ so they don't collide with other weeks.

create table if not exists public.w10_payment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider_name text check (char_length(provider_name) <= 60),
  installment_amount numeric(10,2) check (installment_amount between 0 and 100000),
  payments_remaining int check (payments_remaining between 0 and 60),
  next_due_date date,
  frequency text check (frequency in ('semanal','quincenal','mensual')),
  field_sources jsonb not null,
  confirmed_at timestamptz not null default now()
);

create table if not exists public.w10_ledger_status (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  completeness text not null default 'incomplete'
    check (completeness in ('incomplete','complete_as_shown','incomplete_by_choice')),
  updated_at timestamptz not null default now()
);

alter table public.w10_payment_plans enable row level security;
alter table public.w10_ledger_status enable row level security;

drop policy if exists "w10 own plans" on public.w10_payment_plans;
create policy "w10 own plans" on public.w10_payment_plans
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "w10 own status" on public.w10_ledger_status;
create policy "w10 own status" on public.w10_ledger_status
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RLS check (run while signed in as user B in the app, or via the API):
-- select count(*) from w10_payment_plans;  -- must return only B's rows
