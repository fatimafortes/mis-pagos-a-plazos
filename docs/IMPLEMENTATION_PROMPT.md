# Implementation prompt — Screenshot-to-Ledger (Week 10)

You are my coding agent. Build the slice described in `docs/PACKET.md`. Work feature by feature, in the order below. After each feature: run its tests, commit with the given message, and stop for me to check. Never commit secrets.

## Product in one paragraph

A signed-in user uploads a screenshot of an installment-app payments screen. A vision LLM extracts the plan into a fixed JSON schema; anything not visible is `null`. The user reviews each field (with a source label), corrects or confirms, and the confirmed plan is saved. Deterministic code buckets payments into quincenas and shows totals, a "Sin fecha" row for plans without a date, and a completeness banner. The screenshot is never stored.

## Stack (free tiers only)

- Next.js (App Router) + TypeScript, deployed on Vercel.
- Supabase: Auth (Google sign-in) + Postgres with Row Level Security. Use `@supabase/ssr`.
- Gemini API with image input and structured JSON output, called **only from a server route**. Use the current free-tier Flash model (check the name in Google's docs).
- Zod for validation. Vitest for unit tests.
- Env vars (Vercel + `.env.local`, never committed): `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SIMULATE_AI` (true/false).

## Hard rules

1. The LLM never does arithmetic and never judges affordability. All totals come from `lib/quincenas.ts`.
2. Images live in memory for the request only. No Supabase Storage bucket. No image column.
3. Every field has a source: `screenshot` | `user` | `unknown`. Editing a field sets it to `user`.
4. If `SIMULATE_AI=true` or the API fails, return a canned extraction and show a visible **SIMULADO** tag.
5. All UI text in Spanish (Mexico). A "Datos inventados · demo" tag on every screen.
6. Validate every input on the server, even if the client already did.

## Data model (SQL migration)

```sql
create table payment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_name text check (char_length(provider_name) <= 60),
  installment_amount numeric(10,2) check (installment_amount between 0 and 100000),
  payments_remaining int check (payments_remaining between 0 and 60),
  next_due_date date,
  frequency text check (frequency in ('semanal','quincenal','mensual')),
  field_sources jsonb not null,
  confirmed_at timestamptz not null default now()
);
create table ledger_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completeness text not null default 'incomplete'
    check (completeness in ('incomplete','complete_as_shown','incomplete_by_choice')),
  updated_at timestamptz not null default now()
);
alter table payment_plans enable row level security;
alter table ledger_status enable row level security;
create policy "own plans" on payment_plans for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own status" on ledger_status for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

## Extraction schema (what the LLM must return)

```json
{
  "is_payment_screen": true,
  "plans": [
    {
      "provider_name": "string | null",
      "installment_amount": "number | null",
      "payments_remaining": "integer | null",
      "next_due_date": "YYYY-MM-DD | null",
      "frequency": "semanal | quincenal | mensual | null"
    }
  ]
}
```

System prompt essentials: "Extract only what is visibly written. If a value is not visible, return null. Never infer, estimate or calculate. If the image is not an installment payments screen, return is_payment_screen: false and plans: []."

## Quincena rules (`lib/quincenas.ts`)

- Quincena 1 = days 1–15; quincena 2 = day 16 to month end.
- Horizon: the next 6 quincenas from today.
- First payment = `next_due_date`. Then:
  - `quincenal`: one payment in each following quincena.
  - `mensual`: same day next month, clamped to month end (Jan 31 → Feb 28/29).
  - `semanal`: +7 days.
- Stop after `payments_remaining` payments.
- If `next_due_date` or `frequency` is null → the plan goes to "Sin fecha" with total = amount × payments (or "desconocido" if either is null).
- Amounts are summed in integer centavos to avoid float errors.

## Features, acceptance criteria, commits

| # | Feature | Acceptance criteria | Commit message |
|---|---|---|---|
| F0 | Scaffold + deploy | Next.js app live on Vercel; `.env*` in `.gitignore` | `chore: scaffold next app` → **Deploy 1** |
| F1 | Auth | Google sign-in works; `/app` redirects to login when signed out | `feat: supabase google auth` |
| F2 | Database + RLS | Migration applied; with two accounts, B cannot read A's rows | `feat: tables with row level security` |
| F3 | Quincena engine | Vitest passes: day 15 vs 16, Feb month-end, mensual clamp, quincenal sequence, null date → Sin fecha, centavos sum | `feat: deterministic quincena engine` |
| F4 | Upload + validation | Rejects non-png/jpg and > 5 MB (client + server); nothing written to storage | `feat: screenshot upload with validation` |
| F5 | Extraction route | Returns schema-valid JSON; Zod rejects bad output; out-of-range values → null; non-payment screen → friendly rejection; SIMULATE_AI path shows SIMULADO | `feat: vision extraction with schema` |
| F6 | Review screen | Each field shows value + source tag; editing flips tag to "Tú me lo dijiste"; Confirmar saves; Corregir lets user edit | `feat: review and confirm screen` |
| F7 | Results screen | Quincena table, Sin fecha row, completeness banner (default incomplete), "¿Ya me mostraste todas…?" updates status; note "MSI de tarjeta no incluidos" | `feat: quincena results and completeness` → **Deploy 2** |
| F8 | Eval set | `tests/fixtures/` with 8 invented screenshots + `expected.json`; `npm run eval` prints field accuracy and count of invented values | `test: synthetic screenshot eval` |

## Session close (every session)

Update `docs/DECISIONS.md`, write tomorrow's first move, commit, push.
