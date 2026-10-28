# Brief: independent review of PR #1079 fix-2 (Website, normal lane, Fable reviewer)

Review only; do NOT change product code. Branch `claude/review-1079-r3` carries one file `docs/review/pr-1079-r3.md`. Fix-2 code is UNREVIEWED: that is what you check. Context cap 30%: push early.

Target: branch `claude/p3-wt-ticketing`, head 6cdd507 (fetch it). Fix-2 diff: `git diff ceb8a22 7b7df95 -- src` (fix 2 itself). Head 6cdd507 also merges main (only `p3.css` conflicted; both append-only blocks kept): confirm that merge lost nothing from either side. Read round 2 first: `git fetch origin claude/review-1079-r2 && git show FETCH_HEAD:docs/review/pr-1079-r2.md` (R1-R4 + nits are what fix 2 claims to fix), and `docs/handover/p3-wt-ticketing.md` (Fix 2 section).

Check, with file:line evidence:
1. R1-R4 and every nit: each is fixed, or say which is not. Concentrate on the new toast model: named late texts, the alert queue that a status never clears, "F3 test is a gate" (MUTATE it: remove the guard it protects and show the test goes red), "save clears only its row", Escape mid-close.
2. Money paths (refund, close sales, price edits): a late success or refusal can never touch the sheet, draft or refunding state open NOW. Two quick refunds; close/reopen; refund landing after Back; unmount.
3. Overlay geometry at 390x844: toast stack, sheets and confirm button inside the viewport; opening a sheet does not scroll the page.
4. Nothing changes with the flags off; density-exempt files untouched; no raw Unicode punctuation in JSX; no byte added to /app first load (`npm run check:bundle-budget`, main has about 10 B spare).
Verdict PASS / PASS with should-fix / FAIL, findings ranked, a concrete failure scenario each. Stopping rule: after this round the orchestrator walks and merges; a FAIL needs a stated reason. No merge/approve. Final commit subject ends `[worker-done dt_<ticket>]`.
