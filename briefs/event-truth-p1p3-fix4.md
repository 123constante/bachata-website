# Brief: Website FIX-4 worker, event-truth P1+P3 after the fix-3 review

Branch `arc/event-truth-p1p3-fix4`, created FROM `origin/arc/event-truth-p1p3-fix3` (ceb5df79). Never use `gh api` in this repo
(it stalls on a permission prompt): read with `git fetch` + `git show`. The orchestrator merges your branch and opens the ONE
Website PR; open NO PR. Handover: `docs/handover/event-truth-p1p3-fix4.md`.

The fix-3 review (local, xhigh) found the items below; the orchestrator read the tree and CONFIRMED F1. File:
`src/modules/organiser/events/NewEventPage.tsx` (line numbers at ceb5df79).

Rules that hold: `src/lib/eventCategory.ts` byte-identical; never touch `src/components/calendar/**`,
`src/components/EventCalendar.tsx`, `src/hooks/useCalendarEvents.tsx`; no budget/pin/`vendor-ui*` list raised; HTML entities
(`&hellip;`) in JSX, never raw Unicode punctuation; explicit px tap targets. EVERY fix gets a test that is RED on ceb5df79
first (run it before the fix, say so in the handover) and each new rule gets a mutant (a mutant that leaves the suite green is a
finding). Same fact reads the same on every screen from one mapping; no copy points at a control that is not on screen; a
control that cannot work is disabled WITH a reason or absent; saving an untouched record sends nothing.

## Fixes

1. **F1 (data integrity, the serious one).** Line 93 `if (isServerRefusal(err) && !made) { sentRef.current = null; setSent(false); }`
   unfreezes on ANY coded error (`isServerRefusal` = object with a non-empty string `code`, so PGRST301 JWT expiry, 57014
   timeout and 40001 all count), including the RETRY of an earlier lost-reply send. The person can then edit name/chip and press
   Create: new commands under the SAME `keys.create` / `seriesId`; the server replays the stored create without comparing the
   payload, so name B / Class is applied to stored party A. Fix: unfreeze ONLY when the press that failed was the FIRST send
   (`kept` was null) AND no earlier send went unconfirmed. Track "an earlier send went unconfirmed" in a ref set whenever a send
   ends in a non-refusal error or a refusal that is not the first press. Tests (table-driven, red first): (a) first press lost
   reply (non-refusal) then retry rejects with a coded `{code:'PGRST301'}` / `57014`: name, chips and organiser chips STAY
   disabled and the next press resends a byte-equal create; (b) first press refused with a code: unfreezes (nothing saved);
   (c) first press refused, second press lost reply, third press coded error: frozen.
2. **F2.** The page swaps the form for `ErrorState` when the Home query errors (`refetchOnWindowFocus`, retry 1): the form
   unmounts and `sentRef`, `keys`, `seriesId` are lost, so a later Create is a second event. Fix: show `ErrorState` only when
   `home.isError && !home.data`; with data present keep the form mounted. Test: Home query errors after a lost-reply send; the
   form stays mounted and the next press sends the SAME key/series id.
3. **F3.** Open the event (line 180) is enabled while `busy && made` (schedule and first-session steps still running); tapping it
   mid-run can race the schedule (version conflict, then `create()` navigates again). Mount it only when `made && !busy`.
   Update the existing test that pins "enabled while busy". Test: absent while busy after made, present when idle.
4. **F5.** Unconfirmed phase (`sent && !made`) and the organiser becomes blocked (`block` set after a Home refetch): Create is
   disabled, chips frozen, and the page has no exit. The shell Back link is the exit: when `sent && !made && block`, add one
   sentence under the block message ("If your event was saved it is in your Events list; use Back to leave.") built in
   `eventType.ts` with the other copy, naming only controls on screen. Test the shape.
5. **F9.** The hint for made-and-busy tells the person to press Create, which is busy. Make `chipHint` read
   `Finishing your event&hellip;` for (made x busy) and extend the phase x busy table-driven test.
6. **F10.** Raw U+2026 in two test files: replace with `…` (find with `grep -rnP "\x{2026}" src/modules/organiser/events/__tests__`).
7. **F4 (measure, do not guess).** The hint box is `min-h-[36px]`; the Class hint is ~114 chars. In a 390x844 browser
   (headless Chromium, html font ~13.57px) measure the Create button's `y` before the press, while spinning, and after each
   phase for each chip; report the numbers. If it moves, make the box fit the longest hint of the table (a unit test pins
   that no hint exceeds the box's line count).

## Not in scope
F6/F7 beyond what the tests above cover, F8 reuse, `organiserFake.ts`, `scripts/**`, `eventCategory.ts`.

## Checks before you push
Every no-secret step of every `pull_request` workflow as the fix-3 handover's table, then `npm run pre-ship`. Report each exit
code; env-only reds named (the fix-3 handover names the baseline: any NEW red is yours). Mutation table for fixes 1, 2, 3, 4, 5.
Handover with Verified / Not verified and which lines are new logic (the orchestrator reviews your delta ONCE). Push, stop.
