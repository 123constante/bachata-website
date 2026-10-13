# Handover: event-truth P1 -- Website UI/tests slice

Branch `arc/event-truth-p1p3-ui-b` (from `main` at 5e0ec4c). First commit is a8efae3c applied unchanged
(`git am`, local sha bc47fff); the second commit is this slice's review fixes, tests and the snapshot.
Brief: `arc/briefs-event-truth:briefs/event-truth-p1-ui.md`. No PR opened (the orchestrator merges into
`feat/event-truth-p1p3`). The guard worker's files were not touched.

Head SHA, per-job results and Verified / Not verified: see the bottom of this file.

## 1. Review of a8efae3c (findings and fixes, all in the second commit)

| # | Finding | Fix |
|---|---------|-----|
| F1 | `tests/e2e/organiser-events.spec.ts` is IN the `test:e2e` gate (e2e-smoke.yml) and still asserted the old copy ("Choose what it is: a class, a party, or a course or workshop.") and `category: 'class'` / `'party'` in the create payload. The patch would have red the e2e gate. | Spec asserts the new copy, `not.toHaveProperty('category')`, the ONE seeded session (`organiser_set_occurrence_programme_v1` body, occurrence id, times) and the Type row reading "Class" / "Night". The e2e fake now mirrors the server: a create stores `category: null` whatever is sent, a fresh series has no programme, and a programme save re-derives the category through the shared lib (`storedCategory(deriveCategories(...))`). |
| F2 | `src/modules/organiser/shared/homeModel.ts` kept a second copy of the word map (`CATEGORY_LABEL` with `workshop: 'Workshop'`), the kind of copy the arc forbids. No importer. | Deleted. |
| F3 | After a failed dates / first-session step the chips are disabled, but the hint under them still showed the chip's normal hint, so nothing on screen said why they are locked. | `CHIPS_LOCKED_HINT` ("Already chosen: your event is made with it. Press Create to finish, or open the event.") replaces the hint while `scheduleFailed`. Tested in pages.test. |
| F4 | `typeSublabel` said "Change the sessions on a date and it follows" on ended / archived series (locked, nothing editable) and "Add a session to one of its dates" on series with no upcoming date (no date to put one on) -- copy pointing at controls that are not there (CLAUDE.md definition of done, rule 2). | `typeSublabel(format, category, { locked, hasUpcoming })`; the editor passes `eventLock` and `upcomingDates`. Locked or no upcoming: "Set by its sessions." / "No session, so not set." / "Add a session once a date is listed under When, and it is set for you." Covered by the matrix (pure, 100 cases) and by rendered rows over real shapes. |
| F5 | `src/lib/__tests__/eventCategory.test.ts` carried a dead TODO (`void TOKENS; void categoryAgrees;`). | Replaced with a `categoryAgrees` table over every prod token; the guard-vs-lib parity test is the guard worker's (`eventCategory.parity.test.ts`). |
| ok | Byte pin: `tr -d '\r' < src/lib/eventCategory.ts \| sha256sum` starts `a8d972e7` (matches the brief). Not edited. | -- |
| ok | HTML entities: no non-ASCII byte in the patch or in this slice's source. Density: no layout change (chips, rows, hints unchanged in size). Breadcrumbs: organiser shell, not `GlobalLayout`. | -- |
| ok | Seed step: `firstListedDate` skips past and cancelled dates; `seedSessions` returns null on a date that already holds a session (a replayed Create never seeds twice); a refused seed is shown in plain words with "Open the event". The create / schedule idempotency keys are unchanged. | -- |
| note | `runNoun(..., null)` (no session yet, no stored word) still reads "night" on the ended line, as before the patch. Kept: an ended series with no session is the pre-arc shape and the owner's label list has no "event" word. | -- |

## 2. Mutation proof (run with the fixed tests; the mutants target the patch's own code)

Script: one mutant at a time, six suites, then `git checkout` of the file. Results (red = failing tests):

Suites run per mutant: newEvent.seed, pages, eventTruth.matrix, fixesBatch.matrix, endedRun, createModel
(315 tests; control run 0 red).

| Mutant | Red tests |
|--------|-----------|
| (a) `seedSessions` returns `null` always | 8 red: `newEvent.seed.test.ts` "seedSessions ... class / party / workshop -> exactly one new session" and "every chip has a seed"; `pages.test.tsx` "the class / party / workshop chip seeds one session on the first upcoming date" (+ the hint case). |
| (a') `seedSessions` returns `[]` (seeds nothing) | 7 red: the same four in `newEvent.seed.test.ts`; the three chip cases in `pages.test.tsx`. |
| (b) Type row: `categoryLabel` returns the raw stored value capitalised | 23 red: `eventTruth.matrix.test.tsx` 19 (every `party` row, "Party" not "Night"; every `workshop` row; course / festival rows), `fixesBatch.matrix.test.ts` 4 ("category reads" table). |
| (b') `EventEditorPage` renders `ws.series.category` instead of `categoryLabel(...)` | 8 red: `eventTruth.matrix.test.tsx` rendered rows (editable / no-upcoming / locked x stored party and workshop, course and festival, every shape x workshop). |
| (b'') `runNoun` back to the raw category (stored `workshop` reads "workshop") | 4 red: `endedRun.test.ts` "names a class, workshop and masterclass from CATEGORY"; `eventTruth.matrix.test.tsx` one_off / recurring / null + workshop. |
| (c) `createPayload` sends `category: 'class'` again | 3 red: `createModel.test.ts` "sends the exact keys for a full weekly class", "sends only the five always-keys for a bare party", "createSeriesCommand adds exactly one key". `pages.test.tsx` and `fixesBatch` stay green on this mutant BY DESIGN: `createSeriesCommand` routes through `upsertCommand`, which strips any category (second line of defence), so the wire never carries it; `createModel.test.ts` is the test that guards the payload builder itself. |
| Review findings, unfixed code (a8efae3c's `eventType.ts`, `NewEventPage.tsx`, `EventEditorPage.tsx` restored) | 56 red: `eventTruth.matrix.test.tsx` 55 (the sublabel on locked / no-upcoming states, F4); `pages.test.tsx` 1 (the locked-chips hint, F3). |

Note on method: the first run reverted files with `git checkout`, which also wiped this slice's uncommitted fixes
and contaminated three mutants; it was re-run with backup copies (sha256 of the three fixed files identical
before and after). Both logs are in the session's scratch, the table above is the clean run.

## 3. Consistency matrix (`src/modules/organiser/events/__tests__/eventTruth.matrix.test.tsx`)

Shapes: format {one_off, recurring, course, festival, null} x stored {party, class, workshop, masterclass, null}
x editor state {editable+upcoming, editable+no upcoming, locked, locked+upcoming}.

- Type row value (`categoryLabel`) and the event page ended noun (`runNoun`) for all 25 format x stored pairs:
  both read `wordForStored`; a stored workshop reads "Class" / "class" everywhere; never "workshop".
- Type row sublabel for all 100 (pair x state) cases: never names a control that is not on the page.
- Calendar tab membership (`transformCalendarEvents` + `matchesCategory`) agrees with `deriveCategories().set`
  for every session set a create can seed and the legacy `workshop` item type; a performance is in neither tab.
- Rendered Type row (real `EventEditorPage` over prod-survey shapes): editable (`live-weekly-until`), no upcoming
  (`live-norule-lapsed`), locked (`ended-picnic`), course, festival, and every shape x stored workshop.
- Saving an untouched record sends no command: `editorOrder.matrix` test (4) per shape (unchanged, green).
- Empty states say what to do: `org-dates-none` sentences (snapshot, unchanged) and the Type row's no-session copy.
- Disabled chips carry a reason: `CHIPS_LOCKED_HINT` (pages.test).

Literal survey (`'workshop' | 'party' | 'class' | 'masterclass'` in `src/modules/organiser` and
`src/modules/event-page`, non-test): every survivor is SESSION vocabulary (programme item / section types used to
render a schedule, `SESSION_TYPES`, `newSession('class')`, `typeTone`), the create FORM kind (`EventKind`
`'party' | 'weekly_class'`, which sets the format only), or a status tone (`LifecycleTone`). None maps a stored
category to a word; the one that did (`homeModel.CATEGORY_LABEL`) is deleted (F2). `sections/EventScheduleGrid.tsx`
and `FestivalProgramSection.tsx` are in the mostly-dead `sections/` tree and render session items, not the category.

Known divergence, queued for Ricky (not changed: `src/components/calendar/calendarUtils.ts` is on CLAUDE.md's
ask-first list): the calendar's own program scan counts only `party | class | workshop` item types; a `masterclass`
or `social` item reaches a tab there only through the RPC's `key_times`. The lib puts a masterclass under Classes
and a social under Parties. Recorded as an `it.todo` in the matrix.

## 4. Snapshot (`editorOrder.matrix.test.tsx.snap`)

29 cases red on the patch: every entry's `org-row-type` text. Regenerated with `-u` once the copy was final; the
diff is ONLY the Type row: "TypeChosen when the event was made. To change it, ask the Bachata Calendar team.Party"
-> "TypeSet by its sessions. Change the sessions on a date and it follows.Night" (editable with upcoming dates),
"TypeSet by its sessions.Night" / "...Class" (locked or no upcoming), "TypeSet by its format.Course" / "Festival".
Party -> Night is the owner's label list; the sublabel is F4's. Nothing else in the snapshot moved.

## 5. CI steps run locally (Node 22.22.0)

| Workflow / job | Step | Local result |
|----------------|------|--------------|
| unit-tests.yml `unit` (full, Europe/London) | `npm run test:unit` | 6009 passed, 25 skipped, 1 todo, 0 snapshot failures; 15 red = the environment-only set below (same 15 on the unreviewed patch; the patch's 29 snapshot reds are gone) |
| | `npm run test:unit:timing` | green (exit 0) |
| unit-tests.yml `unit` (tz-sensitive) | America/New_York list | green (exit 0) |
| | Australia/Sydney list | green (exit 0) |
| typecheck.yml | `check:rpc-typing` | green |
| | `check:wallclock-brand` | green |
| e2e-smoke.yml | `npm run test:e2e` (full list) | still running at the context gate (started with the workflow's env); the two changed specs (organiser-events 9 passed, organiser-loop 1 passed) are green individually. Next session: re-run `npm run test:e2e` and record it. |
| | `organiser-events.spec.ts` alone | 9 passed |
| | `organiser-loop.spec.ts` alone (updated: the seeded "Class" session is the one staffed) | 1 passed |
| architecture-guard.yml (`integrity`) | `bin/check-integrity.sh` | green |
| | `check:legacy-tables`, `check:legacy-program-rpcs` | green, green |
| | `lint:architecture` | green |
| | `check:images` with `AUDIT_STRICT=1` | green |
| | `check:image-widths:self-test`, `check:image-widths` | green, green |
| | `check:plan-hygiene:self-test` | green |
| | `check:workflow-artifact-policy:self-test`, `check:workflow-artifact-policy` | green, green |
| | `check:mojibake:self-test`, mojibake `git grep` | green, green |
| | `prove:entry-point:self-test`, `prove:entry-point` | green, green |
| `npm run lint` (chain) | 16 links | 16 of 16 green (needs `chmod +x bin/*.sh` first, as CI does; the mode bits were put back before commit). eslint tail: informational, red backlog as on main. |
| `npm run pre-ship` | full | FAILED, 4 reds: (1) `check:integrity` exec bit on `bin/check-integrity.sh` (the same guard is green when run as CI runs it, after chmod); (2) `test:unit` 19 red = the 15 environment-only cases + `latestEvents.contract` (2, same cause) + `OrganiserProfileEmpty.matrix` and `festivalClientState` (1 each, load-flaky, both green when run alone); (3) `check:bundle-budget`: event route 380.7 KB vs 380 KB budget; (4) `check:first-load-requests`: +2 requests on /parties, /classes, /faq and the three landing pages. (3) and (4) are GREEN on a clean `origin/main` worktree (same build, same vendor-supabase +14.3 KB drift), so they are this branch's: the diff of /faq's modulepreload list shows two new chunks, `accountRouting` and `authRouting`, pulled in because this tree builds a SECOND root chunk (`root-CNfoH7Y2` next to `root-DoWiNfNR`) that statically imports them; main has one root chunk. Root cause not found before the context gate: OPEN, see the session handover. Suspects: the new `src/lib/eventCategory.ts` import from `endedRun.ts` (event page) and from `eventType.ts` (organiser) changing how Rollup splits the shared graph. typecheck ratchet, scoped eslint (0 errors in 21 files), build, scope-drift: PASS. |
| whole-tree `npm run typecheck` (NOT a CI gate; pre-ship ratchets it) | | 91 errors, the IDENTICAL set on a clean `origin/main` worktree (verified by diff of file:line:code); none in a file this branch touches. Under pre-ship's baseline of 106. |

Not CI, noted: 15 `*.contract.test.ts` / `integrityCouldNotRun.test.ts` cases red in THIS environment on every tree
(placeholder Supabase key -> "Invalid API key"; typescript resolves from a parent dir so the could-not-run
precondition is gone). Same reds on the unreviewed patch and on the fixed tree; CI runs the contract suites with
real secrets (or skips them offline per `ci-live-db-gate.mjs`).

## 6. 390x844 walk script (for the orchestrator, on prod-shaped data; needs an organiser login)

Not walked here: no login, no prod data in this environment. Walk it at 390x844 (phone), signed in as an
organiser with a LIVE organiser profile.

1. `/account/o/events/new`. Expect: "Event name" field, then a "First session" section with three chips
   "Class", "Party", "Workshop" and the hint "Choose one. It becomes the first session; you can add more after."
   Chips are 44px tall; nothing wraps oddly at 390px.
2. Tap Create with no name. Expect the red line "Give your event a name." under the form; nothing sent.
3. Type a name, tap Create with no chip. Expect "Choose the first session: a class, a party or a workshop."
4. Tap "Workshop". Expect the hint "One date with a workshop session (listed under Classes). Add more sessions after."
5. Tap Create. Expect the editor to open at `/account/o/events/<id>`. In "What it is": the Type row reads
   "Class" with "Set by its sessions. Change the sessions on a date and it follows." (the DB derived it from the
   seeded class session titled Workshop). "When" shows ONE date, 7 days out. Open that date: one session
   "Workshop", 20:00-22:00, type class.
6. Back on the event, Save with nothing touched: the bar's action is disabled; nothing is sent.
7. Repeat 1-5 with "Party". Expect Type "Night", one date, one session "Party" 20:00-01:00 (ends next day).
8. Repeat with "Class". Expect Type "Class", 8 weekly dates, a "Class" 20:00-22:00 session on the FIRST date only.
9. Public calendar (`/parties`, `/classes`): the party from step 7 is under Parties only once the series is live;
   the workshop from step 5 under Classes. (Needs the event sent for review and approved, or check with an
   already-live series whose only session is a class.)
10. An ended series' event page (`/event/<id>` of an ended recurring class): the ended line says "This class has
    finished...", never "workshop"; a stored-workshop series says "class".
11. Open an ENDED or ARCHIVED event in the organiser editor: Type row shows the word with "Set by its sessions."
    (no "change the sessions" pointer); a series with no session shows "Not set" and "No session, so not set."
12. Failure path (optional, needs a cancelled first date or a network drop after the dates listed): the error
    reads "...saved as a draft, but the first session was not added...", the chips are greyed with the hint
    "Already chosen: your event is made with it. Press Create to finish, or open the event.", and "Open the event"
    opens the editor.

## 7. Verified / Not verified

**Verified (here):** byte pin of the lib; every unit suite this slice touches; the full unit suite (6009 green, 0 snapshot reds, the 15 environment-only reds identical to the baseline); mutation proof for every mutant the brief named plus the review findings; the two changed e2e specs; every architecture-guard (integrity) step; both typecheck workflow steps; the lint chain (16/16); timing and timezone unit steps; eslint on the ship's files.

**Not verified:** the 390x844 walk on prod-shaped data (no login / prod data here; script in section 6); the admin twin byte test (skips without the sibling checkout; the sha256 matches the brief's pin); the full `test:e2e` list as one run (see the e2e row); `pre-ship` is RED on the two bundle ratchets, which are this branch's and still OPEN (see the pre-ship row); the contract suites against the live DB (placeholder key here); the calendar masterclass / social parity (ask-Ricky file, `it.todo`).
