# Review: Going P2 (PR #992), head `0051c372`

Independent code review. I did not build this PR and changed no code.

**Verdict: SHIP-WITH-FIXES**

With the switch OFF, no going feature can switch on in production. I proved this from the code and with a scratch Vite build. The module's mapping is complete and correct.

You must know one thing before merging. Deleting the old attendance code changes **6 things that visitors and dancers see on production, even with the switch OFF** (rows 1&ndash;6). None of them were behind the switch before. If you accept them, nothing here blocks the merge. Rows 7&ndash;14 are smaller fixes to tests and guards.

| # | Severity | File:line | Finding | Concrete failure scenario | Suggested fix |
|---|---|---|---|---|---|
| 1 | should (owner must accept) | `src/pages/Dancers.tsx` (main :392-509, removed) | The "Your Plans" block on `/dancers` is gone for everyone. This was the Events/Festivals "0 saved &middot; Sign in to track..." cards, plus "Going: x &middot; Interested: y" for signed-in dancers. It was never behind the switch. | Every visitor to `/dancers` sees the page go straight from the directory to "Find A Dance Partner". The removal is clean, with no empty heading left behind. | Accept it (the brief deletes every caller of the old RPCs), or say so and it can go back as a plain sign-in card. |
| 2 | should (owner must accept) | `src/pages/DancerProfile.tsx` (main :295/:392/:451), `PublicDancerPageV2.tsx` | The "Your plans" block a dancer saw on their OWN page is gone. It was shown whenever the dancer viewed their own page, with no switch check. "Going next" stays hidden while the switch is off (`public-page/model.ts:216`). | A dancer opens their own page and the plans block is no longer there. | Accept. |
| 3 | should (owner must accept) | `src/pages/MyAttendance.tsx:174-190` (main :98, :166, :228-275) | `/account/attendance` read `get_my_event_attendance_v2` with no switch check. It listed nights and offered "Rate the dancing level" links on past ones. Now everyone gets "No nights to show yet." and a Browse events button. | The few dancers with old rows (main's own comment says prod has about 3) lose their list and its rating links. | Accept (the old rows are going+interested and P5 retires them), or keep the old list until the switch goes on. |
| 4 | should (owner must accept) | `src/modules/dancer-app/screens/nights/NightsScreen.tsx:182` (main :54, :96-140) | The `/app` Nights tab used to show Upcoming and Past lists from the old RPC, with a level vote on past rows. Now it always shows `NightsOff`: "No nights to show yet." | A dancer with an old row can no longer rate the level from Nights. | Accept. |
| 5 | should (owner must accept) | `src/modules/dancer-app/screens/home/HomeScreen.tsx:141-149` (main :76, :126, :156) | The Home hero "Your next night &middot; in N days" came from the old RPC with no switch check. It is now always "No upcoming night yet.", and the past-night RateNudge never shows. | A dancer with an old row loses their next night and the rate nudge on Home. | Accept. |
| 6 | should (owner must accept) | `src/components/profile/DancerDashboard.tsx:689, :798` (main :971, :1012, :1121, :1293+) | The `/account` dashboard changed for every dancer:<br>&bull; The Events/Festivals "Search &hellip; to add" cards are gone (they wrote `set_attendance`).<br>&bull; The Upcoming and Momentum tiles are gone, so the grid goes from 3 tiles to 1.<br>&bull; The progress bar now repeats the completion %, so the same % shows 3 times.<br>&bull; Completion is now counted out of 4, not 5, so everyone's % moves.<br>&bull; "Activity" became "Calendar / Find your next night".<br>&bull; The "Find your next event" next step is gone. | A dancer who was at, say, 60% now sees a different number, shown three times. They also see one lonely tile where there were three. | Accept, or ask for a follow-up pass on the dashboard layout. Simplest fix: drop the duplicate % bar. |
| 7 | should | `tests/client/goingSwitch.test.ts:28-34` | No test proves that a production build cannot switch going on. The test checks the pure rule, then reads the raw env under vitest, which does not apply the `define` from `vite.config.ts`. The regex at :34 covers only the `VERCEL_ENV` define. The real build is correct: I built with the PR's define, and `VERCEL_ENV=production VITE_GOING_PREVIEW=1` folds to OFF. But nothing locks that in. | Someone later swaps the define for `import.meta.env.VERCEL_ENV`, or drops it. Every test stays green while a production build reads the env object. Also, running the tests in a shell with `VITE_VERCEL_ENV=preview VITE_GOING_PREVIEW=1` set makes this test fail even though the real build is fine. | Add a test that runs Vite `build()` on a tiny entry with the real config's `define`, under `VERCEL_ENV=production` + `VITE_GOING_PREVIEW=1`, and asserts the output contains `false`. |
| 8 | should | `scripts/check-going-legacy-rpcs.mjs` (wiring) | The new legacy-RPC guard runs only in `npm run lint` and `pre-ship`, and no CI workflow runs lint (`architecture-guard.yml` does not). `check-going-rpcs.mjs` is not in `db-contract-check.yml` yet either; the builder disclosed this and the handover has the exact step. | A later PR adds `rpc('set_attendance')` back. CI stays green, and only a local pre-ship would catch it. | Add the `db-contract-check.yml` step from the handover. Also add `check:going-legacy-rpcs` (self-test, then check) to a workflow that runs on pull requests, e.g. `architecture-guard.yml`. |
| 9 | should | `scripts/check-going-rpcs.mjs:270-287` | When every sampled night has 0 people and every `going_next` is empty (today's prod), the check exits 0. It prints only `PEOPLE_SKIP` / `GOING_NEXT_SKIP`. So the person-level checks (key set, id is uuid-or-null, cap of `p_limit` people) never run, yet the job is green. | The database starts returning a `user_id` inside a person row once the first person says going. The job was green the day before and nobody noticed that it had never checked a person. | Add a `REQUIRE_GOING_PEOPLE=1` env that turns the skip into exit 2. Set it once real going rows exist. |
| 10 | should | `tests/client/festivalHubGoing.test.tsx:164` | For nights that are not cancelled, the assertion is `not.toMatch(/^$/)`, which only says the body is not empty, so it cannot fail. | A regression that prints the wrong count line on a live festival night passes this line. | Assert the real per-night text, or delete that branch. |
| 11 | nice | `scripts/check-going-legacy-rpcs.mjs:36-37` | The regex misses some names: unversioned `get_my_event_attendance`, `set_attendance_v2`, `set_my_occurrence_attendance_p5_v2`, upper case, and template or split strings. The split strings are expected for a regex. Exact `rpc('set_attendance')` and `rpc("get_festival_attendance_v2")` ARE caught (mutation-tested in a scratch worktree), and the exemption covers only two exact generated-type paths. | A caller writes `get_my_event_attendance` with no version and the guard stays green. | Widen to `get_my_event_attendance(_v\w*)?`, `set_attendance(_v\d+)?`, `set_my_occurrence_attendance\w*`, case-insensitive. |
| 12 | nice | `tests/client/goingHidden.test.tsx:143` | The "no legacy RPC" check matches `/occurrence_attendance/` only. It misses `set_attendance`, `get_festival_attendance*` and `get_my_event_attendance*`. | An old RPC call creeps back into a surface and this test does not see it. | Use `/attendance/`, as `goingCountSwitch.test.tsx` does. |
| 13 | nice | `src/modules/going/useNightGoing.ts:221-227` | If `get_my_going_v1` fails, the viewer is treated as "not going". | Someone who IS going and has an unfinished profile sees "Finish your profile" with a disabled button, so they cannot take their name off until a reload succeeds. Rare: it needs a failed read plus an unfinished profile. | When `mine.isError`, use `going: null` (loading) or the error state with a retry, rather than `false`. |
| 14 | nice | `src/modules/event-page/sections/EventAttendanceSection.tsx` | A dead file, with 0 importers, still renders "N interested". | None today, since nothing imports it. Restoring it would bring Interested back. | Delete it in a later clean-up. |
| 15 | nice (before the switch goes ON) | `src/pages/Privacy.tsx:39,53` | The privacy page still says nights are private and only anonymous totals are shown. The builder already flagged this. | Once the switch is on, first names (and photos the dancer opted into) are public and the privacy page is wrong. | Owner approves new wording before the switch goes on. This PR does not need it. |

## Checked and fine

- **The switch can't turn on in production.**
  - `GOING_CHECKIN_ENABLED` is on only when `VERCEL_ENV === 'preview'` AND `VITE_GOING_PREVIEW === '1'` (`src/lib/goingCheckin.ts:17`).
  - Both values are replaced at build time by `vite.config.ts` `define`, so a production build bakes in `false`.
  - I built it three ways. `VERCEL_ENV=production` plus `VITE_GOING_PREVIEW=1` is OFF. Faking `VITE_VERCEL_ENV=preview` in a production build is still OFF (the define wins). A real preview with the variable set is ON.
- **No going request runs while the switch is OFF:**
  - The nights read and the own-list read are both switch-gated (`useNightGoing.ts:66, :78`).
  - The calendar's going feed is mounted only when the switch is on (`EventCalendar.tsx:237`).
  - The festival hub's per-card `event_view_p5` read uses `enabled: GOING_CHECKIN_ENABLED` (`FestivalHub.tsx:97`).
  - The dancer page parser is skipped (`dancer-app/api/rpc.ts:186`).
  - The event tile, its placeholder and the slot are all gated, so no empty gap is left behind.
  - The festival hub also no longer fires the 3 ungated old-RPC reads it fired on main.
- **The settings switch** is hidden while the going switch is off (`EditScreen.tsx:392`). It is never sent then (`me/model.ts:256`), and an untouched save sends nothing (`diffDelta`).
- **Privacy:**
  - A person is linked only when `dancer_profile_id` is non-null (`GoingPeople.tsx`).
  - A photo shows only when `photo_url` is set; otherwise an initials circle.
  - No account or auth id is rendered, logged or sent to analytics: telemetry sends only the public dancer profile id via `emitProfileView`.
  - No "Interested" is in any live surface (only dead file #14 has it).
  - The contract check scans every level of the reply for account keys.
- **The one mapping (`goingState.ts`):**
  - Every refusal code reaches a state with words and a way forward, and `goingState.test.ts` checks the table in both directions: `not_signed_in`, `anonymous_session`, `invalid_argument`, `not_found`, `event_not_live`, `night_cancelled`, `night_ended`, `profile_incomplete`, `rate_limited` and `too_many_ids`.
  - `42501` / "permission denied" maps to signed out.
  - Un-going is always allowed, and an ended night says "You went &middot; Undo".
- **Saves and reads:**
  - A save shows the new count at once and rolls back on a refusal or network error (tested in `useNightGoing.test.tsx:146` and `rsvpBlock.test.tsx:356, :370`).
  - After a save, `invalidateGoing` refreshes every nights read holding that night plus the viewer's own list (tested).
  - Reads are chunked at 200 ids (`goingRpc.ts:197`, tested at 200 and above).
- **Times:** `starts_at_local` is never passed to `new Date()`. It is read as text (`goingCopy.ts:nightLine`, `goingState.ts:naiveStamp`). The only `new Date(` calls on going paths read "now" or a date key.
- **Unknown counts:** a night the database leaves out shows no count, never a made-up "0 going" (`nightGoingKnown`).
- **Calendar files** (`EventCalendar.tsx`, `CalendarListView.tsx`, density-excluded): the diff is ONLY the going count feed and the chip colour (`#6b4c2a` to `INK`, for contrast). There is no layout or density change, and the owner approved the change via the arc plan.
- **Guards follow the repo rules:**
  - Both pass `check-script-conventions` R1&ndash;R6.
  - Exit codes are 0/1/2, and missing credentials give 2.
  - The canaries are real: both drive `main()` and pin every verdict branch.
  - The canary runs before the check in pre-ship.
  - A fetch failure, or a run that measured nothing, gives 2.
- **Tests:** all 10 going test files pass (455 tests). `goingState.test.ts` has an independent viewer &times; night &times; going table (72 cells) plus the refusal table, so the surface tests that reuse `goingStateFor` for their expected values still rest on an independent truth.
- **Old RPCs:** none of them is called anywhere in `src/`. They appear only in the two generated type files.
