# Brief: ticket connect return, continuation 1 (one CI fix: no raw ellipsis in source)
Brief-version: 2
Branch: claude/ticket-connect-return
Lane: normal, Sonnet. CONTINUATION on the existing branch and PR #1484 (head bcb559e2). Fix exactly the one red check below; change nothing else.
Serves: the same Tickets sheet banner; it cannot merge while unit (Europe/London, full) is red.

## What main lacks
- CI `unit (Europe/London, full)` fails: src/modules/organiser/__tests__/consistency.matrix.test.tsx G3 "no non-test source in ..." expects [] and got `tickets/ticketModel.ts: U+2026`. The new copy `CONNECT_RETURN_CHECKING = 'Checking your payment set-up…'` (src/modules/organiser/tickets/ticketModel.ts:268) holds a raw U+2026 ellipsis; repo rule: never paste Unicode punctuation into source (mojibake). Use the escape `…` inside the string literal (or three ASCII dots if the file's other copy does that; check how the existing "Checking your payment set-up" line in this file and tests write it, and keep the SAME text the user sees) -- grep: Checking your payment set-up…

## Files
src/modules/organiser/tickets/ticketModel.ts
src/modules/organiser/p3/tickets/__tests__/ticketConnectReturn.test.tsx

## What to build
1. Replace the raw character with the escape in ticketModel.ts and make any test expectation that spells the text use the same escape (no raw U+2026 anywhere in the changed files; run `npm run check:mojibake`).
2. Run `npx vitest run src/modules/organiser/__tests__/consistency.matrix.test.tsx src/modules/organiser/p3/tickets/__tests__/ticketConnectReturn.test.tsx` and `npx tsc --noEmit -p .`; push ONCE. Handover line in docs/handover/ticket-connect-return.md: one sentence on the fix.
