# Review PR #1791 (claude/ticket-picker-b1-fix3), head e759d0af

Review only, no code changes. Read the PR diff (src/modules/tickets/TicketPickerB1.tsx, EventTicketsPage.tsx, BentoPage.tsx, two test files; screenshots under docs/screenshots).
Owner asks: site header hidden on the picker; terms box and "Tickets go to" inside the email card; steppers 36px; grey description line skipped.
Check: (1) header hidden only on the picker route, other event-page states unaffected; (2) terms checkbox still gates checkout, email still required and submitted; (3) no change to price/promo/checkout logic; (4) tests cover the new layout and would fail on the old; (5) tap targets are explicit px (html font-size is ~13.5px on phones).
Output: verdict PASS / PASS WITH NITS / BLOCK as a PR comment on #1791 naming the head sha (do not commit a docs/review file).
