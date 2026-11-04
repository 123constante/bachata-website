# Walk p3-batch-1 — RESULTS (report only, no product code changed)

390x844, every answer route-mocked (harness from `claude/walk-p3-walklist-1`), each PR branch walked on its own worktree. Specs: `tests/e2e/walk-p3-batch-1-{dates,status,door}.spec.ts`; pictures in `docs/walk/p3-batch-1/<pr>/pics`; raw facts in `observations.jsonl`.
Every picture below was opened and read by me. Pictures I did not open were deleted, not claimed. Sweep line per picture = taps under 44px / garbled punctuation / sideways scroll, judged from the picture plus the `w19` record in observations.jsonl.

## Summary (FAILs first)
- #1316 dates-fix: no FAIL on W-31 or W-35. Two NITs (see below).
- #1315 event-status: no FAIL.
- #1317 door-camera-help: see its section (filled below).

## #1316 p3-dates-fix-1 (branch is on older main ea16d47; walked as-is)
Mock honesty: the workspace answer pages like the real read (`p_before`/`p_limit`, `has_more`, `next_before`, whole-series `total`), shape taken from the PR INVENTORY (proved read-only on prod by that worker). Not independently re-proved here.

| Picture | Verdict | What I saw |
|---|---|---|
| w31-132-0-coming | PASS | "This page lists the newest 100 of 132 dates." and a full-width "Show 32 older dates" button above the list; Coming 98 / Past 2 / Cancelled 2 tabs. |
| w31-132-1-older-button | PASS | same screen as 0 (button in view). |
| w31-132-2-after-older | PASS | partial line and button are gone; tabs now Coming 98 / Past 34 / Cancelled 3 (adds to 132 with cancelled counted once). |
| w31-132-3-past | PASS | Past tab, newest-first, "Done" tags, 34 rows. |
| w31-132-4-past-bottom | PASS | list ends at Tue 17 February (the oldest); a past cancelled date (3 March) struck through with both Done + Cancelled tags; "Add a date" disabled with a reason. |
| w31-132-5-oldest-open | PASS | oldest date opens its sheet (Tuesday 17 February, 8pm); all five actions greyed with "This date has already happened, so it can't be changed." Opens fine; editing a past date is correctly refused. |
| w31-100-0-coming / -1-past | PASS | exactly 100: no partial line, no button, every row listed. |
| w31-99-0-coming / -1-past | PASS | 99: same, no button. |
| w35-put-1-typed | PASS | Name sheet with "Spring Special" typed, Save enabled. |
| w35-put-2-conflict | PASS (NIT) | Save greyed; plain explanation + "Start again". NIT: two messages stack ("Someone changed this first. Check it." AND "Someone else saved a change…"): redundant, the first one is the old generic copy. |
| w35-put-3-start-again | PASS | field shows the current value "Friday Bachata"; card "This is the date as it is now. Your changes are not saved." with "Put my changes back" / "Drop my changes"; Save says "Nothing changed yet". |
| w35-put-4-after-choice | PASS | typing back in the field, Save enabled. |
| w35-put-5-saved | PASS | sheet closed after Save (2nd command sent, 1st was the refused one). Sessions rows read "No name yet": that is the fake series having no session names, not this PR. |
| w35-drop-4-after-choice / -5-saved | PASS | Drop: field shows current value, Save "Nothing changed yet" (no command sent, observed 1 -> 1). |

Sweep (all pictures above): no garbled punctuation seen; no sideways scroll recorded (sidewaysPx 0 in observations); no tap under 44px inside the p3 theme or dialogs (the Back/Close text links count as >=44 tall boxes per the measurement); measured in observations.jsonl `w19`, all empty.
NIT 2: before "Show 32 older dates" is tapped the tab counts say Past 2 / Cancelled 2, after: Past 34 / Cancelled 3. Counts are of loaded rows only; the partial line above them explains it, but a person could read "Past 2" as the truth.
Not walked: W-35 on the About / Ticket sheets (only the Name sheet); older-page failure state; 500 dates.

## #1315 p3-event-status-1 (W-02 out of scope per brief)

| Picture | Verdict | What I saw |
|---|---|---|
| nopage-events | PASS | person with no page: title "You don't have a page yet", "Your events show here once you run a page. Find your page or create one to get started.", button "Find or create a page" (links to /account/p3/start). |
| nopage-stats | PASS | same card under the Today / 7 days / 30 days tabs; says "Your views show here…". |
| switch-events-1-open | PASS | "Switch page" list open: tick (✓) beside "Ritmo Bachata London", none on Leeds; Friday + Sunday events listed below. |
| switch-events-3-reopened | PASS | after picking Leeds: header and event list are Leeds' ("Leeds Thursday"), tick moved to Salsa y Bachata Leeds. |
| switch-stats-1-open | PASS | tick on the chosen page; 0 views card (mock stats are empty). |
| loading-home | PASS | "Loading your events… This takes a second. Your tabs below work while it loads." with no page name or data shown while the home read is pending (5s delay). |
| loading-events | PASS | "Loading your events… This takes a second." no rows, no page name. |
| loading-stats | PASS | tabs + "Loading views… Counting your views."; no 0 shown. |

Notes: Home with no page redirects to /account/p3/start (unchanged, as the PR inventory says); I did not take a picture of it. The tick is a small decorative glyph (aria-hidden); the row remains the tap target. Sweep: no garbled punctuation or sideways scroll seen.
Not walked: a 0-page person on Home; Stats with real numbers.
