# Session handover 2026-10-25: P3 W1 (Home + Events + Stats)

Branch `claude/p3-w1-home-events-stats`, PR #1047 (flag organiserP3 OFF). Ticket dt_916df9a177d5.

## Done
- Screens, data adapters, tests, design record (`docs/design/1047.md`), shots (`docs/handover/p3-w1-walk/`),
  slice handover (`docs/handover/p3-w1-home-events-stats.md`), PR body with CI table / Verified / Phone QA.
- PR checks: all green on ea71f5f except the two PR-body checks, which passed on ee0d6be once the body was written.

## Open
- `unit (Europe/London, full)` red on ee0d6be: 1 test, `tests/client/festivalClientState.test.tsx`
  ("shows no frame carrying the previous festival day"). Same code was green on ea71f5f (ee0d6be is docs only);
  not in P3 code. Commented on the PR; needs one re-run (this session cannot re-run). If red twice: root-cause it.
- e2e-smoke / build-smoke / contract-check / phone-qa on ee0d6be were still running at hand-off.

## Next
- Re-run the failed unit job; if green, PR waits on owner design review (stages 5/6) and approval.
- Next slice per handover: event page (rows open it), Stats date-by-date + sources, Needs you pay/teachers/names.
