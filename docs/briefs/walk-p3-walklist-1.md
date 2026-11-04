# Brief: walk the first 12 rows of the P3 WALKLIST (report only, mocked, 390x844)

Lane: normal. Suggested model: Sonnet (a walk and a report; no logic). One worker, branch `claude/walk-p3-walklist-1` (family `claude/walk-*`). Push ONCE with the report; never add `run-ci`.
Source: `docs/design/p3-acceptance/WALKLIST.md` (47 rows) and `FLIP-READINESS.md` (0 of 47 have a browser walk). Owner goal: 10 real organisers claim a page and edit an event themselves, so the rows chosen are the ones an organiser meets while editing an event.

## Hard limits for this job
- REPORT ONLY. Edit NO product code: nothing under `src/**`, `scripts/**`, `supabase/**`, `vite.config.ts`, `perf-budgets.json`, `.github/**`. You may add ONE new spec file `tests/e2e/walk-p3-walklist.spec.ts` (reusing the harness) and the report folder `docs/walk/p3-walklist-1/`. Nothing else.
- No real accounts, no sign-in, no prod write. Every answer is a route-mocked answer. Supabase is not touched at all (the mocks stand in for it).
- No PR is opened by you. The push is the report; if the bot opens a docs-only PR from the `claude/*` branch, leave it alone.
- Do not walk what two running workers are already fixing: the Home/Events/Stats page choice (W-18; branch `claude/p3-page-scope-1`) and the Details/Prices lock and the one count (W-23; branch `claude/p3-gate-retry-1`). Do not edit or rebase onto those branches. If a row below lands on those screens, say "OVERLAPS <branch>" and still record what you see on main.

## Harness (reuse, do not rewrite)
`tests/e2e/walk-invite-recheck.spec.ts` on branch `claude/walk-invite-recheck-1` (PR #1303): `test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })`; `snap()` that FAILS the state if the page shows "Something went wrong" or "couldn't reach Bachata Calendar"; waits for the heading text, finished animations and a full-page resize before the screenshot. Copy its waits and its guard into the new spec. Run in the cloud sandbox with the dev-server Chromium (as `walk-fix-join-dead-ends` did). Find how the P3 area is mocked in the existing P3 e2e specs (`tests/e2e/p3-*.spec.ts`, for example `p3-gate-overlays.spec.ts`) and reuse their route mocks and flag setup; the P3 flag (`organiserP3`) must be forced on for the walk through the same mechanism those specs use.

## Step 0 (before any walking): the row table
Write `docs/walk/p3-walklist-1/ROWS.md`: for each of the 12 rows below, the exact route, the mock shape needed (which RPC or table read is answered with what), the file:line of the screen under test, and the pass condition copied from this brief. If a row CANNOT be mocked honestly (the screen reads something you cannot stand in for), mark it BLOCKED with the reason; do not fake it. End with a count: 12 rows, N walkable, N blocked.

## The 12 rows (WALKLIST id: what to do; PASS condition)
All at `/account/p3`. Person: an owner of one page with a finished profile, gate flag as prod (off) unless the row says otherwise.
1. W-01 leave prompt: open `events/<id>/details`, type in the name, then (a) the Events tab, (b) phone Back (history back), (c) the Back link. PASS: each shows "Leave without saving?"; "Leave and lose them" leaves; "Keep editing" stays with the typing kept.
2. W-02 remove an event: remove (hide) a spare event, note the page it lands on, reload the deep link `events/<id>`. PASS: record the tag word; the Add date, Repeats and date sheets are disabled with a reason (record whether they are).
3. W-09 rooms: open the Session sheet of an event with rooms. PASS: record whether the screen offers rooms (P3 sends no rooms command) and what it says.
4. W-10 line-up: in the Session sheet search a person, then search a name nobody has. PASS: a search finds a person; an empty search offers adding a new one.
5. W-16 not yours: a manager of page A opens `events/<id of page B>` and its `/dates`, `/details`, `/prices`, `/history`, `/door`. PASS: the first five say "Not yours"; `/door` says not allowed; none shows editable fields.
6. W-20 gate sheet (mock the status read so the gate is ON and the page is unfinished): press "Put it live" and "Cancel this date". PASS: the sheet asks only for what is missing, answers already filled in; "Not now" leaves the person where they were with typing kept.
7. W-26 after Continue: from that sheet tap Continue, finish the details, come back. PASS: record where the person lands and the number of taps to redo the change (the #1304 return path should release the hold).
8. W-29 big list: Events with about 116 series (mock 116 rows). PASS: all listed, scrolls to the last, the count matches the mock.
9. W-31 dates cap: `events/<id>/dates` for a weekly with 132 dates (30 past, 3 cancelled, 2 skipped). PASS: "100 of N" with Load more after the fix; if there is no such line, record the cap (what is shown, what is missing).
10. W-33 move a guest-list date: move a future date that has a guest-list entry. PASS: record whether the screen warns and where the guest entry ends up (CANNOT-TELL row: record, do not guess).
11. W-35 two saves: save a date, then save the same date again from a stale view (mock the second answer as a version conflict). PASS: the second save is refused or warned in plain words, the typing is kept, "Start again" works.
12. W-36 read-only reasons: a festival's Session rows and a course's scope-disabled reason. PASS: read-only copy on the festival rows; a reason beside every disabled scope control; no control that does nothing.
Then W-19 as a sweep over every picture above: every tap target at least 44px (measure with the page, record the failing ones), no garbled punctuation (no mojibake, no raw entity text), no sideways scroll, no clipped text.

## Open every picture
You MUST open every screenshot yourself and write one line for it in the report (what you see, in words). A green DOM assertion is not a pass; the first re-walk false-passed on error-card pictures. A row is PASS only when the picture shows the pass condition. Use FAIL (with the picture), CANNOT-TELL (with why), or BLOCKED. No row may be left unmarked.

## Report
`docs/walk/p3-walklist-1/RESULTS.md`: a table (row id, verdict, picture file, one-line what you saw, severity high/medium/low if FAIL, file:line suspected). Pictures under `docs/walk/p3-walklist-1/pics/`. Rank the FAILs by what stops an organiser editing an event. End with: counts (PASS / FAIL / CANNOT-TELL / BLOCKED out of 12), the remaining WALKLIST rows you did NOT walk (by id) with the reason (needs a real account, needs seed data in a database, public page, admin repo, overlaps), and an honest "Not verified" list (mocked answers are not real data; phone not tested).
Checkpoint push once the report and the pictures are in; handover note in the same push.
