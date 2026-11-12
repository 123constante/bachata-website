# Independent review: website PR #1541 (money class)
Review PR 123constante/bachata-website#1541 at its current head (money_visible: counts-only for managers, refund not_allowed tests, fail-closed orders flag). Read-only: do not push.
Check: (1) a manager never sees amounts/revenue/refund totals when money_visible is false, on every screen and in ticketsApi/ticketModel/data.ts; (2) fail-closed: missing/unknown flag hides money; (3) refund not_allowed paths cannot be triggered from the UI; (4) tests actually assert these (table-driven screen x role).
Output: post ONE PR comment starting "REVIEW PASS" or "REVIEW FAIL" at head <sha>, with <=10 lines of findings. No new PR.
