# Brief F-INT -- fix pass on the R1 integration branch (S4 gates + festival Home row)

Repo `123constante/bachata-website`. Work and push ONLY `claude/org-r1-integrate` (already carries S1+S2+S3(fixed)+S4 merged; head 7e506a34). READ FIRST: `docs/organiser-rebuild/handovers/INTEGRATE.md` on that branch (findings F1-F4 with file:line) and `docs/organiser-rebuild/briefs/00-COMMON.md`. This is the ONE fix pass; a continuation worker is normal if you run PARTIAL.

## Fix exactly these
- **F1** `lint:architecture` bans the literal `organiser_ids`: reword the comment at `src/modules/organiser/flows/new/model.ts:26`; in `flows/new/__tests__/NewFlow.test.tsx` (lines ~90, 92, 151) assert the payload key via the same constant/builder `createSeriesCommand` uses, never the banned literal. Do NOT touch `allowFiles` or any guard.
- **F2** `flows/new/NewFlow.tsx:279` cover preview `<img>`: add `loading="eager"` (above the fold) so `check:images` (AUDIT_STRICT=1) passes.
- **F3** the 7 e2e failures from the retired `NewEventPage`: rewrite the specs in `tests/e2e/organiser-events.spec.ts` (lines 15, 64, 96 at 390 and 360, 267) and `tests/e2e/organiser-layout.spec.ts` (79-80, 174) against the S4 one-question flow (`/account/o/new/what`, `org-new-*` testids), or delete a spec that S4's own spec already covers (say which in the handover). Keep the `test:e2e` list in package.json correct by name. The 3 failures also red on base (`organiser-loop`, `organiser-events:257` schedule card, `dancer-app/home-nights`) are NOT yours.
- **F4 (owner-default decision, log it)**: a live FESTIVAL whose coming dates are all gone must not get a Home `no_dates_left` row (it leads to a C8 with every day disabled). In `src/modules/organiser/jobs/homeJobs.ts` (`seriesProblems`, ~line 39) skip `no_dates_left` when `format === 'festival'`; do not route it elsewhere. Table-driven test over format x coming-date-count x past-dates (festival with only past date = NO row; non-festival with zero coming = still a row; festival with coming date = no row). Run the new test against the UNFIXED code first and paste the red.
- Also fix the stale comment naming `NewEventPage` at `edit-in-place/parts.tsx:219-221` (wording only).

## Verify (command + exit code in a table in the handover)
Re-run EVERY step that was red or touched: `lint:architecture`, `check:images` (AUDIT_STRICT=1), `npm run lint`, `typecheck` (96 errors = base; no new), `test:unit` for `src/modules/organiser`, the changed e2e specs, `npm run build`. Report the e2e count (was 137 pass / 10 fail; target: only the 3 base failures left).

## Rules
Plain git only (never `gh api`). Commands without variables, loops or `$(...)`. Never `--no-verify`. ONE push at the end (Vercel cap; claude/* no longer deploys). Handover `docs/organiser-rebuild/handovers/INTEGRATE-FIX.md` with Verified / Not verified. Under 30% context; at 25% start nothing new; by 30% push + handover, last subject ending `PARTIAL [worker-done <ticket>]`; final subject ends `[worker-done <ticket>]`.
