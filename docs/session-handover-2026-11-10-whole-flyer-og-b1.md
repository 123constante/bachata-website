# Session handover 2026-11-10: whole-flyer OG B1

Branch `claude/whole-flyer-og-b1`, PR #1522 (opened by the bot; this session
rewrote its body and subscribed to it). The full slice handover is in
`docs/handover-whole-flyer-og-b1.md`.

## Done
- B1 is built and pushed. The mode is off by default.
- All local gates pass: unit, lint chain, mojibake, images, integrity, build,
  bundle budget.
- The PR body passes both label checkers.

## Open
- CI was still running when this session stopped (unit, e2e-smoke, phone-qa,
  integrity, bundle-budget, contract-check).
- The PR body's per-job CI table is a placeholder.
- The real event page walk at 390x844 on the Vercel preview has not been done.

## Next
1. Read the PR #1522 check runs. Fix any failure this PR caused, then fill
   the per-job table in the body (re-run both PR-body checkers first).
2. Walk the preview at 390x844: `/event/musketeers` with and without
   `?ogtest=whole-flyer`. Use VERCEL_TOKEN for the preview URL.
3. ONE independent review is dispatched by the lead, then ONE fix round.

## RED at stop (first thing next session)
- `unit (Europe/London, full)` FAILED on head 0ca784c: 2 test files, 5 tests
  (job 129793879601, run 42805589145). The same suite on 9e882c3, which differs
  from 0ca784c only by a docs file, completed with no failed suite.
- This session hit its context gate before it could read which tests failed.
- Next: fetch that job's failed-test names. Compare them with the 15 failures
  that also fail on main in this sandbox (eventViewCompat, integrityCouldNotRun,
  occurrenceProgram, publicEventPageLineup contract tests). If they are
  live-DB/network tests that fail on main too, say so once on the PR; otherwise
  root-cause and fix them.
