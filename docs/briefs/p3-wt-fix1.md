# Brief: P3 W-T FIX 1 (continuation on PR #1079, branch claude/p3-wt-ticketing)

Continue on `claude/p3-wt-ticketing` (do NOT restart from main; fetch it, head 84567dd). Normal lane, no DB, no Supabase writes. Context cap 30%: split rather than run long; push early.

Source: independent Fable review `docs/review/pr-1079-r1.md` on branch `claude/review-1079-r1` (read it first: `git fetch origin claude/review-1079-r1 && git show FETCH_HEAD:docs/review/pr-1079-r1.md`). Fix in this order, each with a test (red first; the review gives the probe for F1 and F2):

1. F2 (money) + F1: a LATE save/refund SUCCESS must never touch the sheet or draft that is open now (toast + refresh only; same for the late refusal). Add both probes as tests.
2. D1 You > Get paid row title/subtitle run together (CSS specificity: `.p3-status-row .p3-block` or the middot separator). Add a test that would catch it.
3. D2 double padding on type rows; D5 sticky sheet head; D3 Close tap target (min-width 44px, px not rem); D4 money figures at 22px / overflow-wrap so "£12,345.00" fits a 173px tile.
4. F3 late refusals: role="alert" and no auto-dismiss (or a 44px Dismiss). F4 only clear the switch row that succeeded.
5. Nits as ONE sweep: F5, F6, D6 to D10 (D7: aria-describedby target must exist; D8 say the contributor reason once).

Rules: HTML entities / ASCII escapes, no raw Unicode punctuation in JSX; no density-exempt calendar files; no new tokens. After the fixes run every CI job step that applies (read .github/workflows), put a per-job table and Verified / Not verified in the PR #1079 body, update `docs/handover/p3-wt-ticketing.md`. These fixes are UNREVIEWED code: say so; the orchestrator will run a second independent review.

Push once coherent (subject ends [skip preview]), then the final push with `[worker-done dt_<ticket>]` and NO [skip preview].
