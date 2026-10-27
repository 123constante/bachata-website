# Brief: independent review round 2 of PR #1079 fix-1 diff (Website, normal lane)

Review only; do NOT change product code. Branch `claude/review-1079-r2` carries one file `docs/review/pr-1079-r2.md`. Fix-1 code is UNREVIEWED: that is what you check. Context cap 30%: push early.

Target: branch `claude/p3-wt-ticketing`, head ceb8a22 (fetch it). Diff to review: `git diff 84567dd..origin/claude/p3-wt-ticketing -- src` (ignore the main merge noise). Read round 1 first: `git fetch origin claude/review-1079-r1 && git show FETCH_HEAD:docs/review/pr-1079-r1.md`, and `docs/handover/p3-wt-ticketing.md` (Fix 1 section).

Check, with file:line evidence:
1. F1 + F2: a late save/refund success or refusal can never touch the sheet, draft or refunding state that is open NOW. Try to break the new `late(text, landed)` handler: two quick refunds, close/reopen/other-type edit, a refund landing after Back to the orders view, unmount. Run the new tests and MUTATE the handler (remove the guard) to show a test goes red.
2. F3 alert + Dismiss: focus, announcement, no stacking of several late toasts hiding the first.
3. `.p3-sheet-body { flex: 1 0 auto }` footer change and the sticky `.p3-stack-head`: any regression for the 94dvh sheet with 0, 1, 3 and 30 types, the orders view, the add/edit sheets and the Refund sheet (CSS cascade test `layout.cascade.test.ts`: is it a real cascade check or a string match? mutate it).
4. F5 "Checking sales..." cannot leave the price locked forever when the read errors; F6 Escape in "Close sales for good?" cannot lose a draft.
5. Nothing from fix-1 changed behaviour with the flags off; density-exempt files untouched; no raw Unicode punctuation in JSX.
Verdict PASS / PASS with should-fix / FAIL, findings ranked with a concrete failure scenario each. Stopping rule: this is round 2 of 2 for user-facing + money. No merge/approve. Final commit subject ends `[worker-done dt_<ticket>]`.
