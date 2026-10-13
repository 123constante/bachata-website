# Brief: Website FIX-2 worker, event-truth P1+P3 after reviews A and B

Branch `arc/event-truth-p1p3-fix2`, created FROM `origin/arc/event-truth-p1p3-fix` (572612e1). Never use `gh api` in this
repo (it stalls on a permission prompt): read with `git fetch` + `git show`. The orchestrator merges your branch into
`feat/event-truth-p1p3-b` and opens the ONE Website PR; open NO PR. Handover: `docs/handover/event-truth-p1p3-fix2.md`.

Read first: `docs/handover/event-truth-p1p3-fix.md` (your start branch) and review B's findings
(`git show origin/arc/event-truth-p1p3-review-b:docs/handover/event-truth-p1p3-review-b.md`). Review A's findings are
summarised below; the orchestrator verified 1 and 2 by reading the code.

Rules that hold: `src/lib/eventCategory.ts` stays byte-identical (LF sha256 prefix a8d972e7); never touch
`src/components/calendar/**`, `src/components/EventCalendar.tsx`, `src/hooks/useCalendarEvents.tsx` (ask-first list);
no budget, pin or `vendor-ui*` list raised; HTML entities, never raw Unicode punctuation, in JSX; compact density;
explicit px sizes for tap targets. Every fix gets a test that is RED on 572612e1 first, and the new rules get mutants.
Owner rules: the same fact reads the same on every screen from one shared mapping; no copy points at a control that is
not on screen or cannot work; every empty state says what the person can do; a control that cannot work is disabled
with a reason; saving an untouched record sends nothing.

## Fixes

1. **Type row on dates that cannot take a session (review A, 1 live prod series today).** `EventEditorPage.tsx`
   (~line 215) passes `hasUpcoming: upcoming.length > 0`, and `upcomingDates()` includes cancelled dates, so with every
   upcoming date cancelled the sublabel tells the organiser to change or add sessions on a date the writer refuses
   (`date_cancelled`). Pass whether a NON-cancelled upcoming date exists (`next !== null`, computed at ~line 174).
   Add the shape "every upcoming date cancelled" (with stored category and with NULL) to `eventTruth.matrix.test.tsx`
   and the editor snapshot matrix; the sublabel then names no session action.
2. **Copy that the rule can keep (review B F3; orchestrator decision d22, overrulable).** "Change the sessions on a date
   and it follows" is false for today's series (the derivation is the union over the series programme and every
   date, with keep-if-agrees). Editable sublabel with a listable upcoming date becomes exactly:
   `Set by its sessions across all its dates.` (no promise of a change). Keep the NULL-category guidance
   ("Add a session to one of its dates and it is set for you." / "...once a date is listed under When") as is.
   One string in `eventType.ts`; update the expected sublabels in the matrix.
3. **Create retry must not unlock the chips (review A, read at NewEventPage.tsx:56 and 64-68).** `create()` clears
   `scheduleFailed` before the create replay, and a failed replay never sets it again, so the chips unlock on an event
   that already exists and a different chip seeds a session under the old idempotency keys. Once any step after the
   create has run, the chosen type is locked for the life of the page (never reset by a retry); the chips are also
   disabled while `busy`, with the existing `CHIPS_LOCKED_HINT` as the reason. Tests: seed fails -> chips locked;
   press Create, create replay fails -> chips still locked and the original type is the one retried; chips disabled
   while a create is in flight.
4. **Guard floor (review A).** `scripts/check-event-truth-v1.mjs` (~line 430) relaxed the measurement floor to
   `section_count + added_session_count >= 1`; a broken day->section join would then pass on date-only rows alone.
   Keep `section_count >= 1` as its own floor (date-only rows can never stand in for it today: 64 of 64 live series
   have a series programme). Canary case: `section_count 0, added_session_count > 0` -> exit 2. Keep the self-test
   count honest (it is 150 now; say the new number).
5. **`kind_vs_type` reads date-only sessions too (review A, B F6).** Include `s.added_sessions` (`{kind, type}`) in the
   report scan; reported only, no gate. Canary case for it.
6. **Website-side byte pin (review A; B F1).** Add a sha256 assertion on the LF-normalised `src/lib/eventCategory.ts`
   (full hash, prefix a8d972e7), as the admin test does on its copy, so an edit to the Website file reds Website CI
   without the sibling checkout. Keep the existing twin test (it skips without the admin checkout). Fix the prose that
   claims the twin is CI-enforced if any does.
7. **One helper for "the first listed date" (review A).** `newEvent.ts` `firstListedDate` re-implements
   `upcomingDates(dates, today).find((d) => !isCancelledDate(d))`; call the shared helper (same London date).
8. **The e2e fake derives like the server (review A).** `tests/e2e/helpers/organiserFake.ts` (~line 334) derives the
   category from the one saved date only and counts `removed: true` rows. Make it derive from the union of the series
   programme and every date's date-only sessions (removed rows excluded), through the lib's `deriveCategories` +
   `storedCategory` (keep-if-agrees). Run the two organiser e2e specs and the full `npm run test:e2e` list.
9. **Leftovers (review A, B F5).** Replace the `categoryLabel` alias in `eventType.ts` with direct `categoryLabelFor`
   calls; drop `void chip;` in the matrix test; replace the self-referential "categoryAgrees over every vocabulary
   token" assertion with an explicit expected table.

## Not in scope (queued by the orchestrator; do not build)
Seeding every weekly date (needs an admin series-programme command; owner design seeds the first date); the 5 serial
round trips on Create (needs the schedule command to return occurrence ids); the -1 synthetic row showing in the
organiser date read (admin-side); the hand-paired `lib-event-rules` chunk (kept: measured).

## Checks before you push
Every no-secret step of every `pull_request` workflow, as the FIX handover's table (unit legs incl. the two tz lists,
typecheck jobs, e2e full list with the workflow env, architecture-guard integrity steps, bundle-budget build + both
ratchets, the lint chain, db-contract-check no-secret steps incl. `check-event-truth-v1.mjs --self-test`), then
`npm run pre-ship`. Report each exit code; environment-only reds named as such. Mutation table for fixes 1, 3, 4, 5, 6.
Handover with Verified / Not verified. Push, stop.
