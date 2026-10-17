# DECISIONS — Week 10 · Screenshot-to-Ledger

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-10-12 | Primary vacuum: DEBT GUARDRAIL, not REGRET | AMVO return data points to seller failures; debt harm lasts weeks |
| 2 | 2026-10-12 | No affiliate, lender or seller revenue | Honey/Cleo pattern: revenue from the transaction captures the agent |
| 3 | 2026-10-12 | Agent states facts on its own; applies values only when the user states them | Avoids the Isle's paternalism |
| 4 | 2026-10-12 | Every number carries a source label: from screenshot / you told me / unknown | Facts-only mode is honest only if it admits which facts it has |
| 5 | 2026-10-12 | Whole view carries a completeness label: incomplete / complete as far as you've shown me / incomplete by your choice | Screenshots verify amounts, not that the list is complete |
| 6 | 2026-10-14 | My slice (team Blueprint): screenshot extraction with confirmed fields (C1/C2); calendar + limits are Rafael's | Team declarations |
| 7 | 2026-10-16 | Screenshots are never stored; only confirmed fields | Minimum retention (C4) |
| 8 | 2026-10-16 | Demo uses invented screenshots of a fictional app ("PagaLuego", "CompraYa") | Free Gemini tier may use content to improve Google products; security floor bans real data |
| 9 | 2026-10-16 | Frequency is a required field; month↔quincena conversion done by code only | Memory test: friend added quincenal and monthly payments as equal (MX$1,500 vs. MX$2,500) |
| 10 | 2026-10-16 | Out of scope: credit-card MSI and subscriptions | Different screens and commitment types; recorded as findings |
| 11 | 2026-10-16 | Vision model: `gemini-3.8-flash` (stable free-tier Flash), temperature 0, JSON schema output | Recommended for new projects; accepts images and structured output |
| 12 | 2026-10-16 | Gemini returns the due date as day / month / year parts; if only the year is missing, code uses the next occurrence of that date and the UI says "Leído de captura · año calculado" | Apps often show "30 oct" without a year; the model never fills in data, code does it by a fixed rule and the user confirms it |
| 13 | 2026-10-16 | Each extracted plan is confirmed on its own; a plan may be saved with unknown fields (it goes to "Sin fecha") | Unknown is honest; blocking the save would push users to guess |
| 14 | 2026-10-16 | SIMULADO data only when `SIMULATE_AI=true`. If Gemini fails (quota, timeout, error) with `SIMULATE_AI=false`, show "No pude leer la captura ahora. Intenta más tarde o captúralo a mano." | Example data must never look like a reading of the user's own screenshot |
| 15 | 2026-10-16 | Plans saved from SIMULADO carry `field_sources.simulated = true`; they are listed with the tag and "no se suma", never added to quincena totals | Invented amounts must not inflate what the user thinks they owe |
| 16 | 2026-10-16 | One line per saved plan in the quincena table, even with the same app name | Two purchases on one app are two commitments |
| 17 | 2026-10-16 | The user can delete any saved plan (server route + RLS, with "¿Borrar este plan?") | Blueprint condition 3: the user can correct or delete their data |
| 18 | 2026-10-16 | Saving a new plan resets "completa hasta donde me has mostrado" to "incompleta" | A new app means the earlier "these are all" was not true |
| 19 | 2026-10-16 | "Capturar a mano": same fields and validations; every typed value is "Tú me lo dijiste"; never marked SIMULADO | A way forward when the screenshot can't be read or the quota is used up |
| 20 | 2026-10-16 | Limit of 10 screenshots per user per Mexico City day (`w10_extraction_log`: who and when only; RLS insert/select, no delete). Fails open if the table is missing | Free Gemini quota is 20 requests/day per project for `gemini-3.8-flash` |
| 21 | 2026-10-16 | Gemini timeout raised from 25 s to 45 s (route `maxDuration` 60 s) | The blurry eval screenshot took longer than 25 s |
| 22 | 2026-10-16 | Next.js 15.5.4 → 15.5.28 and React 19.1.0 → 19.1.10 | Vercel blocks deploys of 15.5.4 (CVE-2025-66478) |
| 23 | 2026-10-16 | Eval set: 8 invented screenshots covering PACKET §11; `npm run eval` paces requests (13 s) and stops on quota errors instead of scoring them | One run = 8 of the 20 daily free requests; a quota error says nothing about extraction quality |
| 24 | 2026-10-17 | `npm run eval` also stops with "Sin resultado" on a Gemini 503; timeouts still count as failures | A 503 is a Google outage, not a misreading; a slow screenshot is a real failure for the user |
| 25 | 2026-10-17 | "Tu próxima quincena" card at the top, under the greeting: "Del 1 al 15 de nov pagas $X" (next quincena, fixed rules), "Esta quincena (16–31 oct): $Y", the completeness tag next to the total, a note when plans without a date are left out, and "[app] vence hoy". SIMULADO amounts are never added and never alert | Persona test: the user never found the answer to their own question; the answer now comes first |
| 26 | 2026-10-17 | Before saving a plan (read or typed) that matches a saved one on app, amount, next date and frequency, ask "Ya tienes un plan igual de [app]. ¿Es otra compra o el mismo?" — "Es otra compra, guardar" / "Es el mismo, no guardar" (+ "Volver a revisar"). Checked on the server (409); names compared ignoring case and spaces, amounts in centavos | Persona test: duplicated plans made the user distrust the totals; two real purchases can still look identical, so the user decides |
| 27 | 2026-10-17 | While editing the due date ("Capturar a mano" and "Corregir"), show it in words under the field ("17 nov 2026") | Avoids day/month confusion when typing a date |
| 28 | 2026-10-17 | A captured due date that already passed shows, in grey: "La fecha que capturaste de [app] (10 oct) ya pasó. Sube una captura nueva para actualizarla." Never "venció" | The app only knows the captured date, not whether the user already paid; it must not claim a debt is overdue |

## Persona test

| Date | Finding | Change |
|---|---|---|
| 2026-10-17 | The user never found the answer to their question ("¿cuánto pago la próxima quincena?"): the totals were below the upload form and the review cards | Decision 25: "Tu próxima quincena" card at the top |
| 2026-10-17 | The user distrusted the app because the same plan appeared twice (saved twice from the same screenshot) | Decision 26: ask before saving a plan identical to a saved one |
| 2026-10-17 | Risk of day/month confusion when typing a date by hand | Decision 27: date in words under the field |
| 2026-10-17 | Review of the new card: "venció" asserted something the app can't know | Decision 28: neutral grey wording that asks for a new screenshot |

## Eval results

| Date | Model | Fields correct | Invented values | Screens right | Notes |
|---|---|---|---|---|---|
| 2026-10-16 | gemini-3.8-flash | 35/40 (87.5%) — target ≥ 95% | **0** — target 0 | 7/8 | 7 of 8 screenshots perfect, including "5 ene" without a year and $12,345.67. `borrosa.png` failed only because Gemini didn't answer within the 25 s timeout, so its 5 fields counted as wrong (no value was invented). A second run the same day hit the free-tier quota (429: 20 requests/day, 5/minute) and gave no result. |
| 2026-10-17 | gemini-3.8-flash | — (10/40 scored) | **0** | 1/8 | **Corrida invalidada por 503/timeouts de Google; 0 valores inventados; dosplanes.png 10/10.** 3 screenshots got `503 UNAVAILABLE` ("high demand") and 4 hit the 45 s timeout, including clean ones that took ~5 s the day before. Not a measure of extraction quality. |

## Checked, not a bug
- 2026-10-16 — A plan showed $413.00 instead of $412.50. Code keeps exact centavos end to end and `installment_amount` is `numeric(10,2)` (`numeric_scale = 2`); the 413 was a value typed while testing Corregir. Test added that pins $412.50 = 41250 centavos.

## Open
- Run `supabase/migrations/w10_extraction_log.sql` in the Supabase SQL editor (the daily limit is inactive until then).
- Pick the free model with the most requests/day that accepts images. Google's docs don't publish free-tier numbers per model (only "view your active rate limits in AI Studio"); limits are per project, reset at midnight Pacific time and are not guaranteed. Image + structured-output candidates: `gemini-3.8-flash` (20/day, 5/min, from the API's own 429), `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` — compare them in AI Studio before switching.

## Next first move
Re-run `npm run eval` only when Fátima says so (the 2026-10-17 run was invalidated by Google 503s/timeouts). If it passes (≥ 95% fields, 0 invented, 8/8 screens), record it under Eval results; if not, look at the failing fixture before touching the prompt.
