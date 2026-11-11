# Handover: PR #1520 payout gaps (dt_9361dcf27324)

## Done
- One rule, `canSetUpPayouts` (= owner only) in `ticketModel.ts`. Every Stripe-onboarding entry reads it:
  - Home Get paid prompt (`showPrompt`): owner only.
  - Get paid screen (`StartBody` via `startView`, new `owner` input) and the You > Get paid return poll: owner only. A manager sees "Ask ... to connect payments".
  - Tickets: `connectBlock` (sheet + draft row), `connectReturnBanner` carry-on / refresh buttons: owner only. A manager's banner says "Ask the owner to set up payouts." with no button. `onboard.go` in `TicketsEntry` is a no-op for non-owners.
  - `moveBlock` reason for a manager no longer points at "Connect payments in You > Get paid"; it says to ask the owner.
- Table test `payouts.ownerOnly.matrix.test.ts` (screen x role x Stripe state); older matrices updated to the new mapping.
- No change to RPCs, prices, refunds or payout logic.

## Verified
- tsc --noEmit: 0 errors. check:mojibake: clean. vitest src/modules/organiser/p3 (131 files) and src/modules/organiser/tickets: all pass.

## Not verified
- Full CI job table, `npm run pre-ship`, 390x844 browser walk, production shape survey (no DB read done; change is role gating only).
