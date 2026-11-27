# Review (read-only): PR #1439 fix-round delta, door "Check again" (r3)
Repo 123constante/bachata-website, PR #1439, branch claude/door-no-access-dead-end, head f5c0c96. Report only; push ONE docs file docs/review/review-1439-r3.md on branch claude/review-1439-r3. Change no source.

Review ONLY the delta 8aa5b7e..f5c0c96 in src/modules/organiser/p3/door/ (DoorScreen.tsx, door.css, __tests__/door.noAccess.matrix.test.tsx). Ignore the merged-from-main raffle files.
Prior review: docs/review/review-1439-r2.md (findings A-E; B was parked on purpose).
Questions to answer, with evidence (run the door unit tests; use mutation: revert each fix and show a test goes red):
1. A: after a check-in refusal, a good list read (Check again) clears the card, the scanner and code box return, and the note names only controls on screen. Any path where the note shows with no code box (list tab, signed out, still refused)?
2. C: a code already on screen scans again after recheck (onScreen reset). Does the test go red if `onScreen.current = null` is removed?
3. Is any refusal ever cleared while access is still refused, or a ticket checked in twice? Any write path changed?
4. D/E whitespace and css margin only.
Verdict PASS or PASS-with-fixes or BLOCK, stated at head f5c0c96. Include a Verified / Not verified block. Skills not needed. No secrets.
