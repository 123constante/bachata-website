# BRIEF: quick review of PR 2519 at head f1fcd420a (P98, test only)
Lane: review, read-only on code. Branch: claude/review-2519-r1. Context cap 30%.
Size: 1 file (review doc), ~25 lines. No UI (review only; no design).
PR 123constante/bachata-website#2519 adds 2 tests to src/pages/__tests__/RaffleWin.beenTo.test.tsx only. Builder was Sonnet; you are a different model family.
Problem it fixes: P98 = the raffle pick-list tests never checked the raffle_win_lock_v2 payload (p_never_been).
Check ONLY: (1) `git diff origin/main...f1fcd420a` touches only that test file; (2) the two expected p_never_been values (needs_tick false -> false; needs_tick missing + ticked -> true) match what src/pages/RaffleWin*.tsx actually sends (read the code that builds the raffle_win_lock_v2 args); (3) the tests would fail if p_never_been were dropped or inverted (reason it from the code, or flip it locally and run); (4) `npx vitest run src/pages/__tests__/RaffleWin.beenTo.test.tsx` passes.
Write docs/review/2519-r1.md. First lines of the header MUST name "PR #2519" and "head f1fcd420a". Then exactly one "## Verdict: PASS | PASS WITH NITS | BLOCK" and "## Hard-tier: PASS|FAIL", findings, then Verified / Not verified. Commit subject ends "[worker-done <ticket>]". Push only claude/review-2519-r1. Never merge, approve or apply. Stop after the push and report.
