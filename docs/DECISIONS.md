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

## Next first move
Scaffold Next.js + Supabase, deploy an empty page to Vercel (commit 1, deploy 1).
