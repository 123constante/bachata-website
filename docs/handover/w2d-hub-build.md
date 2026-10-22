# Handover: W2-D person hub build (option C)

Ticket dt_aee601072cb9. Branch `claude/w2d-hub-build` off `main` at a48ccd3. Head SHA: the commit that carries this file
(subject ends `[worker-done dt_aee601072cb9]`). PR: opened by the bot right after the push (the PR body has the number).
Design record with all numbers: [`docs/design/w2d-hub-build.md`](../design/w2d-hub-build.md).

## Done
- Hub option C behind `flags.personHub`: hero card for the main role (big "Open <role> page" button + what it opens), Also
  row for every other HELD role (closed Teacher = dashed card, not a link, "Teacher pages open soon"), About line.
- One-role (and no-role) people skip the hub: `/people/:id` 302s to the page their wall tile opens. ONE rule,
  `personDestination` in `src/modules/person-page/badges.ts`, used by the tile, the redirect and the hub.
- Fade into the orange footer, hub route only (index.css `body:has([data-hub-footer-join])`); seam step 3/255.
- Late gig list: the loader fetches the person's badges row, so the lead is fixed on first paint; the gig line has a
  reserved row and says "Checking for gigs..." until the list lands.
- Bundled fix: dead photo URL on a wall tile / hub face -> initials (shared `wall/usePhotoFallback.ts`).
- Removed the old hub parts with no importer left: `RoleCard.tsx`, `NextEventButton.tsx`, `FactsStrip.tsx` and their tests
  (`hubCritique`, `hubHeldRoles`), whose rules live on in `hub.test.tsx` and `destinationMatrix.test.tsx`.

## Tests written RED first
- `hub/__tests__/destinationMatrix.test.tsx` on main a48ccd3: 29 failed / 13 passed; now 42/42.
- `wall/__tests__/photoFallback.test.tsx` with main's WallTile: 1 failed / 2 passed; now 3/3.

## CI jobs run in the sandbox (per job)
| Job | Result |
|---|---|
| typecheck (check:rpc-typing, wallclock-brand) | pass; full tsc 100 errors vs baseline 106, none new in PR files |
| architecture-guard (all steps incl. check:images AUDIT_STRICT=1) | pass |
| unit-tests London | 16 fails, all sandbox: live contract tests (sandbox Supabase is not prod), integrityCouldNotRun + datesCard also fail on base a48ccd3 |
| unit-tests New_York / Sydney, timing, dancer-area-isolation | pass |
| workflow-lint (4 jobs) | pass |
| perf-budget bundle-budget | pass (bundle sizes identical to base) |
| e2e-smoke | pass (159 passed, 5 skipped, 1 flaky passed on retry) |
| phone-qa + build-smoke | pass |
| db-contract-check | live-db-gate pass; contract steps not representative (sandbox DB is not prod) |
| phone-qa-section, real-data-verified | need the PR body sections (filled in the PR) |
| pre-ship | pass except check:integrity (local exec bit; `bash bin/check-integrity.sh` = ok) |

## Not verified
Real photos (media host blocked from the sandbox, all faces are the initials fallback in screenshots); what the Jxjx URL
really returns; a real phone; the Vercel build of this branch; live contract suites (need CI secrets).

## Next steps
1. Check the PR checks on GitHub (live suites run there with prod secrets).
2. Owner phone test after merge + deploy (prod flag is ON, so the hub changes at deploy).
3. Separate small fixes noticed: `bin/check-integrity.sh` is not executable in git (local runs fail with 126);
   `datesCard.consistency.test.tsx` fails on main (looks date-dependent).
