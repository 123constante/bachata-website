
Merged main at 972179bf (conflicts only in DoorScreen.tsx; kept main's camera help + row check-in, kept Check again / Back to events). tsc run on merge: 0 errors; door tests 402 pass.

## Fix round r2 (brief docs/briefs/door-no-access-fix-r2.md, review 1439 r2), 2026-11-10

Done:
- A: Check again with an ok list read after a check-in refusal clears it (shown, onScreen, scan gate), switches to the Scan tab (the list tab has no code box) and shows "You can check tickets now. Scan or type the code again." (`door-recheck-note`, role=status).
- Test: `typed` cell on both tabs asserts `door-code-input` is back and the note names no control missing from the screen.
- C: new test "a scanned code refused at check-in scans again after Check again finds access"; it fails when the `onScreen.current = null` reset is removed. The new typed assertions fail (3) on the unfixed code.
- D: indents fixed. E: `.p3-note.p3-door-recheck-note { margin-top: 6px; }` in door.css (scoped, other P3 notes unchanged).
- Main merged (4746d72a), clean.

Checks: door vitest 6 files / 403 pass; tsc -p tsconfig.app.json: 0 errors in branch files (129 total, all in files this PR does not touch; pre-ship ratchet baseline 106 is behind main); npx tsc --noEmit -p . 0; check:mojibake clean; committed blobs have no CR.
pre-ship: every check PASS except test:unit (failures only in live-DB contract tests eventViewCompat / occurrenceProgram / publicEventPageLineup and sandbox-path tests integrityCouldNotRun; none in door) and typecheck ratchet (above).

Left / next:
- Finding B parked: a guard failing on bare CR `/\r(?!\n)/` in src/**/*.{ts,tsx,css}.
- Not verified: browser walk at 390x844 and a real phone; production door data.

## Fix round r3 (brief docs/briefs/fix-1439-r3.md, review 1439 r3), 2026-11-11

Done:
- F1 + F2: the top `door-recheck-note` renders only on the Scan tab and only when tickets are sold (`tab === 'scan' && !noneSold`), so it never says "Scan or type the code again" where there is no code box.
- Tests: recheck then "Tonight's list" -> no note; typed refusal -> recheck ok with totalCount 0 -> no note; note gone after the next check-in.
- F3: `then_ok` cell (both tabs) asserts no note and the tab is unchanged.
- F5: stale comment at the `then_ok` mock line fixed.

Checks: door vitest + tests/doorRefusedCardCentring.test.ts 409/409. Mutants: MR red (2 fail), MRN red (1 fail). New tests against the unfixed DoorScreen.tsx: 2 red. tsc -p tsconfig.app.json: 0 errors in p3/door (147 total, all outside this PR's files); check:mojibake clean.

Left / next:
- F4 (nit, out of scope): mutant MN2 ("Tap Retry" note copy) still survives `noteNamesOnlyControlsOnScreen`.
- Finding B still parked. Not verified: 390x844 browser walk, real phone, prod door data.
