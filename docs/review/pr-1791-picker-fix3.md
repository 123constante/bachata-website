# Review: PR #1791 (claude/ticket-picker-b1-fix3)

**Verdict: PASS WITH NITS**

- PR: #1791, branch `claude/ticket-picker-b1-fix3`
- Head reviewed: `de10ce0296ee1d294cb84c7c392ca4e71566ee73` (the brief names `e759d0af`; `de10ce0` sits on top of it and adds only the six PNGs under `docs/screenshots/ticket-picker-b1-fix3/`, so the code is the same as `e759d0af`)
- Base: merge-base `2b493f3` (main is now at `eb28fc5`)
- Review only. No code changes, no approval, no merge.

## Checks from the brief

### 1. Header hidden only on the picker route — OK
- The header is hidden by stacking, not by a route switch. The picker's root moves from `z-50` to `z-[65]` (`TicketPickerB1.tsx`, root `div`). `GlobalHeader` is `fixed z-[60]` (`src/components/GlobalHeader.tsx:107`), so the full-screen white picker now sits on top of it.
- `TicketPickerB1` has one importer, `EventTicketsPage.tsx`, which is behind `flags.ticketPickerB1`. So the header is covered only while the picker is mounted. When the flag is off, the classic tickets page and every other event-page state keep `GlobalHeader`.
- The only BentoPage change is one prop, `venueName={pageModel.location.venueName || null}`. Nothing else in the event page moved.
- Layers at `z-[70]` (search, DescriptionModal, organiser sheets) and toasts at `z-[100]` still sit above the picker, as the code comment says. None of them can be opened from inside the full-screen picker.

### 2. Terms gate and email — OK
- Terms are gated in the UI and in the handlers:
  - Signed out (email card): the submit is `disabled={busy || !termsAccepted}`, and `sendCode()` returns early when `!termsAccepted`.
  - Signed in (new `confirm` card): `picker-pay` is `disabled={!termsAccepted}`, and `startPayment()` returns early when `!termsAccepted`, which also covers the path after a code check.
- Email is still required. `isEmail` validation is unchanged, the OTP send is unchanged, and `buyer_email` is still posted. This is asserted in the "signed in: no code step" test (`buyer_email === 'in@x.co'`) and in the signed-out flow.
- If the user is signed out while the confirm card is open, `card` falls back to `'email'`. No card can show "Tickets go to null".
- The bar's Continue no longer waits for terms (`blocked` drops `TERMS_REASON`). This is intended, because the gate moved into the card. The preview-origin guard and `pv.buyBlocked` still hold the bar's Continue.

### 3. Price, promo and checkout logic — OK, nothing changed
- No change to `payPence`, `promoTotal`, the re-pricing in `applyPromo`, `held`, `priceChangedText` or the checkout body.
- What did change is display or flow only:
  - `roll` state that replays the total animation
  - `appliedCode` in the card summary
  - stub layout and the 15/18px font step-down for long amounts
  - `onContinue` opens `confirm` instead of calling `startPayment` straight away (one extra tap for signed-in buyers, as the prototype shows)
- The promo-checkout test still asserts `expected_unit_price_pence`, `expected_total_pence` and `promo_code` in the POST body.

### 4. Tests cover the new layout and would fail on the old one — OK
- On the PR head, `npx vitest run src/modules/tickets` plus `fixedLayers.test.tsx` pass: 29 files, 927 tests.
- I swapped `origin/main`'s `TicketPickerB1.tsx` in under the PR's tests: `ticketPickerB1.test.tsx` gets 8 failures (new `picker-pay`, `picker-card-summary`, `picker-terms-reason`, the bar Continue enabled before terms, and the signed-in confirm step).
- `tsc -p tsconfig.app.json`: no errors in the changed lines. The BentoPage errors at lines 436-438 and 822 are already on main and are not in this diff.

### 5. Tap targets in explicit px — OK, one nit
- Every size in the diff is explicit px (`h-[36px]`, `min-h-[40px]`, `text-[13px]`, and so on). No rem-based Tailwind sizes were added.
- The steppers are 36x36. The owner accepted this over the 44px rule (2026-11-18), and a code comment records that.

## Nits (non-blocking)
1. The promo-stub **Remove** button is `min-h-[32px]` with a 12px label, the smallest tap target on the screen and below the 40px used elsewhere. It is not one of the owner's accepted exceptions. Consider `min-h-[40px]`.
2. No test pins the header-hiding layer, for example by asserting the root has `z-[65]`, above the header's `z-[60]`. Without one, a later edit back to `z-50` would bring the header back without any test failing.
3. No test pins the venue line now being the **name only** (`venueName`, not name + address). The `EventTicketsPage` to `TicketPickerB1` prop swap has no test.
4. The six walk screenshots are all signed out. The signed-in **"Check and pay"** card ("Tickets go to …", Not you?, terms, Continue to Stripe) is covered by tests only and has no 390x844 screenshot.
5. `pickerNotYou.test.tsx` passes on the old picker too. It moves with the layout but does not prove the line now lives in the card. `ticketPickerB1.test.tsx` covers that instead, so this is minor.
6. The nav shows "Step 1 of 2" all the time, including while the email or code card is open over it. This is cosmetic and matches the prototype.

## Owner asks, checked against the screenshots
- Site header hidden on the picker: yes (`1-top.png`: no site header, only "‹ Back" and "Step 1 of 2").
- Terms box and "Tickets go to" in the email card: yes (`5-email-card.png` shows the terms tick box in the card; "Tickets go to" is in the signed-in confirm card).
- Steppers 36px: yes.
- Grey description line skipped: yes. The rows show the name, the on-sale label and the per-ticket line only.
