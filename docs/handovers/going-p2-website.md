# Handover: Going P2 &mdash; Website "I'm going" module (design A). Switch stays OFF.

Brief: `brief/going-p2-website:briefs/going-p2-website.md` (commit 2a574c9, "no workflow edits").
The task pinned blob `45e26c27`. The branch's later commit differs only in item 5:
the contract check is NOT wired into `db-contract-check.yml` here, and the step to add
is below. The worker followed the later, stricter version.
Branch `claude/going-p2-website`. Design record: [`docs/design/going-p2-website.md`](../design/going-p2-website.md).
Screenshots (390x844, every state per surface): [`docs/handover/going-p2/INDEX.md`](../handover/going-p2/INDEX.md).

## What changed, per surface

| Surface | Change |
|---|---|
| **Module** `src/modules/going/` | One mapping (`goingState.ts`: every viewer x night x refusal code -> words + control + link); one copy file (`goingCopy.ts`, import-free); typed RPC callers (`goingRpc.ts`); `useNightGoing` (batched `get_nights_going_v1`, chunked at 200; `set_my_going_v1` with optimistic update + rollback; `invalidateGoing`); `useMyGoing`; `GoingButton`; `GoingPeople`; `CalendarGoingFeed` (lazy). The browser-only `useGoingLock` is gone, folded into the module. |
| **Switch** `src/lib/goingCheckin.ts` | `GOING_CHECKIN_ENABLED` is OFF on production. ON only when `VERCEL_ENV === 'preview'` AND `VITE_ENABLE_GOING_PREVIEW === 'true'` (renamed in the fix round). Both values are `define`d in `vite.config.ts`, so they fold to constants. Production/development/local/missing env are all OFF (`tests/client/goingSwitch.test.ts`). |
| **Event page** `RsvpBlock.tsx` + placeholder | Design A "Who's going" tile on bento tokens: count, up to 8 people, "+N more", one I'm going button. `useOccurrenceRsvp.ts` deleted. |
| **Festival hub** `FestivalHub.tsx`, new `FestivalHubGoing.tsx`, `festivalHubNights.ts` | Each card shows its count, people and own button. The P5 night id comes from `event_view_p5` (anon), then ONE nights request for all cards. Interested, the old previews and the WhatsApp progress bar (driven by going+interested) are removed. |
| **Calendar** `EventCalendar.tsx`, `CalendarListView.tsx` | ONLY the going count changed. It reads the module through the lazy `CalendarGoingFeed`, which mounts only while the switch is on (the P0.5 rule holds). The chip colour changed to the file's own `INK` (contrast 4.32 -> 8.78). Layout and density are untouched. |
| **Dancer app** Nights / Home / NumbersTiles / Me, `MyAttendance.tsx` | All read `get_my_going_v1`. One mapping (`nightsModel.mapMyGoing`) feeds Nights, Home and `/account/attendance`. Interested is gone everywhere. Cancelled past nights are not listed as "went to". |
| **Public dancer page** `PublicDancerPageV2.tsx` | "Going next" comes from extras `going_next` in the F13 layout (1 full / 2 side by side / 3 = 2 + "See all 3"). "Your plans" / `ownerPlans` are removed for everyone. |
| **Settings** dancer-app `EditScreen.tsx` | The "Show my photo when I&rsquo;m going" switch (`show_going_photo`, OFF unless the server says true), with the brief's one line. It saves through `save_my_dancer_profile_v2`'s delta, and an untouched save sends nothing. |
| **Dead code** | Deleted `AttendeesModal.tsx`, `EventAttendanceButtons.tsx` (0 importers), `useAttendance.ts`, `useGoingLock.ts`, `useOccurrenceRsvp.ts`. Removed the legacy going parts of `DancerDashboard.tsx` (kept: the Calendar link tile, a 4-step completion score), `DancerProfile.tsx` and `Dancers.tsx` ("Your plans"). The Website now calls none of the old attendance RPCs. |
| **Guards** | `scripts/check-going-legacy-rpcs.mjs` (in `npm run lint` + pre-ship, with a self-test canary; scans `src/`, excluding the generated types). `scripts/check-going-rpcs.mjs` + `npm run check:going-rpcs` (anon contract; the signed-in half prints a SKIP because the workflow has no test account). Both are in `docs/ci-guard-notes.md`. |

## Decisions (with reasons)

1. **"Finish your profile" links to `/finish-profile?returnTo=...`**, not to the dancer-app edit screen. Dancer-area isolation rule (c) forbids the shared module importing dancer-app. The link still names every missing field.
2. **Someone going can always un-go**, even on a cancelled night, a paused event or with an unfinished profile (the database allows it). The button on an ended night is off.
3. **Rate limited / network error** keep the button usable and show their own line. A failed or dropped nights read **never claims a count**: no "Be the first". It shows "Couldn't load who's going &middot; Try again".
4. **Settings photo switch is hidden while the going switch is off**, and is never sent then (every going surface stays behind the switch).
5. **Dancer page "Going next" with 0 nights shows no section.** There is nothing to show and no control to offer. "See all N" expands in place, because the RPC sends at most 3.
6. **Festival rule dropped in the dancer app**: `get_my_going_v1` has no event type, so festival nights can no longer be excluded from the level vote / rate link (prod: 0 festival going rows).
7. **Festival-hub WhatsApp progress bar removed.** It was driven by going+interested. Put it back if wanted.
8. **`starts_at` is read as stored** (London wall clock stamped `+00:00`, per the prod function comment and the event-page CLAUDE.md). It is never converted. A BST test pins this.

## Needs owner / needs admin

- **Calendar count is blocked on admin.** `get_calendar_events_v2` returns `COALESCE(legacy_occurrence_id, p5 id)`, and `get_nights_going_v1` silently drops non-P5 ids. Next 60 days: 278 rows, only 21 with a P5 id (party 12/220, class 8/39, course 1/11, festival 0/7). The legacy->P5 map (`event_occurrence_p5`) is admin-only under RLS, and no anon view maps it. The Website shows NO count for unknown rows, never a wrong "0". Fix in admin: the calendar RPC returns the P5 occurrence id, or the going RPC accepts legacy ids.
- **Refusal-code drift from the brief's copy** (checked against the live functions): more than 200 ids returns `too_many_ids`, not `invalid_argument`. As anon, `set_my_going_v1` / `get_my_going_v1` fail with `42501 permission denied` (no EXECUTE grant), never `not_signed_in`. The module maps both.
- **Add the contract step to `.github/workflows/db-contract-check.yml`** (the sandbox cannot edit workflows). Paste it after the last `Run ...` step:

```yaml
      - name: Run going RPC contract check (Going P2)
        # The four "I'm going" RPCs the Website reads (admin Going P1): exact key
        # sets at every level, people.length <= p_limit, invalid_argument /
        # too_many_ids refusals, anon refused on set_my_going_v1 / get_my_going_v1,
        # and no account key (user_id, auth_uid, created_by, ...) anywhere. Anon
        # only: this job has no signed-in test account, so the signed-in shapes
        # print a SKIP with the reason rather than passing. Exit 2 when it measured
        # nothing. --self-test first: the canary proves the verdict can still fail.
        if: always()
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
        run: |
          node scripts/check-going-rpcs.mjs --self-test
          node scripts/check-going-rpcs.mjs
```

## Turning the switch on for PREVIEW walks only (fix round: NO Vercel dashboard step)

The orchestrator's preview tool builds a preview with `VITE_ENABLE_GOING_PREVIEW=true` for that one build. Nothing is set in the Vercel dashboard.

1. Ask the preview tool for a build of `claude/going-p2-website` with `VITE_ENABLE_GOING_PREVIEW=true`.
2. Check: on that preview URL the event page shows the "Who's going" tile. Production does not change. Even with the flag set, a production build (`VERCEL_ENV=production`) folds the switch to `false`. A real Vite build proves this in `tests/client/goingSwitchFold.test.ts`.
3. To turn it off, build the preview again with the flag `false` or not set. The value is baked in at build time, so an old build keeps what it was built with.

## Screenshots

71 PNGs at 390x844 in `docs/handover/going-p2/`, indexed with each state's Stage 4 numbers in [`INDEX.md`](../handover/going-p2/INDEX.md). Surfaces: event tile (every viewer/night/count shape), festival hub, calendar list, dancer page going_next 0-3, app Home/Nights/Me/Edit, `/account/attendance`. The event tile, hub and dancer page were rendered in a component harness: they are SSR routes, so browser mocks can't reach their loaders. The full `/event/:id` and `/festivals` pages around them were not shot.

## Blockers before the switch goes ON (found in review, not fixed here)

- **Privacy page copy is wrong once the switch is on.** `src/pages/Privacy.tsx:39,53` still say "Your nights (going or interested) are private to you. Only anonymous totals per event are shown to others." Owner decision 1 makes first names (and opted-in photos) public. The owner must approve the replacement sentence; this PR does not change legal copy.
- **Festivals lost the "no level vote" exclusion.** `get_my_going_v1` has no event type, so after a festival night the dancer app could offer a level vote, and `/account/attendance` a "Rate the dancing level" link. Neither applies to a festival: `FestivalDetail` has no rating control. Prod has 0 festival going rows today. Fix in admin: add the event type (or an `is_festival` flag) to `get_my_going_v1`'s Night, then restore the exclusion in `nightsModel` / `MyAttendance`.
- **Never promote a preview deployment built with `VITE_ENABLE_GOING_PREVIEW=true` to production without a rebuild.** The switch is baked in at build time. A production build always folds the switch to off, but check that Vercel's "Promote to Production" rebuilds with production env and does not just re-point the preview build. Not verified here.
- **Contract check URL:** `scripts/check-going-rpcs.mjs` must run against prod `stsdtacfauprzrdebmzg`. The workflow's secrets do this. A local shell whose `VITE_SUPABASE_URL` points at the e2e project gets PGRST202 (the RPCs don't exist there).

## What is left

- Admin: P5 ids in the calendar RPC (above). Until then about 92% of calendar rows can never show a count.
- Add the db-contract step (above).
- Stage 5 (independent critique) and Stage 6 (walk on a preview built with `VITE_ENABLE_GOING_PREVIEW=true`).
- Mockup A linked ended/cancelled nights to the next night of the series; not built (out of scope here).
- Copy question: `GOING_COPY.myUpcomingEmptyHow` ("Open a night and tap I&rsquo;m going on its page.") is vague about where "its page" is.
- DESIGN.md: none exists in the repo, and the impeccable-documenter agent was unavailable, so nothing was updated.
- Two e2e specs outside the gate (`ember-walk`, `review-pack`) were moved to the new RPC mocks. The legacy guard scans `src/` only.
- The dancer-app strip "Went" now counts `get_my_going_v1.past` once the going feed loads (same source as Nights). That list is capped at 100 past nights, and stats are shown until it loads. Today prod has 0 going rows.
- Review: one independent review round (9 findings, none blocking). 6 were fixed with red-first tests (un-going an ended night, the Saving overlay, the dead old-lock API, the Went source, contract-check SKIP lines for empty people/going_next, fetch failure = exit 2). The other 3 are listed above (Privacy, festival level vote) or noted in the module (anon un-go of old rows). No second round was run, and no review stamp was minted.
- P3 (organiser view), P5 (retire old RPCs in the database): later phases.

## Fix round (brief `going-p2-fix`, review on `claude/going-p2-review`, 2026-10-23)

Owner decisions applied as binding: R1&ndash;R5 accepted as built. The calendar change is approved, plus a hidden count on cancelled rows. R6 dashboard tidied. Every behaviour fix got a red test first: each new test failed on the unfixed code, or against a mutant.

| Item | What changed | Proof |
|---|---|---|
| R7 build fold | `tests/client/goingSwitchFold.test.ts` runs a real Vite `build()` of a tiny entry that imports `src/lib/goingCheckin.ts`, with the `define` from `vite.config.ts` evaluated under each env. The test imports the built file and reads the value. 6 cases: production + flag true = `false`; production + flag + a faked `VITE_VERCEL_ENV=preview` = `false`; preview + flag true = `true`; preview + flag false / no flag = `false`; local + flag = `false`. It also asserts that no `import.meta.env` read survives, and that `vercelEnv` is the literal of `VERCEL_ENV`. | Mutant (define hard-coded to `"preview"`): 3 red. |
| Rename | `VITE_GOING_PREVIEW=1` became **`VITE_ENABLE_GOING_PREVIEW=true`**. The rule is unchanged: ON only when `VERCEL_ENV === 'preview'` AND the flag is exactly `'true'` (`'1'`, `'TRUE'` and `'false'` are all OFF). Changed in `goingCheckin.ts`, `vite.config.ts`, `goingSwitch.test.ts` and the docs. The owner steps above now have no Vercel dashboard step. | `goingSwitch.test.ts` table, 12 rows. |
| R9 | `REQUIRE_GOING_PEOPLE=1` (default off) turns `PEOPLE_SKIP` / `GOING_NEXT_SKIP` into exit 2. **When to set it:** once prod has real going rows on sampled nights AND a public profile with a `going_next` night. Before that the job would be red every run. | Self-test +6 cases (3 red before the change). |
| R10 | `festivalHubGoing.test.tsx` spells out the per-night line (`N going` / `N went` / `No one going yet` / `No one said they were going`) and asserts the other tense is absent. | Mutant (`goingCountText` always "going"): 30 red. |
| R11 | `check-going-legacy-rpcs.mjs` now matches the unversioned and `_vN` names, any `set_my_occurrence_attendance*`, and any `set_attendance_p5*` / `get_my_event_attendance*` suffix, in any letter case. The canary has 12 new mutants, one per new spelling. | 7 of the first 10 were red before the regex change. |
| R12 | `goingHidden.test.tsx` checks `/attendance/`. | &mdash; |
| R13 | A failed `get_my_going_v1` now leaves going UNKNOWN (`null`, button off), never `false`. The people and count that DID load stay on screen. Under the button: "Couldn&rsquo;t check if you&rsquo;re going. Try again" (`GOING_COPY.mineLoadFailed`, `GoingButton onRetry`, `useNightGoing` `mineError` / `retryMine`), on the event tile and the festival hub. | `useNightGoing.test.tsx` and `rsvpBlock.test.tsx`, finished + unfinished viewer: red before. |
| R14 | Deleted `src/modules/event-page/sections/EventAttendanceSection.tsx`. A grep over every `.ts/.tsx/.mjs/.json` file found 0 importers. Added to the dancer-area seam list with the brief as the reason, since the deletion is a change outside the module. | &mdash; |
| Calendar | `CalendarListView.tsx`: `goingCount > 0 && !event.isCancelled`. Nothing else in the calendar files changed. | `goingCountSwitch.test.tsx` +5 rows: 3 red before. |
| R6 dashboard | `dancerCompletion()` in `src/lib/profileCompletion.ts` uses main&rsquo;s five steps in main&rsquo;s order. Step 3 (main&rsquo;s attendance list) is now the viewer&rsquo;s `get_my_going_v1` upcoming + past count, which is read only while the switch is on. No old RPC is called. The % shows ONCE (the header badge): the lone Completion tile and the % bar are gone, and the hero card is full width. Compact padding is `p-3`/`gap-3`. "Find your next event" is back as main&rsquo;s step 3. The Calendar tile&rsquo;s Live / Needs action now reads the same `hasActivity` fact (one mapping). The skeleton holds while the own list loads, so the % does not jump. Its helper never points at a button that is not on screen: switch off, "Browse socials, classes and festivals near you."; switch on, "Open a night and tap I&rsquo;m going to add it here." | `tests/client/dancerCompletion.test.ts`: main&rsquo;s code is the oracle. It runs 18 profile shapes (the 10 prod shapes + edges) x 3 night counts; the branch&rsquo;s 4-step formula fails all 55. `tests/client/dancerDashboardCompletion.test.tsx`: "60% ready" once, under every RPC mode. |

**Where main&rsquo;s % and this one can still differ (honest):** main counted step 3 from old `event_attendance` rows (going OR interested). This branch counts `get_my_going_v1` nights, and only while the switch is on. Prod on 2026-10-23 had **5 accounts** with any going/interested row and 5 P5 going rows. While the switch is off, each of those accounts shows 20 points less than main did. Everyone else (the other ~184 profiles) gets main&rsquo;s exact number.

Screenshots (390x844, scratch Vite harness with mocked reads; the harness was not committed): [`docs/handover/going-p2/fix-round/`](../handover/going-p2/fix-round/INDEX.md).

### Self-review (one round, `/code-review` medium, on the fix-round diff)

7 candidates came back. Fixed:
- own-list failure no longer hides a count that loaded;
- the dashboard holds its skeleton while the own list loads;
- the `nextStep` memo deps;
- the Calendar tile reads `hasActivity`;
- the regex covers `_p5` suffixes.

Not fixed, by owner rule:
- **The switch-off dashboard caps at 80% with "Find your next event" for a dancer with no nights.** This is main&rsquo;s exact behaviour for a dancer with no rows, and the owner said "the SAME number main showed".
- **The calendar list prints "N going" on a past night where the tile says "N went".** The owner said "touch nothing else in calendar files". Owner call: allow `goingCountText(count, past)` in `CalendarListView`.

### R8: the two workflow steps (this sandbox cannot edit workflows)

1. `db-contract-check.yml`: the step in "Needs owner / needs admin" above, unchanged. Add `REQUIRE_GOING_PEOPLE: '1'` to its `env:` only when real going rows exist (see R9).

2. `architecture-guard.yml` (`pull_request`). Paste it after "Entry-point dispatch proof":

```yaml
      # Going P2: the Website names none of the retired interested/going
      # attendance RPCs (set_attendance*, set_my_occurrence_attendance*,
      # get_my_event_attendance*, get_festival_attendance*,
      # get_event_attendance_counts*; any case) anywhere under src/, generated
      # types exempt. Canary first: it proves the guard can still go red.
      - name: Going legacy-RPC guard (canary, then the guard)
        if: steps.changes.outputs.docs_only != 'true'
        run: |
          node scripts/check-going-legacy-rpcs.mjs --self-test
          npm run check:going-legacy-rpcs
```
