# Review PR #1788 (claude/p2-refund-states): Website reads night_cancelled

Review only, no code changes. Read the PR diff (3 files: src/modules/tickets/MyTicketsPage.tsx, myTicketsModel.ts, myTickets.matrix.test.tsx).
Check: (1) nightCancelled only set when true; order QR deep-equal unaffected; (2) cancelled card is greyed, shows "This night was cancelled", and shows NO QR; (3) null/undefined night_cancelled from older RPC replies cannot crash or hide a valid ticket; (4) tests cover each shape and fail on unfixed code.
Output: Verdict PASS / PASS WITH NITS / BLOCK as a doc docs/review/pr-1788-night-cancelled.md naming PR 1788 and the head sha.
