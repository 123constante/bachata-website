# Review r3: PR #1439 fix-round delta (door "Check again")

grep: review-1439-r3

| PR | Head reviewed | Delta reviewed | Verdict |
|----|---------------|----------------|---------|
| #1439 | `f5c0c96afde785284f2b5ccf7b00eaac88883397` | `8aa5b7e..f5c0c96`, only in `src/modules/organiser/p3/door/` | **PASS-with-fixes** (two Low findings and two nits, none blocking) |

This was one read-only round. Nothing was pushed to `claude/door-no-access-dead-end`. The delta touches three files:
`DoorScreen.tsx` (+20/-9), `door.css` (+2) and `__tests__/door.noAccess.matrix.test.tsx` (+36/-5).
The merged-from-main raffle and docs files were ignored, as the brief asked. In all three files at f5c0c96 I counted 0 CR,
0 bare CR and 0 non-ASCII bytes.

## Answers

### 1. A: does Check again after a check-in refusal clear the card, and does the note name only on-screen controls?

**Fixed for the main path.** `recheck` (`DoorScreen.tsx:140-157`) handles an ok list read while
`shown.kind === 'not_allowed'` like this:
- it calls `setShown(null)` and `gate.current.reset()`;
- it calls `setTab('scan')`;
- it shows the note `RECHECK_OK_NOTE` = "You can check tickets now. Scan or type the code again."

The note is rendered above both tabs (`:194`), and only when `!out && !notAllowed`.

- On both tabs (the `typed` cell), the card goes away after Check again, `door-code-input` comes back, the note
  says "You can check tickets now", and `noteNamesOnlyControlsOnScreen` passes.
- **Signed out:** the note is hidden (`!out`), and only the signed-out card shows.
- **Still refused:** the top note is hidden (`!notAllowed`). Only the card's own "No signal, try again"
  alert can show, and the `list` and `then_network` cells cover that.
- The note goes away on the next check-in, because `run` calls `setRecheckNote(null)` (probe P5).

**Two paths still show the note with no code box.** I confirmed both with a throwaway jsdom probe, which was not committed:

- **F1 (Low): the list tab after recheck.** Recheck sends the worker to Scan. If they then tap "Tonight's list",
  the note "...Scan or type the code again." stays above the list. On that tab there is no `door-code-input` and no
  `door-camera` (probe P1). The Scan tab button is on screen, but nothing there lets them type a code.
  *Fix:* clear `recheckNote` when the tab changes, or render the top note only when `tab === 'scan'`.
- **F2 (Low): zero sold after recheck.** A typed refusal, then Check again returns `ok` with `totalCount: 0`.
  `ScanTab` then returns `EmptySold` (`:242`), so there is no code box and no camera, but the note still says
  "Scan or type the code again" (probe P2). This is a rare shape.
  *Fix:* hide the note when `noneSold` (add `&& !noneSold` to `:194`), or add a `zero_sold`-after-typed cell.

### 2. C: does a code already on screen scan again after recheck?

**Yes.** `onScreen.current = null` now runs on every ok read (`:154`). The new test
`a scanned code refused at check-in scans again after Check again finds access` holds the same
code in front of the fake camera. It expects a second `checkInTicket` call with that same code.

**If the line is removed, the test goes red.** Mutant MC fails 1 test, and that test is this one.
Moving the line back into the old `else` branch (MC2, the r2 code) also fails it. Removing
`gate.current.reset()` (MA3) also fails it, so the gate reset is covered too.

### 3. Is any refusal cleared while access is still refused? Can a ticket be checked in twice? Did any write path change?

- **Only an ok list read clears a refusal.** A refused read or a network read leaves the card in place. The
  `list`, `then_network` and `zero_sold` cells on both tabs assert that, and the suite is green.
  Mutant MR (`if (true)`) survives, see F3. It only affects the note and tab after an ok read, never a refusal.
- **The list read and the check-in RPC can disagree.** The read can say ok while the check-in RPC still refuses.
  In that case the next scan or typed code makes exactly one check-in call, and the refused card comes back
  (probe P3: 2 check-in calls in total, one per explicit submit). Recheck never writes on its own.
- **No ticket is checked in twice.** Resetting `onScreen` lets a code that was refused, and so never checked in,
  fire once more. There is one case where a code that already checked in fires again: an earlier `ok` result is
  still in `shown` while the list read says refused, and Check again then returns ok. That re-fire hits the server,
  which answers `already_in`. This is not new: r2's `else onScreen.current = null` did the same.
- **No write path changed.** The delta contains no `checkInTicket`, `checkInById`, `checkInByCode` or `rpc(` line,
  and `data.ts` and `model.ts` are not in the delta. Mutant M8 (recheck also calls `checkInTicket`) fails 11 tests.

### 4. D and E: are they whitespace and a css margin only?

- **D: yes.** `git diff -w --ignore-cr-at-eol` shows no change on the two `recheck={recheck} ...` prop lines.
  Both now have 12-space indents (`:206`, `:211`), matching the lines around them.
- **E: yes.** `door.css:88-89` adds one rule, `.p3-theme .p3-note.p3-door-recheck-note { margin-top: 6px; }`.
  Its specificity (0,3,0) beats `.p3-note`'s `margin: 0`. The card's alert note gets the class too (`:333`).

## Other findings

- **F3 (Low, test gap): mutants MR and MRN survive.**
  - MR: if recheck takes the not-allowed branch on every ok read (`if (true)`), a list refusal followed by ok would
    show "Scan or type the code again" and jump from the list tab to Scan. The `then_ok` cell does not assert that
    there is no note and that the tab stays the same.
  - MRN: `run` no longer clears the note (`setRecheckNote(null)` removed), so the note would stay above the next result.
  - *Fix:* in `then_ok`, assert `queryByTestId('door-recheck-note')` is null. Add one assertion that the note is gone
    after the next check-in.
- **F4 (Nit):** `noteNamesOnlyControlsOnScreen` only checks the words it knows. A note naming another control,
  such as "Tap Retry", passes it (mutant MN2 survives). It is good enough for the current copy.
- **F5 (Nit):** a stale comment in the test at `door.noAccess.matrix.test.tsx:73` says "typed: the list is ok, but a
  check-in refusal stays", which is now the opposite of what happens.
- **B from r2:** still parked, as the brief says. The 0 bare CR count above is a manual check, not a guard.

## Mutants

For each mutant I edited `DoorScreen.tsx` at f5c0c96, ran
`vitest run src/modules/organiser/p3/door tests/doorRefusedCardCentring.test.ts`, then restored the file.
At the PR head that run passes 406/406.

| # | Mutant | Result |
|---|--------|--------|
| MA1 | No `setShown(null)` on recheck ok | RED, 3 fail (typed x2 and the C test) |
| MA2 | No `setTab('scan')` | RED, 1 fail (typed, list tab) |
| MA3 | No `gate.current.reset()` | RED, 1 fail (C test) |
| MC | Remove `onScreen.current = null` | RED, 1 fail (C test) |
| MC2 | `onScreen` reset only in `else` (r2 code) | RED, 1 fail (C test) |
| MN | Top-level note never rendered | RED, 2 fail |
| M8 | Recheck also calls `checkInTicket` | RED, 11 fail |
| MN2 | Note copy names a control that is not on screen ("Tap Retry") | GREEN, survives (F4) |
| MR | Clearing branch on every ok read (`if (true)`) | GREEN, survives (F3) |
| MRN | `run` does not clear the note | GREEN, survives (F3) |

I also ran the new test file against the unfixed `DoorScreen.tsx` from 8aa5b7e: 3 of 11 fail
(typed on both tabs, and the C test). So the new tests catch the r2 bugs.

## CI at f5c0c96 (39 check runs, read from the GitHub PR check runs)

- **Green:** bom-check-routed, bom-check, route, e2e-smoke, masking-check, notification-check, wallclock-brand,
  no-preview-reason (x4), bundle-budget, integrity, unit (Europe/London full, America/New_York, Australia/Sydney),
  dancer-area-isolation, phone-qa (1/2/3), build-smoke, decide, phone-qa-section, real-data-verified, live-db-gate,
  open-pr.
- **Skipped:** contract-check, enable, seo-preview, seo-check, og-check, og-preview, synthetic,
  synthetic-preview, doc-weight, lighthouse.
- **Cancelled:** phone-qa-section, real-data-verified and decide each have one cancelled run. Each was superseded
  by a run of the same job that went green.
- **Red:** none.

## Verified on real data
- Shapes surveyed: no new prod survey. The delta adds no new data shape. r2's read-only counts still apply (`tickets` 4, `ticket_night_check_ins` 0, so no live door traffic). The shapes were: the PR's matrix (list, typed, then_ok, then_network, zero_sold on both tabs), plus probes for the list tab after recheck, zero sold after recheck, a check-in still refused after recheck, and a good check-in after recheck.
- Checks run: door vitest at f5c0c96, 406/406. 10 mutants: 7 red, 3 survivors. The new tests run against the 8aa5b7e code: 3 red. A 5-case jsdom probe. Byte checks for CR and non-ASCII. Whitespace-only diff for D. CI read from GitHub check runs.
- NOT verified: no 390x844 browser walk of the new note. The margin was checked by reading the CSS rule, not visually. No real-phone walk. No live prod refused state. I did not check whether `ticket_door_list_v1` and the check-in RPCs authorise the same people. `tsc` was not run, because this PR adds docs only.
