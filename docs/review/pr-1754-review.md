# Review: PR #1754 ticket picker B1 (`claude/ticket-picker-b1` @ cd9741d8026816db8960e88de4695be3b0bc1aa0)

Independent hard-tier delta re-review (money path, flag `ticketPickerB1`). Read-only: no code was changed on
the PR branch, no Supabase reads or writes. ONE round, risky classes only (money flow, auth/OTP, RLS/RPC
contract, secrets). Prior rounds: round 1 BLOCK on PR #1747 (`origin/claude/review-1747:docs/review/pr-1747-review.md`);
round 2 PASS at code head 316a45346.

## Verdict: PASS

## Hard-tier: PASS

Reason: the only code change since the round-2 PASS is one string literal that swaps a raw U+2019 for the
`’` escape (same runtime string). All round-1 blockers stay fixed at cd9741d80. The flag defaults OFF, so
prod is unchanged on merge.

## Delta since round 2 (`git diff 316a45346 cd9741d80 --stat`)

```
 docs/briefs/ticket-picker-b1-fix1-handover.md | 32 +++++++++++++++++++++++++++
 docs/briefs/ticket-picker-b1-fix2-handover.md | 10 +++++++++
 src/modules/tickets/pickerModel.ts            |  2 +-
 3 files changed, 43 insertions(+), 1 deletion(-)
```

- `pickerModel.ts:10` `CANCELLED_NOTE`: `'...You weren’t charged.'` becomes `'...You weren’t charged.'`.
  Identical value at runtime; matches the repo rule against raw Unicode punctuation. No money, auth or
  contract effect.
- The two `docs/briefs/*.md` files are handover notes only. No secrets in them.

## Round-1 blockers at cd9741d80

1. **Terms of sale (was BLOCK): fixed.** `TicketPickerB1.tsx:77,91,279` adds a `termsAccepted` checkbox
   (`data-testid="picker-terms"`) with an expandable terms text (`:262-265`). `blocked` returns
   `TERMS_REASON` until it is ticked, and `onContinue` (`:153-154`) returns early while `continueOff`.
   Test `ticketPickerB1.test.tsx:117` checks the blocked copy.
2. **`price_changed` (was BLOCK): fixed.** `startPayment` (`:139-144`) parses the reply with
   `parsePriceChanged`, holds the new prices against the basket key (`heldFrom`, `:86`), invalidates
   `publicTicketKeys.types` (`:137,143`) and waits for a confirm tap. Any basket change spends the hold
   (`:121`). Stock/status refusals also re-read (`:150`). Test `:160-178` checks the confirm sends
   `expected_total_pence` 3200.
3. **20-ticket order cap (was should-fix): fixed.** `cleanBasket` clamps to `MAX_PER_ORDER` across the whole
   order (`pickerModel.ts:19-35`); `atCap` stops `+` (`TicketPickerB1.tsx:89`).
4. **Wire-body tests (was should-fix): fixed.** Test `:135-147` asserts the full `postTicketCheckout` body
   (lines, expected prices, `expected_total_pence`) and that no `promo_code` key is sent.
5. **Wrong vs expired code (nit): fixed.** `verifyCodeError` gives neutral "That code is wrong or expired."
   (test `:55`).
6. **OTP rate limit (nit): fixed.** `sendCodeError` maps 429 / `over_email_send_rate_limit` /
   `over_request_rate_limit` to the wait copy (`pickerModel.ts:62`, test `:53,150`).
7. **Account creation / shared-phone session (owner note): unchanged, still an owner decision.**
   `shouldCreateUser: true` stays (`:164`). Not a blocker while the flag is OFF.
8. **Preview origin (nit): fixed.** `checkoutOriginOk` gates `blocked` with `PREVIEW_ORIGIN_REASON` (`:91`).

## Flag default

- `src/lib/featureFlags.ts:124`: `ticketPickerB1: import.meta.env.VITE_ENABLE_TICKET_PICKER_B1 === 'true'`.
  Unset means OFF.
- `VITE_ENABLE_TICKET_PICKER_B1` is not in `.env.example` or `vercel.json` (`git grep` finds it only in the
  flag file and the handover brief).
- `EventTicketsPage.tsx:188-190`: OFF renders the classic page unchanged. Not touched by the delta.

## Risky classes

- **Money:** the server still re-prices every line and refuses with `price_changed`; the client sends
  `expected_unit_price_pence` + `expected_total_pence` only. No charge at an unseen price. Unchanged by delta.
- **Auth/OTP:** Supabase `signInWithOtp` / `verifyOtp` only; no token or code stored client-side. Unchanged.
- **RLS/RPC contract:** no new RPC, view or table. Reads `ticket_types` via the existing public query; posts to
  the existing `ticket-checkout` edge function. No migration.
- **Secrets:** none in the diff or the briefs.

## Nits (non-blocking, carried)

- `cleanBasket` drops a hold silently when it clamps (noted in fix2 handover). UI note only.
- Owner decision from round 1 item 7 (sign out after handoff when not signed in at start) is still open.

## Verified on real data

- Shapes: carried from round 1 (prod read-only: 17 on-sale ticket types across 3 series, up to 12 types in
  one series). No new prod reads this round; the delta does not touch data shapes.
- Checks: delta read line by line; round-1 fixes confirmed by source and test read at cd9741d80. PR CI at
  review time: completed checks green (Vercel, arm, decide, live-db-gate, masking-check, unit New_York,
  real-data-verified); unit full / build-smoke / e2e / phone-qa still pending.
- NOT verified: tests were not run locally (heavy jobs are barred on this PC; CI unit jobs cover them); no
  browser walk (text-only delta); no live `ticket-checkout` call (no writes).
