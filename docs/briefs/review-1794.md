# Review PR #1794 (claude/refunded-card-dancer), head 51660bda9

Review only, no code changes. PR = dancer-app Tickets tab shows refunded, Used, part-refund, one list order (P2 dancer slice). Companion of merged #1793 (tickets module).
Files: src/modules/dancer-app/screens/tickets/{TicketCard.tsx,model.ts,useTicketCard.ts}, new test dancer-app/screens/tickets/__tests__/refundedCardTab.matrix.test.tsx, one line in src/modules/tickets/__tests__/onboardTicketStates.matrix.test.tsx, tests/e2e/walk-refunded-card.spec.ts (+17).
Check: (1) Tab card shows the same refunded / Used / Part refunded / cancelled-night facts as My tickets (shared mapping from src/modules/tickets/ticketCardStatus.ts, no second copy); (2) with VITE_ENABLE_BUYER_ONBOARDING off the Tab is unchanged; (3) no QR shown for refunded or used tickets, QR still shown for valid ones; (4) list order matches My tickets; (5) tests would fail on old code; (6) no raw Unicode punctuation in JSX (entities only).
Output: verdict PASS / PASS WITH NITS / BLOCK as a PR comment on #1794 naming the head sha (do not commit a docs/review file).
