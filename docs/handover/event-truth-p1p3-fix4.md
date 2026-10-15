# Handover: event-truth P1+P3 -- FIX-4 slice (after the fix-3 review)

Branch `arc/event-truth-p1p3-fix4`, from `origin/arc/event-truth-p1p3-fix3` (ceb5df79). Brief:
`arc/briefs-event-truth:briefs/event-truth-p1p3-fix4.md` (blob 23a60e78). No PR opened, as the brief says (the orchestrator
merges this branch). Written 2026-10-13 by the cloud worker (scheduled routine, ticket dt_a19d1cdc50a0).

Commits: `1fe4cb7` red-first tests, `064125b` source fixes and e2e, `fe215d7` F1 test strengthened (a mutant
survived the first version; see section 3), then the handover (draft checkpoint, then this final version).

Rules held: `src/lib/eventCategory.ts` byte-identical; nothing under `src/components/calendar/**`,
`EventCalendar.tsx`, `useCalendarEvents.tsx`, `scripts/**`, `organiserFake.ts`; no budget, pin or `vendor-ui*` change; no
raw Unicode punctuation in JSX or source (ellipses are `…` escapes in `.ts` strings); tap targets unchanged (the
note is text, not a control); every file over 2 KB written through `safe-edit.py` / `safe-write.py`.

## 1. Fixes, and which lines are NEW LOGIC (review these; everything else is wiring, comments, copy or tests)

| fix | file | change |
|---|---|---|
| F1 | `events/newEvent.ts` | **NEW LOGIC** `reopensAfterFailedCreate({ refused, firstSend })` = `refused && firstSend` (pure). FIX-4c: the `earlierUnconfirmed` input was dropped by owner decision (2026-10-13); it could not change behaviour (section 3). |
| F1 | `events/NewEventPage.tsx` | **NEW LOGIC** Create catch: if `reopensAfterFailedCreate({ refused: isServerRefusal(err), firstSend: kept === null })` then `sentRef.current = null; setSent(false)`. The old `&& !made` is gone: `firstSend` already implies not made. A city-lookup failure before anything is sent leaves `sentRef` null (same as before). FIX-4c: `unconfirmedRef` and its `else if (sentRef.current)` branch were dropped by owner decision; a retry still never reopens, because `sentRef` stays set after any unconfirmed send. |
| F2 | `events/NewEventPage.tsx` | **NEW LOGIC** page branch `home.isError ?` became `!home.data ?` (after `isPending`, this equals the brief's `isError && !data`). A failed refetch with data keeps `NewEventForm` mounted. |
| F3 | `events/NewEventPage.tsx` | **NEW LOGIC** Open the event mounts on `made && !busy` (was `made`). |
| F4 | `events/eventType.ts`, `NewEventPage.tsx` | **NEW LOGIC (small)** `HINT_BOX_LINES = 3`, `HINT_LINE_PX = 18`, `HINT_CHARS_PER_LINE = 40`. The hint `<p>` takes `style={{ minHeight: 3*18, lineHeight: 18px }}` instead of `min-h-[36px] leading-[18px]`, so the box and the test read one constant. |
| F5 | `events/eventType.ts`, `NewEventPage.tsx` | **NEW LOGIC** `unconfirmedExitNote(backLabel)`; rendered as `org-new-event-unconfirmed-exit` when `block && sent && !made`. Module const `BACK = { to: events, label: 'Events' }` feeds both the shell's back link and the note (one source). |
| F9 | `events/eventType.ts` | **NEW LOGIC** `chipHint`: `made` returns `busy ? 'Finishing your event…' : CHIPS_LOCKED_HINT`. |
| F10 | `__tests__/pages.test.tsx`, `createHint.test.ts`, `reviewCover.matrix.test.tsx` | Raw U+2026 replaced by `…`. The brief said "two test files", but its own grep finds three; all three fixed. The `.snap` file (generated, U+2018/2019) is left alone. |
| F3/F4 | `tests/e2e/organiser-events.spec.ts` | The FIX-3 y-test now runs at **390 and 360** with the **Class** chip (the longest hint). It holds the create, then the date (refused), and asserts Create's y is equal before, while creating and while finishing. It asserts Open is absent while finishing, then visible, enabled, below Create once idle, and that it opens the editor. |

### Deviations from the brief (each with its reason)

1. **F5 sentence.** The brief's text is "...; use Back to leave." The shell's back link on this page reads **Events**
   (`OrganiserShell back.label`), not "Back", so that sentence would name a control that is not on screen (the brief's
   own rule). The note is built from the link's label: "If your event was saved it is in your Events list; use Events
   at the top to leave." The test asserts the note against the `org-back` element's actual text.
2. **F4: a fix, although 390 did not move.** At 390x844 the old 2-line box held every hint, so Create did not move
   while running (numbers below). At **360 and 320 px** the Class hint wraps to **3 lines**, and Create jumped 18 px
   when the hint changed to "Creating...". The box now fits 3 lines. Cost: one empty 18 px line under the shorter hints
   at 375 px and up.
3. **F1 ref was redundant (equivalent mutants M1d/M1e).** See section 3. FIX-4c: dropped by owner decision 2026-10-13.

## 2. Red-first (tests committed in `1fe4cb7` and run against ceb5df79's source)

`createHint.test.ts` + `pages.test.tsx` + `reviewCover.matrix` on ceb5df79's source: **23 failed / 86 passed**.
- F1 (a) PGRST301, 57014, 40001 and (c): **4 red** (the name re-enabled after the coded error). (b) and the made-row
  (d) were green on the old code; they are regression rows, not fixes.
- F2: **red**, "Unable to find org-new-event-form". The first version of this test passed on the old code because React
  Query notifies on a later macrotask. That was a test defect, and a 20 ms flush was added before it was committed.
- F3+F9 in-flight page test: **red** (the hint read the locked sentence, then Open showed while busy).
- F5 page row "sent": **red** (`unconfirmedExitNote` missing). F9 rows, the hint-box table, the `reopensAfterFailedCreate`
  table and the note: **red** (missing exports or the old hint).

After the fix: the same 3 files are green, and `src/modules/organiser` is **81 files, 2926 passed, 1 todo**.

## 3. Mutation table (each mutant applied, run, restored; `git diff --quiet` checked after each)

Suites: `pages.test.tsx` + `createHint.test.ts` (88 tests), plus the e2e for M4.

| mutant | fix | what | result |
|---|---|---|---|
| M1a | F1 | rule drops `firstSend` | **killed** (FIX-4c re-run: 6 failed) |
| M1c | F1 | page passes `firstSend: true` | **SURVIVED at first.** The made-row resend was recomputed but identical. Test fixed (`fe215d7`): London midnight rolls over before the final resend, so a recomputed create starts a day later. Now **killed** (FIX-4c re-run: 5 failed). |
| M1f | F1 | page passes `refused: true` | **killed** (FIX-4c re-run: 7 failed) |
| M2 | F2 | `!home.data` back to `home.isError` | **killed** (1 failed) |
| M3 | F3 | Open on `made` (not `made && !busy`) | **killed** (1 failed) |
| M4 | F4 | `HINT_BOX_LINES = 2` | **killed**: unit 4 failed; e2e at 360: Create y **364.375 -> 346.375** while creating |
| M5a | F5 | note on `block && !made` (drops `sent`) | **killed** |
| M5b | F5 | note on `block && sent` (drops `!made`) | **killed** |
| M5c | F5 | note built with 'Back' | **killed** |
| M5d | F5 | note never shown | **killed** |
| M9 | F9 | made-busy reads the locked hint | **killed** (3 failed) |

**FIX-4c: M1b, M1d and M1e no longer exist.** The owner dropped `unconfirmedRef` and the `earlierUnconfirmed` input (2026-10-13), so the mutants that removed or zeroed them have nothing to mutate. Why they were equivalent: `sentRef` is cleared only in the reopen branch. Every send that ends unconfirmed leaves `sentRef` set, so every later press has `kept !== null`, that is `firstSend === false`, and the rule is already false. No input separated the code with the ref from the code without it. M1a, M1c and M1f were re-run on the FIX-4c code (suites `pages.test.tsx` + `createHint.test.ts`, 86 tests after the two rows of the pure table that only varied `earlierUnconfirmed` were removed) and all are killed.

## 4. F4 measurements (headless Chromium, html font 13.57 px at 390 / 13.5 px at 360)

Create's `y` (px). The "after" columns are after the press ENDS, when the error line appears above Create.

| | before | creating | finishing (made, busy) | sent idle (lost reply) | made idle (date refused) | hint box |
|---|---|---|---|---|---|---|
| ceb5df79, 390, every chip | 346.375 | 346.375 | 346.375 | 407.875 | 453.375 | 36 |
| ceb5df79, 360 / 320, Class | Class hint = 3 lines (box grows to 54), others 2 | moves up 18 (shown by M4: 364.375 -> 346.375) | | | | |
| FIX-4, 390 and 360, every chip | 364.375 | 364.375 | 364.375 | 425.875 | 471.375 | 54 |

Line counts (Range rects) on ceb5df79: Class 3 lines at 320 and 360, 2 at 375 and 390; Party and Workshop 2 at every
width. **Not in this brief, but seen:** Create moves down (+61.5 or +107 px) once the press ends, because the error
`<p>` sits ABOVE Create. It never moves while it spins. Reporting it, not changing it.

## 5. Checks (Node 22, `NODE_PATH` unset as on CI; unit legs under the offline stub)

| workflow / job | step | exit | note |
|---|---|---|---|
| architecture-guard `integrity` | `bin/check-integrity.sh` | 0 | 1445 files, 0 issues. Run as `bash bin/...`: the script is mode 100644 here and exits 126 when called directly; CI runs `chmod +x` first. |
| | `check:legacy-tables` / `check:legacy-program-rpcs` / `lint:architecture` | 0 / 0 / 0 | |
| | `AUDIT_STRICT=1 check:images` | 0 | |
| | `check:image-widths:self-test` + guard | 0 | |
| | `check:plan-hygiene:self-test` | 0 | |
| | `check:workflow-artifact-policy:self-test` + guard | 0 | |
| | `check:mojibake:self-test` / mojibake `git grep` | 0 / 0 | |
| | `prove:entry-point:self-test` + sweep | 0 | |
| typecheck.yml | `check:rpc-typing` / `check:wallclock-brand` | 0 / 0 | |
| unit-tests.yml (London, full) | `test:unit:offline` | **0** | 270 files, 6190 passed, 25 skipped, 1 todo |
| | `test:unit:timing` | 0 | 65 passed |
| unit-tests.yml (New_York / Sydney, 9-file list) | `vitest --no-file-parallelism` | 0 / 0 | 213 / 213 |
| perf-budget.yml `bundle-budget` | both self-tests / `build` / `check:bundle-budget` / `check:first-load-requests` | 0 / 0 / 0 / 0 | every chunk ratchet and every request pin equal (no budget touched). Lighthouse and doc-weight need a Vercel deploy: not run. |
| db-contract-check.yml (no-secret) | `ci-live-db-gate --self-test`, `check-migration-stamps`, `check-script-conventions` + every `--self-test` in the workflow (12 scripts, including `check-event-truth-v1`, `check-guest-list-contract`) | all 0 | |
| e2e-smoke.yml (workflow env) | full `npm run test:e2e` (15 specs) | **1** | **91 passed, 1 skipped, 1 failed**: `dancer-home.spec.ts:105` "a finished dancer gets the dancer home". This is the same test, failing the same way, that the fix-3 handover records as the baseline. Re-run alone: **14/14 passed**. It is a screen this diff does not touch. The new FIX-4 e2e at 390 and 360 passed in the full list. |
| | `organiser-events` + `organiser-loop` | 0 | 12 passed |
| `npm run lint` (chain) | | 1, then **0** | First run: 1 red link, `check:integrity` exit 126 (file mode only, as above). Re-run with CI's `chmod +x bin/*.sh`: 16/16 green; whole-tree eslint is informational, as documented. Modes restored afterwards and not committed. |
| eslint on every changed file | | 0 | |
| `npm run pre-ship` | all | **1** | Every repo check PASS; `test:unit:timing`, `build:ship`, `check:bundle-budget` and `check:first-load-requests` PASS; typecheck ratchet PASS at **96**, which equals ceb5df79's 96 in this container (FIX-4 adds 0). **The ONE FAIL is `test:unit`: 10 red, all live-DB `*.contract.test.ts` against the offline stub** (`eventViewCompat` 5, `publicEventPageLineup` 3, `occurrenceProgram` 2). That is exactly the fix-3 baseline set: **no new red**. pre-ship SKIPPED its eslint leg (no lintable files in the ship diff) and its e2e leg (because of the contract reds); both were run by hand (rows above). `check:plan-hygiene` SKIPPED (no plans dir). |

**Independent re-run (FIX-4b worker, 2026-10-13, on `c427479`'s source = `46ac59d`).** Every step above re-run the same way (Node 22, `NODE_PATH` unset, CI's `chmod +x bin/*.sh`, modes restored afterwards). The results match the table, with one difference: `test:unit:offline` exit **1** in this pass, 6189 passed, with **1 red, `tests/client/festivalClientState.test.tsx` "shows no frame carrying the previous festival day"** (`openDay` 0, expected 2). That festival client file is outside the fix-4 delta. It passed **8/8 alone** and passed inside this pass's pre-ship full `test:unit`, and the table's own run above had it green. Load timing, not this branch. Everything else matches: tz legs 213/213 x2, timing 65, lint chain 16/16, bundle `event` 379.4 KB / 47 files with every ratchet and pin equal, every no-secret db-contract self-test 0 (`check-event-truth-v1` 152/152), pre-ship's only FAIL the same 10 live-DB contract reds, typecheck 96, e2e 91 passed / 1 skipped / 1 failed (`dancer-home.spec.ts:105`, then 14/14 alone), eslint on the changed files 0. **No new red from the fix-4 delta; no source or test changed.**

Hooks: in this container `.githooks/*` is NOT executable (git warns "hook ignored"), so pre-commit and pre-push did NOT
run. Their checks were run by hand (integrity, the unit gate and pre-ship above). No `--no-verify` was used; the hooks
simply were not armed. Mode bits were left as found.

## 6. Real data (read-only SELECT, prod `stsdtacfauprzrdebmzg`, counts only)

- `organiser_profiles.lifecycle_status`: **45 live, 0 other**. The F5 state (organiser blocked mid-create) does not
  occur on prod today. The page test builds it (pending_review after a Home refetch), and the e2e "not approved yet"
  spec covers the block itself.
- `organiser_team_members`: 49 active rows over 45 organisers; **5 people are active in more than one organiser**, so
  the organiser-chip freeze (F1 tests use two organisers) meets real people.
- The fix-3 handover's series counts stand (unchanged by this slice, which touches only the create page).

## 7. Verified / Not verified

**Verified (here):** F1, F2, F3, F5 and F9 against tests red on ceb5df79's source; F1 rows (a) PGRST301 / 57014 /
40001, (b), (c) and the made row (d), with a byte-equal resend after London midnight; every mutant in section 3 killed
except the two proved equivalent; F4 measured at 390 and 360 (and 320 / 375 line counts), fixed, and pinned by unit and
e2e; the e2e at 390 and 360; the checks in section 5; the prod shape counts in section 6; the lib, calendar files and
scripts untouched.

**Not verified:** a walk on a real phone or with a real organiser login (self-serve is OFF in prod; no login here);
real-network behaviour of PGRST301 / 57014 / 40001 on `series_command_p5` (the fix does not depend on which code
arrives: any coded error on a resend keeps the form frozen); whether the server compares a replayed create's payload
(the brief says it does not, and the fix assumes it does not); live contract suites and the live #70 guard (DB window);
Lighthouse and document weight (need a Vercel preview); the `.githooks` mode question (environment).

**Head SHA:** see `git log -1 origin/arc/event-truth-p1p3-fix4`. PR: none (by brief).
