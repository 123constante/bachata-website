# Walk p3-batch-1 — RESULTS (report only, no product code changed)

390x844, every answer route-mocked (harness from `claude/walk-p3-walklist-1`), each PR branch walked on its own worktree. Specs: `tests/e2e/walk-p3-batch-1-{dates,status,door}.spec.ts`; pictures in `docs/walk/p3-batch-1/<pr>/pics`; raw facts in `observations.jsonl`.
Every picture below was opened and read by me. Pictures I did not open were deleted, not claimed. Sweep line per picture = taps under 44px / garbled punctuation / sideways scroll, judged from the picture plus the `w19` record in observations.jsonl.

## Summary (FAILs first)
- #1316 dates-fix: no FAIL on W-31 or W-35. Two NITs (see below).
- #1315 event-status: no FAIL.
- #1317 door-camera-help: no FAIL; 3 NITs (steps have no visible numbers; no retry for none/failed; stats pill overlaps the live camera). Browser-level mocks only, see BLOCKED.

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

## #1317 door-camera-help (flag `organiserTicketing` ON locally via VITE_ENABLE_ORGANISER_TICKETING; OFF in prod)
Mock honesty: camera states are driven by an init script that replaces `navigator.permissions.query` (prompt / granted / denied / throws = iOS) and `getUserMedia` (real Chromium fake device, or NotAllowedError / NotFoundError / NotReadableError). User-agent is overridden for iPhone Safari, Instagram in-app and a Pixel. **BLOCKED (cannot be mocked honestly):** a real "Don't allow" on a phone, a real iOS Safari permission sheet, a real settings change back to Allow (the watch that restarts the camera). The "live camera" pictures show Chromium's green fake-device feed, not a QR scan.

| Picture | Verdict | What I saw |
|---|---|---|
| ask-0-load | PASS | state ask: "To scan tickets, this page needs your camera." / "Tap Start camera, then tap Allow." big orange **Start camera**; "No camera? Type the code below, or open tonight's list."; code box below. getUserMedia calls = 0 at load. |
| ask-1-after-start | PASS | after Start camera: live feed (fake green), "Point the camera at the QR code", code box. getUserMedia calls = 1. NIT: the "3 of 8 in" pill sits on top of the feed's top-left (pre-existing layout). |
| granted-0 | PASS | granted: goes straight to the live camera, no help card. |
| denied-android-0-steps | PASS (NIT) | "The camera is blocked for this page." + 4 steps (padlock > Permissions, Camera > Choose Allow > come back and tap Try the camera again) + in-app line + **Try the camera again** + list link. NIT: the steps are indented but have no numbers or bullets, so they read as loose lines. |
| denied-android-1-still-blocked | PASS | after Try the camera again (still denied): lead line becomes "Still blocked. Follow the steps, then tap Try the camera again. Or type the code, or use tonight's list."; steps and button stay. |
| denied-android-2-list | PASS | open tonight's list: Tonight's list tab with 4 mocked rows, line "The camera is blocked for this page. The Scan tab shows how to turn it on. Or type the code, or use tonight's list.", code box on top. |
| denied-iphone-0-steps | PASS | iPhone Safari UA: "Tap the aA at the left of the address / Tap Website Settings / Tap Camera, then Allow." |
| denied-insta-0-steps | PASS | Instagram in-app UA: generic two-step "Open your browser settings for this site and set Camera to Allow." plus the "open it in Chrome or Safari" line (that line shows for every browser, not only in-app). |
| ask-decline-1-after | PASS | ask, Start camera, browser says no: moves to the denied card with steps and Try the camera again (desktop Chromium UA, so the generic steps). |
| unknown-0-load | PASS | iOS (permissions.query throws): same "Start camera" card as ask, 0 camera calls until tapped. |
| unknown-1-after-start | PASS | after Start camera: live feed. |
| none-0 | PASS (NIT) | no camera: the list tab opens by itself with "No camera found on this phone. Type the code, or use tonight's list." code box and list. NIT: no Try again here. |
| failed-0 | PASS (NIT) | NotReadableError: list tab opens with "The camera did not start. Type the code, or use tonight's list." No retry control visible on this tab; I did not open the Scan tab for none/failed, so CANNOT-TELL whether a Try again lives there. |

Sweep (all door pictures): `w19` records empty (no tap under 44px in `.p3-theme`/dialogs, no garbled punctuation, no sideways scroll, no error card). Apostrophes render as proper curly quotes in every picture I read.
Not walked: checking a typed code after "Still blocked"; light mode (door rooms are dark); desktop width.

## Walk method notes
- Pictures I did not open were deleted from the repo (some W-35 Drop-path and Switch-list pictures).
- The #1316 branch was cut from an older main (ea16d47); the walk used that branch exactly as it stands.
- No product code, no PR, nothing on the three PR branches was changed or pushed.
