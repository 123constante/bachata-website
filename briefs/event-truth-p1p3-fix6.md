# Brief: Website FIX-6 worker, event-truth P1+P3 after the xhigh code review of fix-4

Branch `arc/event-truth-p1p3-fix6`, created FROM `origin/arc/event-truth-p1p3-fix4` (head e647a587). Never use `gh api` in this repo
(it stalls on a permission prompt): read with `git fetch` + `git show`. Open NO PR; the orchestrator merges and opens the ONE PR.
Handover: `docs/handover/event-truth-p1p3-fix6.md`. Push ONLY `arc/event-truth-p1p3-fix6`.

The review (xhigh, over the fix-4 merge) found 12 findings, all from reading the diff, none from a failing test. Owner decision:
"Fix everything first". Line numbers are from the review; re-find them at your base.

NOTE: the next arc REPLACES the New event chips and the organiser Type row. For F-b, F-c, F-e keep the fix MINIMAL and correct, no
polishing of code that arc deletes; say so in your handover.

Rules that hold: `src/lib/eventCategory.ts` byte-identical; never touch `src/components/calendar/**`, `src/components/EventCalendar.tsx`,
`src/hooks/useCalendarEvents.tsx` (density-excluded); no budget/pin/`vendor-ui*` raised; `&hellip;` entities in JSX; explicit px tap targets.
EVERY behaviour fix gets a test that is RED on e647a587 first (say so in the handover); each new rule gets a mutant (a mutant that
leaves the suite green is a finding). Same fact reads the same on every screen from one mapping.

## Findings
- **F-a** `scripts/check-event-truth-v1.mjs:288`: CI #70 reds the PR and main until admin #780 is applied. No code can reorder merges.
  Make the guard's failure message say plainly "admin #780 (derived category) must be applied first", test the message.
- **F-b** `eventType.ts:114` `typeSublabel` says "Set by its sessions" for a legacy draft with a stored category and NO session; the
  snapshot rows `draft-norule-one`, `draft-norule-one-rejected`, `draft-weekly-first-off` contradict the review card "Add at least one
  session first." Make both read the same fact.
- **F-c** `eventType.ts:117` a series whose only session is a performance (no genre) reads "Add a session ... and it is set for you"
  although a session exists (`deriveCategories` gives set [] word null for performance). Say the true thing for that shape.
- **F-d** `endedRun.ts:77` `runNoun` maps stored `workshop` to `class` via `wordForStored`, while `app/lib/ogCardRender.ts` `PILL_LABELS`
  still prints WORKSHOP. One shared mapping (or, if `app/` cannot import it, a mirrored table plus a parity test); table-driven test.
- **F-e** `NewEventPage.tsx:121` the Class chip lists 8 weekly dates but seeds ONE added session on the first date only, so dates 2-8
  have no session (the calendar reads hasClass from the programme). Smallest correct fix: seed every listed date, or stop listing
  dates the chip does not fill; test the shape. Self-serve is OFF in prod.
- **F-f** `eventTruth.matrix.test.tsx:129` lib and guard map social->party and masterclass->class; the calendar tabs
  (`calendarUtils.matchesCategory`) do not. Parked as `it.todo`; the parity corpus never compares the guard with the READER. Fix on the
  test/guard side ONLY (never edit calendar files): turn the todo into a real row that pins the reader's behaviour, or queue it with a
  named doc line. State which.
- **F-g** `NewEventPage.tsx:121` three round trips after create (full `fetchSeriesWorkspace` just for dates, `fetchOccurrenceProgramme`,
  `saveOccurrenceProgramme`): read only the first occurrence id; fewer calls, same result; test the call count.
- **F-h** `NewEventPage.tsx:77` a `resolveCreateCityId` failure (before anything is sent) lands in the "could not confirm the save"
  catch and also passes through `reopensAfterFailedCreate` as if refused. Own message "We could not look up your city; nothing was
  saved", never freeze, nothing sent. Test red first.
- **F-i** `EventEditorPage.tsx:168` hand-rolled `d.lifecycle_status !== 'cancelled'` on the same list as
  `firstListedDate`/`isCancelledDate`: use the helper.
- **F-j** `seriesCommands.ts:224` dead conditional `category` strip; `'category'` kept in `OWNER_UPSERT_KEYS`. Destructure
  unconditionally or comment it as server-only; the mirror test pins the key, keep it consistent with the server allowlist.
- **F-k** `pages.test.tsx:434` fixed 20 ms real-timer sleeps: `waitFor` the observable state.
- **F-l** `vite.chunks.ts:284` `londonDate` pulled into `lib-event-rules`; no-new-request measured only on the 8 budgeted routes.
  Measure the request count on the unbudgeted routes that load it, or document the limit in the handover and the file comment.

## Checks before you push
GitHub Actions is UNAVAILABLE (billing refusal, not a code failure). Run EVERY no-secret step of every `pull_request` workflow
(read `.github/workflows`), then `npm run pre-ship`. Fill the per-job table (command, exit code) in your handover BEFORE your last
turn (a placeholder is a gap); env-only reds named against the fix-4 baseline, any NEW red is yours. Mutation table per fix.
Handover with Verified / Not verified and which lines are new logic (the orchestrator reviews your delta ONCE). Commit, push, stop.
