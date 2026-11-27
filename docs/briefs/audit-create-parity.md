# Brief: audit create-flow parity before old-area retirement (READ-ONLY, docs only), Sonnet

Branch `claude/audit-create-parity` (push ONLY here, ONE push, one file `docs/review/audit-create-parity.md`). No code change. Supabase read-only (prod `stsdtacfauprzrdebmzg`, counts only, no personal data). Under 40% context. Final commit subject ends `[worker-done <ticket>]`.

## Why
The new P3 create flow (`src/modules/organiser/p3/`, route `P3_PATHS.create`) shows "Coming soon" for Course, Festival and Online kinds. Prod has live courses (6+1) and festivals (8). The old organiser area (`src/modules/organiser/events/`, `organiser/shared/createModel.ts`) is due to be retired from 2026-10-31 17:00Z. Nobody may lose a capability silently.

## Do
1. INVENTORY first: a table of every thing a person can CREATE or EDIT in the old area (each kind: weekly, one-off, course, festival, online, series, copy; each field group; each image/gallery capability incl. multi-picture gallery) vs the new P3 area vs the admin app. file:line for each. Mark each row HAS / GAP / DEFERRED-ON-PURPOSE (cite the doc that says so: `docs/organiser-rebuild/`, `docs/acceptance/` if present, plans in the repo).
2. For each GAP: who is hurt (prod counts of live items of that kind, how many distinct organisers own them), and whether the old area can still do it today (read the code path, do not guess).
3. End with a coverage count (N rows, N HAS, N GAP, N DEFERRED) and a one-line RETIRE-SAFE verdict per capability: YES / NO-BLOCKS-RETIREMENT.
Do not propose designs. Do not touch other files.
