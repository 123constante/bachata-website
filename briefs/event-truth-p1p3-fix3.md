# Brief: Website FIX-3 worker, event-truth P1+P3 after review round 2

Branch `arc/event-truth-p1p3-fix3`, created FROM `origin/arc/event-truth-p1p3-fix2` (a8be7fa5; code identical to 366f1850,
only the handover differs). Never use `gh api` in this repo (it stalls on a permission prompt): read with `git fetch` +
`git show`. The orchestrator merges your branch into `feat/event-truth-p1p3-b` and opens the ONE Website PR; open NO PR.
Handover: `docs/handover/event-truth-p1p3-fix3.md`.

Read first: `docs/handover/event-truth-p1p3-fix2.md` (your start branch). Review round 2 (local, xhigh, over
572612e1..366f1850) found the items below; the orchestrator VERIFIED 1-4 and 8-11 by reading the merged tree. Line numbers
are at 366f1850.

Rules that hold: `src/lib/eventCategory.ts` stays byte-identical (LF sha256 prefix a8d972e7; the admin tree at fa1cc07 now
carries the same bytes and its test pins them, so finding "twins differ" is ALREADY resolved: touch nothing there);
never touch `src/components/calendar/**`, `src/components/EventCalendar.tsx`, `src/hooks/useCalendarEvents.tsx`
(ask-first list); no budget, pin or `vendor-ui*` list raised; HTML entities, never raw Unicode punctuation, in JSX
(`&hellip;`, `&rsquo;`); compact density; explicit px sizes for tap targets. Every fix gets a test that is RED on a8be7fa5
first (run it before the fix, say so in the handover), and each new rule gets a mutant. Owner rules: the same fact reads the
same on every screen from one shared mapping; no copy points at a control that is not on screen or cannot work; every
empty state says what the person can do; a control that cannot work is disabled with a reason; saving an untouched record
sends nothing.

## Fixes

1. **Freeze the create the moment it is SENT (review F1 + F2, the serious one).** `NewEventPage.tsx` locks the chips only
   after a CONFIRMED create reply (`setTypeLocked(true)` at ~line 69). A lost reply on the FIRST create (saved server-side)
   leaves the chips unlocked; the create is replayed by (actor, idempotency key) and the reviewer reads the server as not
   comparing the payload, so a different chip would mix the stored create (duration 120) with the new chip's schedule and
   seed (Party 300 min on a 120-min series, or weekly Class dates on a 300-min series). Separately `name`, `organiserId`,
   `today` and `cityId` are re-read on every retry while the replay returns the stored reply (editor opens with the OLD
   name; `block`/`canSend` computed for another organiser; the start date shifts after London midnight).
   Replaying an IDENTICAL payload is harmless whatever the server does, so the fix does not depend on the server:
   - On the first press, compute `cmds` ONCE and keep it (with the chosen `type` and `organiser.id`) in a ref/state the
     retry reuses verbatim. Every later press sends the SAME create and the SAME schedule, never re-reading name, organiser,
     today or city.
   - From the moment the create is sent, the name field, the three type chips and the organiser chips are disabled (a
     `frozen` flag set before the `await`), for the life of the page. Disabled controls need their reason on screen (see 3).
   - Tests: (a) create reply lost (rejects with a non-refusal error) -> name, type chips and organiser chips stay disabled
     and a second press sends a create whose payload is byte-equal to the first (assert `runSeriesCommand` calls 1 and 2
     carry deep-equal `cmds.create`), even after the test changes `today` (fake timers) and the organiser; (b) a server
     REFUSAL of the first create (`isServerRefusal` true: nothing was saved) unfreezes name, chips and organiser chips,
     and the retry may use a changed name or chip; the idempotency keys stay exactly as today (do not change key
     handling). Say in the handover which branch of the catch each case takes.
2. **Own in-flight hint (review F3).** While the FIRST create is in flight the hint is `CHIPS_LOCKED_HINT` ("your event is
   made", "Press Create to finish", "or open the event"): all false then. Three states, one hint each, from one function
   in `eventType.ts` (not three inline strings): creating (`Creating your event&hellip;`), sent but not confirmed and not
   busy (`Not confirmed yet. Press Create to finish: nothing is made twice.`), made (the existing locked hint, whose doc
   comment is stale: fix the comment). Table-driven test: every (phase x busy) pair reads its one hint.
3. **Open the event: below Create, only when the event exists (review F4, F10).** The Open button mounts above Create on
   EVERY create, so the tapped button jumps about 68px at 390x844. Render it BELOW the Create button (nothing above the
   tapped control moves), mounted only once the create is CONFIRMED (the event exists; never in the "not confirmed"
   phase, where opening an event that may not exist is a dead end). Remove the now-redundant `scheduleFailed ||` (it drives
   nothing once the phase state exists). Test: Open absent before the first create reply, present and ENABLED after it;
   present-and-disabled is no longer a state. An e2e assertion in `tests/e2e/organiser-events.spec.ts` at 390x844: the
   Create button's bounding-box `y` is the same before the press, while it spins and after the create reply.
4. **Unsaved-changes guard (review F11).** The guard still fires once the event exists, contradicting "saved as a draft".
   Disable it when the create is confirmed (made): `enabled: name.trim() !== '' && !busy && !created && !made`. The guard
   STAYS on in the "not confirmed" phase. Test both.
5. **Cancelled-only copy (review F8).** The Type row says "Add a session once a date is listed under When, and it is set for
   you." on a series whose every upcoming date is cancelled, while When lists those dates and the Schedule card says "Every
   upcoming date is cancelled". Two cards disagree. For that shape (cancelled upcoming dates exist, none listable) name the
   real next step using only controls ON SCREEN: check `DatesTakenOff.tsx` / `takenOff.ts` (is a cancelled UPCOMING date in
   the Put back list? is Put back disabled by `dirty`/lock?) and `EditorRows.tsx:29`. Give `TypeRowState` the field it
   needs; the sentence is built in `eventType.ts` only; every (locked x hasUpcoming x cancelled-only x category) row of
   `eventTruth.matrix.test.tsx` states the expected text, and the editor snapshot matrix (`editorOrder.matrix`) is updated
   deliberately. If the control the copy names is not rendered in some state of the matrix, that is a red test.
6. **One helper for the editor's `next` (review F9).** `EventEditorPage.tsx:175` still inlines
   `upcoming.find((d) => d.lifecycle_status !== 'cancelled')` (raw string) while `newEvent.ts` claims one helper. Move
   `firstListedDate` to `shared/seriesModel.ts` (next to `upcomingDates` / `isCancelledDate`), import it in both, and update
   the `newEvent.ts` comment. A test pins that a date with `lifecycle_status 'cancelled'` is skipped identically in both.
7. **Test hygiene (review F6, F7).** `pages.test.tsx` ~255-256: the in-flight test ends with a bare `release()`, so the
   create keeps running into the next test's `mockReset` (order-dependent flake): await the follow-up call before the test
   ends. Add the missing test: while the first create is held in flight, Open is ABSENT (it now mounts only after the
   reply) and Create is busy; after release it appears below Create.

## Not in scope (queued by the orchestrator; do not build)
`organiserFake.ts:265` unioning programmes of dates the fake has removed (review F12, low confidence, test helper only);
seeding every weekly date; the 5 serial round trips on Create; the -1 synthetic row in the organiser date read
(admin-side); the hand-paired `lib-event-rules` chunk (kept: measured). Do not touch `eventCategory.ts`, the guard script,
or anything under `scripts/`.

## Checks before you push
Every no-secret step of every `pull_request` workflow, as the fix-2 handover's table (unit legs incl. the two tz lists,
typecheck jobs, e2e full list with the workflow env, architecture-guard integrity steps, bundle-budget build + both
ratchets, the lint chain, db-contract-check no-secret steps incl. `check-event-truth-v1.mjs --self-test`), then
`npm run pre-ship`. Report each exit code; environment-only reds named as such (the 17-case set the fix-2 handover names is
the baseline: any NEW red is yours). Mutation table for fixes 1, 2, 3, 4 and 6 (a mutant that leaves the suite green is a
finding, not a pass). Handover with Verified / Not verified. Push, stop. Fixes to review findings are unreviewed code: the
orchestrator reviews your delta once, so keep it minimal and say which lines are new logic.
