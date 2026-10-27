# Brief: P3 W-T FIX 2 (continuation on PR #1079, branch claude/p3-wt-ticketing)

Continue on `claude/p3-wt-ticketing` (fetch it; head ceb8a22; do NOT restart). Normal lane, no DB, no Supabase writes. Context cap 30%: push early.

Source: independent review round 2 `docs/review/pr-1079-r2.md` on branch `claude/review-1079-r2` (read it first, incl. the appendix probes: `git fetch origin claude/review-1079-r2 && git show FETCH_HEAD:docs/review/pr-1079-r2.md`). Fix, each with a test red first:

1. R2 + R1 as ONE toast model: a late outcome names its subject (order buyer / ticket name) only in the late text; the alert is its own slot that a status toast can never clear, and two late refusals both stay readable (small queue or two stacked alerts). Give the alert a fresh node (R7: key by alert/status). Probes P1, P1b from the review become tests.
2. R3: fix the F3 test so it is a real gate: `vi.useFakeTimers()` BEFORE `show(...)`, advance 8001 ms, assert the alert is still there AND a status toast is gone. Re-run mutant M3 (remove the `if (alert) return;`) and show it red.
3. R4: `onSaved` clears only the saved type's switch error (also the Close-sales path). Probe P6 becomes a test.
4. Nits in one sweep: R5 (Escape while Close sales is in flight keeps "Closing..."; probe P9), R6 (note or render the toast inside the top layer), R8 (cascade test header says what it cannot see; assert no `!important` in p3.css). R9 stays a note.

Rules: ASCII escapes / HTML entities, no raw Unicode punctuation in JSX; no density-exempt files; no new tokens. Run every CI job step that applies; the `unit (Europe/London, full)` job failed once on `tests/client/festivalClientState.test.tsx:735` (not this PR's code, passes locally): re-run and say. `bundle-budget` is red on main (owner decision, another session is trimming): do not touch budgets. Update `docs/handover/p3-wt-ticketing.md` and the PR #1079 body (per-job table, Verified / Not verified). These fixes are UNREVIEWED code: say so.

Push once coherent (subject ends [skip preview]); final push ends `[worker-done dt_<ticket>]`, NO [skip preview].
