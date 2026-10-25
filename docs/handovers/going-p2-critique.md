# Handover: Going P2 stage 5 &mdash; independent critique + one fix pass. Switch stays OFF.

Brief: `brief/going-p2-critique:briefs/going-p2-critique.md`. Branch `claude/going-p2-critique`, off
`claude/going-p2-website` @ `0a7836e` (PR #992). The orchestrator merges this branch into that one.
No PR was opened from here.

- Critique (ordered fix list, written before any edit): [`docs/design/going-p2-critique.md`](../design/going-p2-critique.md).
- New numbers in the design record: [`going-p2-website.md` &sect; Stage 5](../design/going-p2-website.md).
- Re-shot states: [`docs/handover/going-p2/critique/`](../handover/going-p2/critique/) (17 PNGs).

## What changed

All changes are inside the going module and its two event-page / hub callers. Everything stays
behind `GOING_CHECKIN_ENABLED`, so flag-OFF pages are unchanged (`goingHidden.test.tsx` green).
There is no new read, no new RPC, and no owner decision changed.

| # | Fix | Files |
|---|---|---|
| C1 | A cancelled night never says "No one going yet" or "N going". At 0 there is no count line; otherwise "3 had said they were going". | `goingCopy.ts` (`goingCountText(n, past, cancelled)`), `GoingPeople.tsx` (`cancelled` prop), `RsvpBlock.tsx`, `FestivalHubGoing.tsx` |
| C2 | Ended night with 0: "No one said they were going" (not "No one went"). | `goingCopy.ts` |
| C3 | Ended night where the viewer is going: "You went &middot; Undo" (past tense). Un-going stays allowed, as the builder&rsquo;s review fix intended. | `goingCopy.ts` (`wentUndo`), `goingState.ts` |
| C4 | A refusal with a way on makes that way on the 48px gold control: "Finish your profile" (unfinished; the line still names each missing field) and "Message us on WhatsApp" (no dancer profile). Before, it was a dead grey "I&rsquo;m going" with a 12px link under it. | `GoingButton.tsx` |
| C5 | Copy: `beFirst` ".. your first name shows here." (was "your friends will see you here": there is no friends list). `myUpcomingEmptyHow` "Find a night on the calendar, then tap I&rsquo;m going on its page." (says where nights are; `journeyChecks.pointers` still proves the way there is on screen). | `goingCopy.ts` |
| C6 | No placeholder &rarr; tile jump: the line under the button always holds two lines (`min-h-[33px]`), and so does the placeholder. | `GoingButton.tsx`, `RsvpBlockPlaceholder.tsx` |
| &mdash; | Allow-list: the two stage 5 docs added to `scripts/dancer-area-isolation-allowlist.json` (as the builder did for theirs). The new test lives in `tests/client/`. | allow-list |

### Layout shift, measured (harness, 390x844 unless noted; tile `<section>` height in px)

| State | Before (builder pack) | Try 1: hold 1 line | Try 2: hold 2 in placeholder only | **Shipped: hold 2 everywhere** |
|---|---|---|---|---|
| Placeholder | 172 | 171 | 187 | **187** |
| 0 going, finished (commonest) | 194 (+22) | 187 (+16) | 187 &rarr; 170.5 &rarr; 187 | **187 &rarr; 187 &rarr; 187** |
| Unfinished, dance role (commonest signed in) | 238 (+66) | 171 | 187 &rarr; 170.5 | **187 (0)** |
| Unfinished, all four / no profile | &mdash; | 187 | 187 &rarr; 170.5 &rarr; 187 | **187 (0)** |
| 360 / 430, states above | &mdash; | 186.8 / 171.4 | jumps 16.5 | **186.8 / 187.4, no jump** |
| Tap "I&rsquo;m going" (0 &rarr; 1) | &mdash; | 187 &rarr; 171 &rarr; 227 | 4 moves | **187 &rarr; 242.9 (one move: the people row)** |

Cost: one-line or wordless states keep 16&ndash;33px of empty space under the button (largest on
"3 going", which has no words). What still moves is the +56px people row when a night WITH people
loads. Holding that space needs the count before the read: **owner call** (below).

### What I saw at each seam (re-shot PNGs, looked at)

- **Tile vs bento ground**: no seam in any of the 17 shots. The raised surface and hairline match, and the gold control is the sticky bar&rsquo;s gold.
- **Unfinished** (`viewer-unfinished-dance-role.png`): "No one going yet", gold "Finish your profile", "Add your dance role to say you&rsquo;re going." It reads as a next step, not a dead end.
- **Cancelled, 0** (`night-cancelled-0.png`): no count line. An empty band of about 40px sits under the date (the held count line) above the grey "Night cancelled". It reads as a gap. Nice-to-have, below.
- **Cancelled, 3**: "3 had said they were going", three initials circles, grey button. **Ended, going**: "WHO WENT", "1 went", pressed "&check; You went &middot; Undo".
- **0 going** at 390: "Be the first &hellip;" wraps, leaving the single word "here." on line 2 (fits on one line at 430). Polish only.
- No clipping, no sideways scroll, every big control 48px.

## Red first

`tests/client/goingCritique.test.tsx` (C1&ndash;C6, table-driven) was written before the fixes and run
against the unfixed code: **15 failed / 4 passed**. The 4 that passed were rows that were already
true: "No one going yet", "4 going", "5 went", and ended-not-going = "Night ended". Updated
pins: `goingComponents`, `goingState`, `rsvpBlock` (plus a new cancelled x count table),
`festivalHubGoing` (the count x viewer x night matrix now checks cancelled and the Finish/Message
control), and the `today` regressions (`eventRsvp`, `festivalHub`, `directoryAttendance`: 8
snapshots updated, each diff only the new copy / control). The new tile-level cancelled table in
`rsvpBlock.test.tsx` was NOT run against the unfixed code; the same rule was proven red at
component level (C1).

## CI, every applicable job step, run locally on the final code

| Job (workflow) | Step | Result |
|---|---|---|
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | PASS |
| architecture-guard | `bin/check-integrity.sh` (2379 files, 0 issues), `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `check:images` (`AUDIT_STRICT=1`), `check:image-widths`, `check:plan-hygiene:self-test`, `check:workflow-artifact-policy`, `check:mojibake:self-test`, `prove:entry-point` | PASS |
| unit-tests | `check-dancer-area-isolation --self-test`, `check:dancer-area-isolation` (after adding the 2 docs to the allow-list) | PASS |
| unit-tests | `test:unit:offline` | 12949 passed, **5 failed**: all in `tests/integrityCouldNotRun.test.ts`, which also fails on the unfixed branch in this sandbox (it needs the Windows-mount TS helper) |
| unit-tests | `test:unit` | 12985 passed, **15 failed**: `integrityCouldNotRun` (5) plus 3 live-DB contract suites (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`; no prod secrets here). The same 15 fail on the unfixed branch; none touch going |
| lint | `npm run lint` | PASS, 22 of 22 links |
| perf-budget | `build`, `check:bundle-budget`, `check:first-load-requests` (pins unchanged), `check:chunk-cycles` | PASS |
| perf-budget | `check:doc-weight` | could not run: needs `GITHUB_REPOSITORY` (CI-only) |
| e2e-smoke | `test:e2e` | 153 passed, 4 failed in the full run (`account-settings` x2, `home-nights` upcoming-going, `organiser-onboarding` sign-in link): each was a 15s first-render timeout under load. Re-run of those 3 specs alone: **24 passed, 0 failed** |
| db-contract-check | `check:going-rpcs` | not run (prod secrets; this branch changes no RPC) |
| phone-qa / real-data-verified | PR-body sections | in the ready-to-paste body below |

## Owner calls (recommendation; not in code)

1. **Ended / cancelled night: "See the next night &rarr;"** (mock A). This needs the series&rsquo; next night, which is a new read. I recommend building it with P3.
2. **Calendar list shows "N going" on a cancelled row** (`CalendarListView.tsx:152`). This is a density-excluded file, and Ricky must OK any change there. I recommend `goingCount > 0 && !event.isCancelled` (one line). It never says 0 today.
3. **Ricky to OK the two calendar edits P2 already made** (`EventCalendar.tsx` going feed, `CalendarListView.tsx` chip colour). Both files are on the density-excluded list. These are not density changes.
4. **Lock "Who went" after the end?** Un-going an ended night is allowed today (the label is now past tense). If the record should be fixed after the night, that is an owner decision.
5. **Dancer page "Back" always goes to `/dancers`.** Going adds a path in from the event tile. I recommend history-back when the referrer is same-site.
6. **App Home with 0 nights says "0" three times** (hero, "Upcoming nights 0" tile, "0 Going" strip cell). I recommend dropping the tile or the cell.
7. **"Add your photo to say you&rsquo;re going"** while the photo stays hidden unless the switch is on. `avatar_url` is in `profile_complete_v1` (admin). Keep it, or explain it in the line.
8. **Reserve the people row** (the +56px move on nights with people): only possible if the count came with the page snapshot. That is a new field, so admin owns it.
9. **"+192 more"** can&rsquo;t be tapped to see the whole list. That needs a list view and a paged read.
10. `/account/attendance` title "My Event Attendance" vs the app&rsquo;s "Nights you&rsquo;re going to". Pick one name.

Nice, not done: the cancelled-0 empty band under the date; the single word "here." left on its own line at 390; a themed amber `focus-visible` ring (Chromium&rsquo;s default ring shows today; not a bug); the shared sign-in sheet&rsquo;s black square over the green bento (already there before P2).

## Verified / Not verified

**Verified**
- Every fix by table-driven vitest (red first, see above), plus the full unit suite and the CI steps above.
- Real data shapes from the brief&rsquo;s prod facts (counts only, read by the orchestrator): every upcoming night 0 going, 4 in 5 unfinished, 0 of 188 with the photo switch on. These are the exact states C3/C4/C6 fix and the shots show (0 going, unfinished, initials circles).
- Browser walk of the event tile in a harness over the REAL `RsvpBlock` / `RsvpBlockPlaceholder` (lazy, Suspense), mocked RPCs, at 390x844, 360x800 and 430x932. The heights above were measured per animation frame.
- `npm run build` green; bundle budget, first-load request pins and chunk cycles unchanged (green).

**Not verified**
- The full SSR `/event/:id` and `/festivals` pages around the tile (the same limit as the builder). The festival hub card was NOT re-shot; it is covered by `festivalHubGoing.test.tsx` only.
- A real sign-in, a real Supabase, and a phone. No preview walk: the switch is off on preview until a preview is built with `VITE_ENABLE_GOING_PREVIEW=true` (renamed from `VITE_GOING_PREVIEW=1` in the fix round).
- No Supabase read was run by this worker; the prod facts are the brief&rsquo;s.
- Photo avatars (every person in the shots is an initials circle, as on prod today).
- The dancer app, `/account/attendance` and the dancer page were not re-shot. Their only change is the `myUpcomingEmptyHow` sentence, pinned by the `today` snapshots and `journeyConsistency`.
- The 3 stale builder shots (`event-tile--tap-success`, `--night-ended-was-going`, `app-nights--error`) are superseded by the new tile shots. `app-nights--error` was NOT re-shot.

## Ready-to-paste PR body

```markdown
## Summary
Going P2 stage 5: an independent design critique of the "I'm going" surfaces (design A) and ONE fix pass. The switch stays OFF; flag-off pages are unchanged.
- A cancelled night never says "No one going yet" / "N going" (no line at 0; "3 had said they were going").
- An ended night where you said going reads "You went · Undo"; an ended night with 0 reads "No one said they were going".
- Unfinished profile / no profile: the big gold control IS the way on ("Finish your profile" / "Message us on WhatsApp"), and the line still names what is missing.
- No tile jump: the placeholder and every state hold the same two-line message line (390: 187px -> 187px).
- Copy: "your first name shows here" (no friends list exists); "Find a night on the calendar, then tap I'm going on its page."
Critique: docs/design/going-p2-critique.md. Handover: docs/handovers/going-p2-critique.md.

## Verified on real data
- Shapes surveyed (read-only, counts): prod facts from the brief (2026-10-23): every upcoming night 0 going; 4 in 5 dancer profiles unfinished; show_going_photo on for 0 of 188; 7 attendance rows / 5 people.
- Checks run (matrix tests, every CI job step, browser walk at 390x844): goingCritique table (red first: 15 failed on the unfixed code), the rsvpBlock / festivalHubGoing matrices, today regressions, full test:unit, every local step of unit-tests / typecheck / architecture-guard / perf-budget; harness walk of the real tile at 390x844, 360x800, 430x932 with heights measured per frame.
- NOT verified (be honest): the full SSR /event and /festivals pages around the tile; real sign-in and Supabase; a phone; photo avatars; the festival hub card and app screens were not re-shot (tests only).

## Phone QA
- Sizes checked: 390x844, 360x800, 430x932 (event tile harness, real components)
- Walked: event tile states: placeholder, 0 going, unfinished (1 and 4 fields), no profile, cancelled 0 / 3, ended 0 / was going, 3 going, tap I'm going
- Not verified: real phone; full event page and festival hub page around the tile; dancer app screens (copy change only)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01RCYbAEgkoFifFRjbjTGcFY
```
