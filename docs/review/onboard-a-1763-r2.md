PASS WITH NITS

# Review round 2 (delta): PR #1763 buyer onboarding slice A

Reviewed head `334d3cf2297ce992dd67f2711a13925ba235a71b` (`origin/claude/onboard-a`), read-only. Delta: fix commit `cab193e` (diff `3bfe74e2d..334d3cf22`). Brief: `brief/review-onboard-a-1763-r2:docs/briefs/review-onboard-a-1763-r2.md`. Round 1 report: `claude/review-onboard-a-1763:docs/review/onboard-a-1763.md`. Line numbers are at the reviewed head.

**What the verdict means.** The three round 1 blockers are fixed, each with tests that fail on the old code. With the flag OFF nothing a person sees or sends changes. The nits below do not block the merge; R2-N1 and R2-N2 should be looked at before `VITE_ENABLE_BUYER_ONBOARDING` is switched on.

## Round 1 blockers

### H1. After-midnight grace: FIXED
- `src/modules/tickets/ticketCardStatus.ts:40-46`: `ticketNightKey(now)` is London today, rolled back one day before 08:00 London, using `ROLLOVER_HOUR` from `src/lib/programDayRollover.ts` (not a second copy of the number). `ticketStatusAt` is what both screens call: `src/modules/tickets/MyTicketsPage.tsx:50` and `src/modules/dancer-app/screens/tickets/TicketCard.tsx:55`. No caller of the old plain-day compare is left on a screen.
- Zone is right: `londonDateKey` and `londonMinutesOfDay` both read the London wall clock, and the test has two BST rows.
- Tests: `onboardTicketStates.matrix.test.tsx` rows for 00:30, 07:59 (valid), 08:00, 09:00 (passed), 23:50 on the night, two mornings after, BST x2, plus two card renders (QR still there at 00:30, "This night has passed" at 09:00).
- Fail on old code: yes. 10 of these fail with the pre-fix source. Note: 9 of the 10 fail only because `ticketStatusAt` / `ticketNightKey` did not exist; the row that proves the old BEHAVIOUR was wrong is the card render at 00:30 (old code hid the QR). That one row is enough.

### H2. "Under another email" claim: FIXED
- Copy (`model.ts`), view field (`CardView.paid_email.otherEmail`) and render (`TicketCard.tsx`) are all gone. `useTicketCard.ts` is byte-identical to main again (it is no longer in `git diff origin/main...334d3cf22`).
- An empty QR read on a paid order shows only "Your tickets are in your email" with the flag ON or OFF.
- Tests: hook row for flag ON and OFF (`toEqual({ kind: 'paid_email' })`), card row asserting one line and no "another email". The flag ON hook row fails on the old code.

### H3. "Not you?" and a failed sign-out: FIXED
- `src/modules/tickets/TicketPickerB1.tsx:168-176`: `'failed'` or a thrown `signOut()` shows "We could not sign you out. Try again." (`role="alert"`, `picker-not-you-error`), the email card does not open, the old address stays on the line. Busy guard plus `disabled` on the button while it runs. Both success outcomes (`signed-out`, `signed-out-locally`, `src/hooks/useAuth.tsx:30`) carry on to the email card, which is right.
- Tests: `pickerNotYou.test.tsx` rows for `'failed'`, throws, and the double tap (one `signOut` call). All three fail on the old code.

## No regression

- **Flag OFF identical.** Re-read every hunk of `git diff origin/main...334d3cf22` for `TicketPickerB1`, `TicketThanksPage`, `MyTicketsPage`. Round 1 N1 is fixed (`??` restored at `TicketPickerB1.tsx:80`, same as main). `TicketThanksPage` redirect target is unchanged with the flag OFF; the import was moved up (N9). `MyTicketsPage` with the flag OFF: status is the constant `'valid'`, so QR, code and layout are as on main. The only flag-OFF difference left is the invisible `data-ticket-status="valid"` attribute (round 1 N2, skipped per the fix brief).
- **Silent create.** `src/modules/dancer-app/api/rpc.ts` and `gateRpc.ts` are not in the fix diff. Still one call site, still not imported by the picker or checkout, any create failure still rethrows the original `no_profile`. Never on the sign-in or payment path.
- **Allow-list.** Unchanged in the fix commit (same 7 files). `node scripts/check-dancer-area-isolation.mjs` at the head: exit 0.

## Dancer-app edits, flag OFF

- `TicketCard.tsx`: status is `'valid'`, `reason` is null, so the QR button, the door code and `DoorView` draw as on main. Extra: the `data-ticket-status` attribute only.
- `model.ts`: two optional fields on the `CardTicket` type; `otherEmail` copy and field removed. Type only.
- `useTicketCard.ts`: byte-identical to main.
- `TeaserScreens.tsx:73`: `orderCard` is `false` with the flag OFF, so `first` and the render are as on main. Flag ON now uses `isOrderId` (round 1 N6 fixed).
- `fakeBackend.ts`: test double only. `archivedRetiredStub` now returns `created: false` (round 1 N5 fixed); no production import path changes behaviour.

Behaviour-neutral with the flag OFF: yes.

## Copy

British English; the one new string ("We could not sign you out. Try again.") is plain ASCII; no raw Unicode punctuation in any added `src` line (searched the added lines for non-ASCII: none). "Not you?" tap target is `min-h-[44px]`, explicit px; text sizes are `text-[13px]`. OK.

## Nits (do not block)

- R2-N1. `src/modules/tickets/MyTicketsPage.tsx:50`, low. The status now reads the real clock, while the same card's "when" line and the Upcoming / Past grouping use the injected `today` prop (`:65`, `:154`). Two effects: (a) the page's status cannot be driven by the prop, so round 1 N4 (no `my-ticket-status` test on this page) is still open and a test must fake the clock; (b) flag ON, between 00:00 and 08:00, last night's ticket sits under "Past" while still valid. The QR is still reachable there ("Show QR code"), which is the same as today with the flag OFF, so nobody loses anything. Fix: pass `now` down, or derive both from one value; add one page-level row at 00:30 and 09:00.
- R2-N2. `src/modules/dancer-app/screens/tickets/useTicketCard.ts:77`, low, not from this PR. With no `?o=` in the address the Tickets card picks tickets with the plain calendar day (`upcomingCardTickets(..., londonTodayKey())`), so after midnight last night's ticket is not offered on that card at all, flag ON or OFF. The H1 fix covers the checkout-return card (`?o=`) and `/account/my-tickets`. Same as main, so not a regression; decide before the flag goes on whether the card should use the same night key.
- R2-N3. `src/modules/tickets/TicketPickerB1.tsx:307`, cosmetic. After a failed sign-out the red line stays until "Not you?" is tapped again; tapping Continue pays with the old address while the line is still on screen. True statement, mildly confusing. Fix: clear `notYouErr` in `onContinue`.
- Round 1 N2, N4, N7, N8 remain open, skipped per the fix brief. N7 ("Older tickets are still valid." next to "This night has passed", `myTicketsModel.ts`) should be reworded before the flag goes on.

## Checks run (at `334d3cf22`, in a throwaway worktree, PR branch not touched)

- `npx vitest run` on `onboardTicketStates.matrix.test.tsx`, `pickerNotYou.test.tsx`, `ensureProfile.matrix.test.ts`: 3 files, 54 tests, all pass.
- Same three files with the non-test `src` files put back to `3bfe74e2d`: 15 failed, 39 passed (H1 x10: 9 status rows + 1 card render; H2 x1; H3 x3; N5 x1). So the new rows do fail on the old code.
- `npx vitest run src/modules/tickets src/modules/dancer-app`: 79 files, 2198 tests, all pass.
- `node scripts/check-dancer-area-isolation.mjs`: exit 0.
- `npx tsc --noEmit -p .` at `334d3cf22`: exit 0, no errors.

## Not verified

- No browser walk at 390x844, flag ON or OFF. This round is reading plus unit tests.
- Full unit suite, e2e, the lint chain: not run (brief: targeted only).
- No prod read this round. Round 1 read the three function definitions; nothing in the fix depends on new data shapes.
- A real failed sign-out on a phone (H3 is unit-tested only), and whether the 3 s sign-out wait feels stuck with the button at half opacity.
- PR #1763's CI status and PR body were not inspected.
- Whether ticket sales stay open after midnight for a night in progress (how often the 00:00 to 08:00 window is hit in practice).

## Handover (review worker, ticket dt_858d3f95c7b3)

- Done: this verdict. PR #1763's branch was not touched.
- Left / next steps: owner decides the merge of #1763 (flag OFF). Before the flag is switched on: R2-N1, R2-N2, round 1 N7, and a signed-in 390x844 walk with the flag ON.
- tsc run on 334d3cf22 (the reviewed head): 0 errors. This branch holds one `.md` file and no source files, so there are no branch files for tsc to check.
