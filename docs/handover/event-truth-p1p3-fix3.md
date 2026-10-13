# Handover: event-truth P1+P3 -- FIX-3 slice (review round 2) -- FINAL

Branch `arc/event-truth-p1p3-fix3`, from `origin/arc/event-truth-p1p3-fix2` (a8be7fa5). Brief:
`arc/briefs-event-truth:briefs/event-truth-p1p3-fix3.md` (blob 4eefc7a1). No PR opened (by brief: the orchestrator
merges this branch into `feat/event-truth-p1p3-b`). Commits: 7383321a (red-first tests, previous session), c23d393
(source + test corrections + e2e), then one commit with this handover and the `pages.test.tsx` type fix. Written 2026-10-13 by the cloud worker.

Rules held: `src/lib/eventCategory.ts` untouched; nothing under `calendar/**`, `EventCalendar.tsx`,
`useCalendarEvents.tsx`; nothing under `scripts/`; no budget, pin or `vendor-ui*` change; no raw Unicode punctuation in
JSX (the one ellipsis is a `…` escape in a `.ts` string); every file over 2 KB written through
`safe-edit.py` / `safe-write.py`.

## 1. Fixes, file by file (NEW LOGIC marked; everything else is wiring, comments or copy)

| fix | file | change |
|---|---|---|
| 1 | `events/NewEventPage.tsx` | **NEW LOGIC.** `sentRef: SentCreate { cmds, type, today }` is computed ONCE at the first press (after `resolveCreateCityId`), stored, and `setSent(true)` runs before the create is sent. Every later press takes `start = async () => kept`: the SAME create, the SAME schedule, the first press's `type` and London `today` for the seed step. Name, organiser, today and city are not re-read. The first-step catch: `isServerRefusal(err) && !made` -> `sentRef.current = null; setSent(false)` (nothing saved: the form reopens, keys unchanged); any other error leaves it frozen. `frozen = busy \|\| sent \|\| made` disables the name (`TitleInput disabled`), the three type chips and the organiser chips. `typeLocked` and `scheduleFailed` state removed (replaced by `made` / dead). |
| 1 | `ui/TitleInput.tsx` | `disabled` prop passed to the textarea (wiring). |
| 2 | `events/eventType.ts` | **NEW LOGIC.** `CreatePhase = 'open' \| 'sent' \| 'made'`; `chipHint(phase, busy, type)`: made -> `CHIPS_LOCKED_HINT`; busy -> `Creating your event…`; sent -> `Not confirmed yet. Press Create to finish: nothing is made twice.`; else the chip's hint or `FIRST_SESSION_HINT`. `CHIPS_LOCKED_HINT` doc comment fixed (the hint once the create is CONFIRMED). The page's hint is `chipHint(made ? 'made' : sent ? 'sent' : 'open', busy, type)` in a fixed two-line box (`min-h-[36px] leading-[18px]`) so Create never moves. |
| 3 | `events/NewEventPage.tsx` | Open the event is rendered BELOW Create, only when `made`, never disabled. |
| 4 | `events/NewEventPage.tsx` | Guard `enabled: name.trim() !== '' && !busy && !created && !made`. |
| 5 | `events/eventType.ts`, `EventEditorPage.tsx`, `EditorRows.tsx` | **NEW LOGIC.** `TypeRowState.cancelledOnly`; `EVERY_UPCOMING_CANCELLED` constant (the Schedule card in `EditorRows.tsx` imports it). `typeSublabel`, no stored word, not locked, no listable date, cancelledOnly -> `Every upcoming date is cancelled. Open one under When and put it back on, then add a session and it is set for you.` The editor passes `cancelledOnly: next === null && upcoming.length > 0`. The control it names is on screen in that state: the When date rows (`org-date-row`, each labelled Cancelled, opening the date), whose page has "Put this date back on" (`dates/index.tsx:234`, disabled only by the event lock, and a locked series never reaches this sentence). Cancelled dates are NOT in DatesTakenOff's Put back list (that reads `removed_dates`), so the copy does not point there. |
| 6 | `shared/seriesModel.ts`, `events/newEvent.ts`, `EventEditorPage.tsx`, `NewEventPage.tsx` | `firstListedDate` moved to seriesModel (after `upcomingDates`); `newEvent.ts` loses it, and its comment now points there; the editor's `next = firstListedDate(ws.dates, today)` (the raw `!== 'cancelled'` find is gone); the create imports it from seriesModel. |
| 3 | `tests/e2e/organiser-events.spec.ts` | New: at 390x844, a `page.route` on `series_command_p5` holds the create and its date. Create's `boundingBox().y` is equal before the press, while `aria-busy` with the `Creating your event` hint and no Open, and after the create reply (Open visible, enabled, y below Create). Then gate 2 is released, the URL becomes the editor, and 2 envelopes are sent. |

`editorOrder.matrix` snapshot: **unchanged** (the cancelled-only shape stores `party`, so its row reads `Set by its
sessions.`). Vitest rewrites the `.snap` with LF line endings on a full-dir run; that EOL-only change was reverted
each time, never committed.

### Tests the brief proved wrong (changed, with reasons)

1. `createHint.test.ts` "never says the event is made...": the regex `/is made|open the event/` matched the brief's own
   required not-confirmed sentence ("nothing **is made** twice"). Narrowed to `/is made with it|open the event/` (the
   locked hint's claim). No test can hold the brief's sentence and the old regex at once.
2. `pages.test.tsx` fix-6 test waited for `'16 Oct'` inside `org-schedule`, but the Schedule card's date is its
   `SectionLabel`, rendered OUTSIDE the `data-testid` box (`ui/Card.tsx`). It now reads `closest('section')`.
3. `pages.test.tsx` lost-reply test (1a): `londonToday.value = '2026-10-09'` never reached the form. `today` is a prop
   from `NewEventPage`, which did not re-render, so mutant M1a (recompute on every press) **survived**. That was a finding,
   so the test was fixed: `mount` returns its QueryClient, Home is refetched carrying `today: '2026-10-09'`, and the page
   re-renders with the new date before the second press. M1a is now killed (section 3).

### Which branch of the catch each fix-1 case takes

- (a) lost reply (`TypeError('fetch failed')`, `isServerRefusal` false): message "could not confirm the save", the
  refusal branch is skipped, and `sentRef` / `sent` stay set. The form stays frozen and the next press resends `kept`.
- (b) refusal (`permission_denied ... P0001`, `isServerRefusal` true, `made` false): `sentRef.current = null;
  setSent(false)`. The form reopens, and the retry composes a new create under the SAME `keys.create` and `seriesId`.
- A refusal after `made` (a replay refused once the event exists) does NOT unfreeze (`&& !made`).

## 2. Red-first

On a8be7fa5 plus the 7383321a tests: 29 red (the previous session's table, unchanged). After the source change, 2 still
red, and both were test defects (section 1, items 1 and 2). Final: `src/modules/organiser` 81 files, all green; events
suites 1074 passed, 1 todo.

## 3. Mutation table (file restored and `cmp`-checked after each)

| mutant | what | result |
|---|---|---|
| M1a (fix 1) | `if (kept && false)`: recompute the create on every press | `pages.test` **1 failed** (lost-reply test, after the test fix; it SURVIVED before the fix, section 1 item 3) |
| M1b (fix 1) | `setSent(true)` removed | **1 failed** (lost-reply: name not disabled) |
| M1c (fix 1) | refusal never unfreezes | **1 failed** (refused-first-create test) |
| M1d (fix 1) | `frozen = busy \|\| made` | **1 failed** (lost-reply) |
| M2a (fix 2) | `if (busy)` branch disabled | **3 failed** (2 createHint rows + in-flight page test) |
| M2b (fix 2) | `sent` reads the locked hint | **5 failed** (3 createHint + 2 page tests) |
| M3a (fix 3) | Open mounts once `sent` | **2 failed** (in-flight, lost-reply) |
| M3b (fix 3) | Open `disabled={busy}` | **1 failed** (in-flight: Open enabled after the create reply) |
| M3c (fix 3) | Open moved back ABOVE Create | **1 failed** (in-flight: `compareDocumentPosition`) |
| M3d (fix 3, e2e) | hint box not fixed (`min-h`/`leading` removed) | e2e **failed**: Create y 352.625 -> 331.5 while spinning |
| M4 (fix 4) | guard without `&& !made` | **1 failed** (leave-guard test) |
| M5 (fix 5) | `cancelledOnly: false` | **1 failed** (`eventTruth.matrix` cancelled-only, stored null) |
| M6 (fix 6) | editor `next` back to the inline find | **1 failed** (shared-helper test) |

No mutant left the suite green.

## 4. Checks (every no-secret step of every `pull_request` workflow), Node 22

Unit legs under the offline stub (`https://ci-offline-no-db.invalid`, placeholder key, `LIVE_DB=false`).

| workflow / job | step | exit | note |
|---|---|---|---|
| unit-tests.yml (London, full) | `npm run test:unit:offline` | **1** | 6156 passed, 25 skipped, 1 todo; **5 red = `integrityCouldNotRun.test.ts` only (env-only)**. ROOT CAUSE found this time: the container sets `NODE_PATH=/usr/local/lib/node_modules_global`, so `typescript` resolves from outside the temp repo. With `env -u NODE_PATH` (as on CI) the file is **67 passed, 14 skipped, 0 failed**, and the pre-push hook's full offline run was green that way. |
| | `npm run test:unit:timing` | 0 | 65 passed |
| unit-tests.yml (New_York / Sydney, 9-file tz list) | `npx vitest run --no-file-parallelism <list>` | 0 / 0 | 213 / 213 |
| typecheck.yml | `check:rpc-typing` / `check:wallclock-brand` | 0 / 0 | |
| e2e-smoke.yml (workflow env) | `organiser-events.spec.ts` + `organiser-loop.spec.ts` | 0 | 11 passed warm. First run (cold server): the 2 New event specs timed out at the first `fill`, the cold-start class the fix-2 handover records; re-run with no change: 11/11. |
| | full `npm run test:e2e` (15 specs) | **1** | **90 passed, 1 skipped, 1 failed**: `dancer-home.spec.ts:105` "a finished dancer gets the dancer home" (element not found in 15 s) -- a dancer-home screen this diff does not touch; the spec alone right after: **14/14 passed**. Load timing in the full list, not this branch. The new FIX-3 e2e passed in the full list. |
| architecture-guard.yml `integrity` | `bin/check-integrity.sh` | 0 | 1445 files, 0 issues |
| | `check:legacy-tables` / `check:legacy-program-rpcs` / `lint:architecture` | 0 / 0 / 0 | |
| | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| | `check:image-widths:self-test` + guard | 0 | |
| | `check:plan-hygiene:self-test` | 0 | |
| | `check:workflow-artifact-policy:self-test` + guard | 0 | |
| | `check:mojibake:self-test` / mojibake `git grep` | 0 / 0 | |
| | `prove:entry-point:self-test` + sweep | 0 | |
| perf-budget.yml `bundle-budget` | both self-tests / `npm run build` / `check:bundle-budget` / `check:first-load-requests` | 0 / 0 / 0 / 0 / 0 | event 379.3 KB / 47 files (budget 380); all 6 prerendered routes match their pins. Lighthouse / doc-weight need a Vercel deploy: not run. |
| `npm run lint` (chain) | | 0 | 16 of 16 links green |
| db-contract-check.yml (no-secret) | `ci-live-db-gate.mjs --self-test` / `check-migration-stamps.mjs` | 0 / 0 | |
| | `check-script-conventions.mjs --self-test` + guard | 0 | 86 cases / 86 allowlisted, unchanged |
| | `check-guest-list-contract.mjs --self-test` | 0 | 28 cases |
| | `check-event-truth-v1.mjs --self-test` | 0 | 152/152 |
| `npm run pre-ship` (`env -u NODE_PATH`) | all | **1** | every repo check PASS, `test:unit:timing` / `build:ship` / `check:bundle-budget` / `check:first-load-requests` PASS; **the ONE FAIL is `test:unit`: 10 red = live-DB `*.contract.test.ts` against the offline stub only** (`eventViewCompat` 5, `publicEventPageLineup` 3, `occurrenceProgram` 2), a subset of the 17-case baseline (`integrityCouldNotRun` green without `NODE_PATH`; 6185 passed). Typecheck ratchet PASS at 101, which included **5 errors in the red-first `pages.test.tsx`** (envelope fields missing from the `commands()` type, `.at()` on an ES2020 lib). Fixed after pre-ship (test-only: the type widened, `[length - 1]`). Now **96 = exactly a8be7fa5's 96 in this container** (same error list, `diff` empty; a worktree at a8be7fa5 measured the same way). FIX-3 adds 0. (Fix-2 recorded 91 in its own environment.) pre-ship SKIPPED its own eslint / e2e legs (ship diff vs the already-pushed branch); both were run by hand (rows above). `check:plan-hygiene` SKIPPED (no plans dir). |
| eslint on every changed file | | 0 | |

Hooks: in this container `.githooks/*` and `bin/*.sh` came up mode 100755 (git holds 100644), so the hooks RAN here. The
pre-commit integrity scan passed. The first push was REFUSED by the pre-push unit gate (the 5 `integrityCouldNotRun`
cases above). It was re-run with `env -u NODE_PATH git push`: the full hook ran and passed, nothing was skipped, and
no `--no-verify`. The mode bits were left as found and not committed.

## 5. Real data

Read-only SELECT on prod (`stsdtacfauprzrdebmzg`, counts only), live/draft non-template series: recurring live 43
(**1 cancelled-only**, 4 with no upcoming date), one_off live 9, course live 6, festival live 6, recurring draft 5;
**0 with a NULL category**. So on prod today the one cancelled-only series reads `Set by its sessions.` (it has a stored
word). The new cancelled-only sentence shows only for a NULL category, which prod does not hold today; the matrix
covers it (5 rendered shapes x every stored value, plus the 200-row pure table).

## 6. Verified / Not verified

**Verified (here):** fixes 1-7 against their red-first tests; every mutant in section 3 kills; the 390x844 e2e
y-assertion (and that it catches a moving hint box); every no-secret step of every PR workflow (section 4) apart from
the env-only `integrityCouldNotRun` set, which is green with CI's environment; bundle ratchets unchanged; eslint clean
on every changed file; the prod shape counts in section 5; the lib, calendar files and scripts untouched.

**Not verified:** a 390x844 walk on prod-shaped data in a real browser session with an organiser login (no login
here; self-serve is OFF in prod); whether the server compares the replayed create's payload (the fix does not depend
on it: an identical payload is replayed); the e2e y-assertion run against a8be7fa5 itself (its red is shown by M3a/M3d
instead); the live #70 guard and live contract suites (need admin #780 on the DB, the orchestrator's window);
Lighthouse / document weight (need a Vercel preview); the `.githooks` mode question (environment, not this branch).

**Head SHA:** `git log -1 origin/arc/event-truth-p1p3-fix3`. PR: none (by brief).
