# FIX-PAR-FINAL: the last finishing pass on PR #809 (REVIEW-PAR-C S1, N2, N4)

- Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/F-PAR-final.md` (blob afdadd0). Ticket dt_efc1b42c27cf.
- Branch: `claude/org-r1-integrate`, from 6c33ffa. ONE push (this commit).
- Scope: exactly the three items the owner chose. Nothing else changed. No migration, no prod write. The density-exempt calendar files and `ui/dialog.tsx` were not touched.

## Done

- **S1. Pick several on a weekly or monthly series.** `Pick.tsx`: when `shiftRefusal(recurrence_rule)` is set, its reason ("Dates of a repeating event can&rsquo;t be moved together. Change the repeat instead.") stands in place of the Earlier / Later chips, the days box and Move (`change-pick-shift-off`). "Cancel the ticked dates" is unchanged and still works on a weekly series. The move reason no longer carries `shiftOff`, because Move is not rendered there.
- **N2. Change time on a festival.** There is now one shared mapping in `changeModel.ts`:
  - `isFestival(series)` mirrors the server's own test in `_cmd_occurrence_set_time_p5`: `format = 'festival' OR festival_id IS NOT NULL`. This was read from prod on 2026-10-18.
  - `FESTIVAL_TIME` reads "Festival times are set for the whole festival, not one date."
  - `festivalTimeNext(editable)` gives the way forward. If the date's sessions can change here, it says "Change a session&rsquo;s time in this date&rsquo;s sessions." and shows an **Open Sessions** button. Otherwise (multi-day) it says "Ask the Bachata Calendar team to change it for you."
  - Which date shows `FESTIVAL_TIME` under the list. Every row already has its Sessions button.
  - Change what disables "Change the time" and shows `FESTIVAL_TIME` as its sub-line. Sessions and line-up sits just above it.
  - The Time screen refuses before any form (`change-time-festival`). This also covers a direct URL.
  - `WorkspaceSeries` gains an optional `festival_id`, parsed if the read sends it.
- **N4. Pick several with 0 coming dates.** The screen renders only `NO_COMING` and the Add a date link. The action block (count, Cancel, the move controls) renders only when `dates.length > 0`.
- `consistency.dates.matrix.test.tsx` used to pin the old (wrong) festival behaviour: it expected the full Change time form on `live-festival`. It now asserts the refusal. Its Change-what row check also asserts that `change-time` is disabled exactly on festival shapes.

## Red first (each test was run against the unfixed code at 6c33ffa, then against the fix)

`pdates.flow.test.tsx` on the unfixed code: **13 failed, 62 passed**. The new shapes that must NOT change were already green there: no rule, one-off, normal, normal multi-day.

| item | test (pdates.flow > ...) | red on unfixed code | green |
|---|---|---|---|
| S1 | `F-PAR-final S1 > 'weekly' / 'monthly': the shift controls show only when the server can move the dates` | `change-pick-earlier: expected true to be false` (chips rendered on a weekly / monthly series) | yes |
| S1 | `F-PAR-final S1 > 'no rule' / 'one-off'` | green before and after: the controls stay where the server can shift | yes |
| S1 | `F-PAR-final S1 > cancelling ticked dates still works on a weekly series` | green before and after (a regression guard) | yes |
| S1 | `P-DATES pick several > move together is replaced by the reason on a weekly repeat` (replaces the old "disabled with the reason" test) | `expected <button ...change-pick-move> to be null` | yes |
| N4 | `F-PAR-final N4 > renders NO_COMING and Add a date, and no action block` | `change-pick-count: expected <p> to be null` | yes |
| N2 | `F-PAR-final N2 > festival / festival multi-day / linked to a festival: Which date says it once` | `expected null to be 'Festival times are set...'` (and `FESTIVAL_TIME` undefined) | yes |
| N2 | `... : Change what disables Change the time with the same words` | `expected false to be true` (row enabled) | yes |
| N2 | `... : the Time screen refuses before the form, with a way forward` | `Unable to find change-time-festival`, because the form rendered | yes |
| N2 | `normal`, `normal multi-day` x3 screens | green before and after (no refusal) | yes |
| N2 | `consistency.dates.matrix > live-festival: Change time ...` (updated) | the old version pinned the form, so it went red after the fix and was then updated to the refusal | yes |

The red log was captured from `npx vitest run src/modules/organiser/flows/change/__tests__/pdates.flow.test.tsx` before any source change.

## Queued (NOT fixed, per the brief)

- **N1.** The server's set_time START delta ignores midnight. `v_delta := v_new_start - min(eff_start)` on the plain clock, so on a 21:00-00:00 party + 00:30-04:00 after-party night, typing 22:00 moves every session by +21 h 30. The fix belongs in admin: extend the `_cmd_occurrence_set_time_p5` defect to use the night-ordered first start, not `min(eff_start)`. 0 prod reach today.
- **N3.** "with their own changes stay" can miss a date that holds a reason-only override row (`keepsOwnChanges` vs `_occurrence_is_curated_v1`). 0 prod reach.
- **N5.** NO_COMING reads "so nothing repeats" on Pick several too. Whether Pick gets its own sentence is the owner's call.
- **N6.** END_GUARD reach is 394 of 1,839 coming non-festival dates (21%). The guard also shows "Open Sessions" beside a "Change one session's time" row that goes to the same place. This is harmless.
- **Observed, not in scope:**
  - The Which-date "Pick several dates" row still says "Cancel or move them together" on a weekly series, where only cancel can work.
  - `organiser_home_v1` and `admin_event_workspace_p5` do not name `festival_id` in their source. If the workspace's series snapshot leaves it out, a series that has a `festival_id` but a non-festival format would not be caught client-side. Prod has 0 such rows, so 0 reach.

## CI, per job (run in this sandbox, in the foreground, on the final tree)

| job | command | exit |
|---|---|---|
| typecheck | `npm run check:rpc-typing`; `npm run check:wallclock-brand` | 0; 0 |
| typecheck (tsc, informational) | `npx tsc -p tsconfig.app.json --noEmit` | 97 errors on base 6c33ffa, 97 with this change; none in the touched files |
| unit-tests | `TZ=Europe/London env -u NODE_PATH npm run test:unit:offline` | 0 (394 files, 9328 pass, 18 skip) |
| unit-tests (touched area) | `npx vitest run src/modules/organiser/flows/change src/modules/organiser/__tests__/consistency.dates.matrix.test.tsx src/modules/organiser/__tests__/consistency.matrix.test.tsx` | 0 (6 files, 303 pass) |
| lint chain | `npm run lint` (after `chmod +x bin/*.sh .claude/hooks/*.sh`, as CI does) | 0 (20 of 20 links green) |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images`; `npm run check:mojibake` | 0; 0 |
| perf-budget | `npm run build` with the workflow's placeholder env; `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles`, `check:bundle-budget:self-test` | 0 each |
| e2e-smoke | `CI=true npm run test:e2e` with the workflow's env | 0 (156 pass, 1 skip, 2 flaky that passed on the CI retry, both in `dancer-home.spec.ts`, which this change does not touch; 5.8 m) |
| lighthouse, doc-weight, types-drift, live DB contract suites | -- | NOT RUN: they need a deploy or secrets |

An earlier full unit run (before the matrix update) caught two failures, and both are fixed:
- `consistency.dates.matrix` pinned the festival form.
- `consistency.matrix` B-N8 found a raw U+2019 in `festivalTimeNext`; it is now `’`.

## Walk (390x844, production build, route-mocked organiser fake, throwaway spec not committed)

- Setup: `VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build` with the perf-budget placeholder env, served by `scripts/_serve-build.mjs --port 4173`. The fake is `tests/e2e/helpers/organiserFake.ts`, with a one-off, a festival and a 0-coming weekly series added.
- Trap: run Playwright with the same `VITE_SUPABASE_URL` as the build. This sandbox's env carries a different project URL, so the fake's session key missed and every page bounced to /auth.
- Result: 4 of 4 pass, with no horizontal scroll on any screen. Shots are in `docs/organiser-rebuild/walk-FINAL/`:
  - **Pick several, weekly** (`pick-weekly-01`, `-02-bottom`, `-03-cancel-confirm`): the reason sits under "Cancel the ticked dates". There are no chips, days box or Move. Cancel opens its confirm.
  - **Pick several, one-off** (`pick-oneoff-01`): Earlier / Later, the days box and Move are all there, with no refusal line.
  - **Change time, festival** (`festival-01-which-date`, `-02-change-what`, `-03-time`):
    - Which date shows the line.
    - "Change the time" is greyed, with the same words.
    - The Time URL shows the reason, the way forward and Open Sessions (at least 44 px). There is no time input.
  - **Pick several, 0 coming dates** (`pick-none-01`): only `NO_COMING` and Add a date.

## Verified

- Prod (read-only, 2026-10-18):
  - `_cmd_occurrence_set_time_p5` sets `v_is_festival := s.format = 'festival' OR s.festival_id IS NOT NULL` and raises `per-date time is not supported for festivals`.
  - Live festivals: 7 series, 6 coming scheduled dates, all `format = 'festival'`, and 0 with `festival_id`.
  - Archived festivals: 5, with 0 coming dates.
- Every shape the brief names has a table-driven test:
  - S1: weekly, monthly, no rule, one-off.
  - N2: festival, festival multi-day, normal, plus "linked to a festival" and normal multi-day.
- All the CI steps above pass, and so does the production-build walk at 390x844.

## Not verified

- Not run on a phone or on a real signed-in prod account. The walk uses the route-mocked fake.
- Whether `admin_event_workspace_p5`'s series snapshot actually carries `festival_id`. I could not call it without an actor. It has 0 prod reach either way.
- GitHub Actions results on the pushed head. See the report that goes with this push.
- The Vercel preview. VERCEL_TOKEN was not used.

## Next steps

- The owner (Ricky) does the phone test of the four walked screens on the preview.
- Owner calls: N5 (Pick's own empty sentence), and the "Cancel or move them together" sub-line on a weekly series.
- Admin repo: the N1 set_time start-delta fix.
