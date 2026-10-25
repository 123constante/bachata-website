# S-POLISH handover (three defects from the S-MERGE walk, PR #809)

Branch `claude/org-r1-integrate`, one push. Status: DONE (all three fixed).

## Changes
- **1 Sheet title.** `flows/newpage/model.ts` adds `NEW_PAGE_TITLE = 'New organiser page'` and `newPageSheetTitle(step, refusal)` (ONE mapping). `NewPageFlow.tsx` reports its refusal kind through a new optional `onRefusalChange` prop; `home/onboarding/OrganiserSheet.tsx` uses `newPageSheetTitle` for the header, hides Back while a refusal shows, and resets the kind on close / new task. Covers name_taken, cap, invite, other.
- **2 Team full.** `shared/teamModel.ts` adds `teamIsFull(count, serverSaidFull)` (uses `TEAM_CAP`). `team/AddSomeone.tsx`: a server `team_full` sets `serverFull`, which disables faces/results like the at-cap state, keeps `add-error` (cap copy) on screen (not cleared), and hides the duplicate `add-full` line. The "Share an invite link" row is no longer disabled when full (brief: it stays). The consistency matrix row "Invite on a full team" (which asserted that row disabled) is replaced by a comment: owner decision from the brief.
- **3 Past chevron.** `events/EventList.tsx`: `size={16}`, `block shrink-0 self-center`; row stays `min-h-[44px]`. Measured at 390: icon 16x16, toggle 44px tall collapsed and open (no shift). Honest note: the S-MERGE glyph looked like a mid-rotation capture (transition-transform); my first retake showed the same until I waited 500 ms. The change is defensive plus the walk now waits for the transition.

## Tests (new)
- `home/__tests__/SheetTitle.test.tsx` (5): table over name_taken / cap / invite / other, header = `NEW_PAGE_TITLE`, not "City", no Back.
- `team/__tests__/Team.test.tsx`: member count x {under cap, at cap, server team_full} (3 rows).
- Walk spec `tests/e2e/walk-spolish.spec.ts` (throwaway, not in `test:e2e`).

## Red-first (new tests vs unfixed OrganiserSheet.tsx + AddSomeone.tsx)
6 failed | 22 passed: 4 SheetTitle (all four kinds), at-cap row (invite row was disabled), server-team_full row (faces stayed enabled).
After fix: 48 passed in the new/team files.

## Mutations
| Mutation | Result |
|---|---|
| header override skipped for `invite` | 1 red (invite row) |
| `teamIsFull` ignores count | 2 red (at 20 tests) |
| `teamIsFull` always false | 3 red (both at-cap + server row) |

## Checks (local; GitHub Actions not consulted)
| Command | Exit |
|---|---|
| `npx vitest run src/modules/organiser src/modules/admin-organisers` | pass (after removing the superseded matrix row): 121 files, 3431+ tests |
| `npm run lint` | 1 of 20 links FAIL: `check:integrity` exit 126 = `bin/check-integrity.sh` has no exec bit in this sandbox; `bash bin/check-integrity.sh` = ok (1983 files, 0 issues). Others PASS. eslint link skipped by the chain because of that |
| `tsc --noEmit -p tsconfig.app.json` | pre-existing errors elsewhere (Venues.tsx, venuePublicService.ts, two organiser test files untouched by me); none in files I changed |
| `npm run build` (plain and with `VITE_ENABLE_ORGANISER_SELF_SERVE=true`) | 0 |
| Playwright `walk-spolish.spec.ts` on prod build | 6 passed, tap audit: no findings |
Not run: e2e-smoke gate, db-contract-check, check:og, check:images AUDIT_STRICT, pre-ship.

## Screenshots `docs/organiser-rebuild/walk-SPOLISH/` (all read)
a-invite-required, b1-name-taken, b2-cap (header "New organiser page"), c1-team-full-after-server (faces dimmed/disabled, message kept, share row live), c2-team-at-20 ("This team is full (20)"), d1/d2 Past collapsed/open (chevron 16px, centred).

## Verified / Not verified
Verified: the above on mocked backend at 390x844, prod build.
Not verified: a real phone, real Supabase answers (no shape survey run: change is UI state only), real fonts/zoom.

## Decisions
- Share-invite row stays enabled when full (brief), so the matrix row was dropped, not rewritten.
- Refusal kind lifted via callback, not by moving refusal state into the sheet.
