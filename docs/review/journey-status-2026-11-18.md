# Buyer journey status: Get tickets to QR (2026-11-18)

Read-only audit. Sources: code on origin/main at 0682fb5, git log (the sandbox clone is shallow,
so the history only reaches back to #1701; any PR older than that is listed as "pre-#1701"),
read-only prod SELECTs on project stsdtacfauprzrdebmzg (counts only, no personal data),
and the prod edge-function list.

## What could not be read

- `~/.claude/plans/DESIGN-REGISTRY.md` (rows "Ticket picker page", "Post-pay screen", "Buyer
  onboarding B+C", "Buyer order confirmation email") and
  `DECISIONS-ticket-buyer-onboarding-2026-11-17.md`: NOT REACHABLE. They are not in this cloud
  sandbox or in the repo. So the "vs registry spec" comparisons below use the spec words quoted
  in the brief (stepper, promo box, total bar, trust line, "Continue to Stripe", "Simple and warm",
  "lock look C", "Home card B"). They are not a line-by-line check against the registry.
- Vercel env values (every `VITE_*` flag): NOT REACHABLE. The proxy refuses `api.vercel.com`,
  and the prod site cannot be fetched to inspect its bundle. All `VITE_*` flags are ON only for
  the exact string `'true'`, so they default to OFF. Where prod data shows that a path has run,
  that is noted as evidence. **Needs owner:** read the Vercel env values, or allow
  api.vercel.com for this environment.
- Edge-function source code (it lives in the admin repo): the bodies were not read. Only the
  deployed slugs and versions were.

## Flags at a glance

| Flag | Where | Prod value |
|---|---|---|
| `VITE_ENABLE_PUBLIC_TICKETING` | Vercel env, `src/lib/featureFlags.ts:116` | UNKNOWN. Probably ON: 2 checkout attempts in the last 7 days and 3 paid orders ever |
| `VITE_ENABLE_TICKET_PICKER_B1` | Vercel env, `featureFlags.ts:124` | UNKNOWN |
| `VITE_ENABLE_BUYER_ONBOARDING` | Vercel env, `src/lib/buyerOnboardingFlag.ts:8` | UNKNOWN |
| `VITE_ENABLE_TICKET_TEASER` | Vercel env, `src/modules/dancer-app/screens/teaser/teaserFlag.ts:7` | UNKNOWN |
| `app_feature_flags.dancer_area_open` | DB row | true (since 2026-10-15) |
| `app_feature_flags.buyer_account_link` | DB row | true (since 2026-11-18 01:24 UTC) |
| `app_feature_flags.buyer_onboarding_reminder_email` | DB row | true (since 2026-11-18 13:13 UTC) |

## Step by step

### 1. Event page Get tickets button: BUILT-FLAG-OFF (prod value UNKNOWN)

- `src/modules/event-page/bento/EventStickyActionBar.tsx:249-261` (`data-testid="buy-in-site"`).
  The label is **"Buy tickets"**, not "Get tickets"; "Get tickets" appears only in a code
  comment. The button opens an in-page overlay through `onOpenTickets`.
- It shows only when the probe (`InSiteTicketProbe.tsx`) answers `buy`. Otherwise it shows a
  grey quiet state ("Choose a night", "Sold out") plus a "Tickets elsewhere" link.
- `BentoPage.tsx:908` gates it: `flags.publicTicketing && !over && !cancelled && !paused`.
- Flag: `VITE_ENABLE_PUBLIC_TICKETING`. PRs: pre-#1701 (the clone is shallow).

### 2. Picker B1: BUILT-FLAG-OFF (prod value UNKNOWN)

- `src/modules/tickets/EventTicketsPage.tsx:188-191` chooses between B1 and the classic page.
  The UI is in `src/modules/tickets/TicketPickerB1.tsx`, with helpers in `pickerModel.ts`.
- Flag: `VITE_ENABLE_TICKET_PICKER_B1`, which also needs `VITE_ENABLE_PUBLIC_TICKETING`.
- PRs: original build pre-#1701, then #1754 (fix2), #1763, #1772, #1773.
- What renders:
  - "Back" at the top.
  - Event title, date, venue.
  - One row per ticket type: name, price, and a round minus / count / plus stepper with 40px
    buttons.
  - A cap note at 20 tickets.
  - Promo box: "Promo code" / "Enter code" / "Apply".
  - Terms toggle.
  - Total bar: count plus total, a required terms checkbox, and "Continue".
  - Trust line: lock icon, "Secure payment by Stripe. We never see your card."
- Deviations from the spec words in the brief (no registry text to check against):
  1. **The promo box is a stub.** Every code returns "Promo codes are not available yet."
     (`TicketPickerB1.tsx:203-209`). The applied-code UI is not built
     (`docs/briefs/ticket-picker-b1-handover.md:12`), even though prod has a
     `ticket_promo_codes` table and promo RPCs.
  2. The entry button reads "Buy tickets", not "Get tickets".
  3. The button says "Continue", not "Continue to Stripe" (see step 3).
  4. A required terms checkbox sits in the total bar. Continue is blocked until it is ticked.
     Check whether the registry wants this.
  5. The header shows the date only; `dateOnly` strips the time.
  6. The booking fee is in the total maths, but `BOOKING_FEE_PENCE = 0`
     (`src/lib/ticketBookingFee.ts:16`), so no fee line shows.
- Not verified at build time (fix1 handover :32): a live multi-line checkout, a real OTP email,
  a real Stripe redirect, a real device.

### 3. Email card, Continue to Stripe: BUILT-FLAG-OFF (same flag as step 2)

- Email card (`TicketPickerB1.tsx:305-318`): "Where should we send your tickets?" / "We email
  you a code to confirm it is you." Then a 6-digit code card (`:320-329`, Supabase
  `signInWithOtp` + `verifyOtp`, resend after 60 s).
- A signed-in buyer skips the code. With `VITE_ENABLE_BUYER_ONBOARDING` on, they also see
  "Tickets go to {email}. Not you?" (#1763, #1773).
- **Deviation:** the button reads "Continue", not "Continue to Stripe".
- Payment hand-off: `ticketCheckoutApi.ts:107` POSTs to the edge function `ticket-checkout`
  (admin repo, prod v29, ACTIVE). Free orders skip Stripe and go to
  `/tickets/thanks?o=..&free=1`.

### 4. Stripe return, checkout lands on Home: BUILT-FLAG-OFF (prod value UNKNOWN)

- `success_url` is always `/tickets/thanks` (`ticketCheckoutModel.ts:18`). That route is
  mounted only under `publicTicketing` (`AnimatedRoutes.tsx:244-245`).
- `TicketThanksPage.tsx:46-50`, for a signed-in buyer:
  - flag ON: forwards to `/app/home?o=` (Home);
  - flag OFF: forwards to `/app/tickets?o=`.
- A signed-out buyer stays on the thanks fallback with `OrderQrBlock` (QR shown on that page).
- Flag: `VITE_ENABLE_BUYER_ONBOARDING`. PR #1763.
- `DancerAppRoutes.tsx:59` sends `/app/home?o=` on to Tickets when the teaser is not showing.

### 5. Order confirmation email ("Simple and warm"): UNKNOWN, and probably NOT BUILT to that spec

- Nothing in this repo. The sender is the admin edge function `ticket-email` (prod v28,
  ACTIVE, last deployed about 2026-11-17).
- The existing email carries the QR (`docs/review/ticket-readiness-audit.md:41,160`; #1131
  "email QR"). That contradicts "no QR text".
- Subject and single-button layout: UNKNOWN (the function body was not read).
- Prod: all 3 paid or refunded orders have `email_status = sent`.

### 6. Post-pay teaser, ticket small card, full QR at top of Nights

- **Teaser: BUILT-FLAG-OFF.**
  - Files: `src/modules/dancer-app/screens/teaser/TeaserScreens.tsx`, gated in `teaserGate.ts`.
  - Flag: `VITE_ENABLE_TICKET_TEASER`. It also needs publicTicketing and an unfinished profile.
  - Lock look: blurred content with a gold "Locked" chip, and one sheet: "Finish your profile
    to use this".
  - Home: finish card "1 of 4 to finish your profile", a small "Your ticket" card that links to
    Nights, and "Also" locked rows.
  - The names "lock look C" and "Home card B" appear nowhere in code or docs, so a match to the
    registry options is UNKNOWN.
- **Full QR at top of Nights: BUILT-FLAG-OFF** (teaser flag). `TeaserScreens.tsx:112-133` puts
  the full `TicketCard` at the top of the Nights twin.
- **Ticket card and QR: BUILT behind publicTicketing.**
  - Files: `screens/tickets/TicketCard.tsx` (QR carousel :48-68, full-screen door view
    :88-105), `TicketsScreen.tsx`, and `/account/my-tickets` (`MyTicketsPage.tsx:96`).
  - The QR is drawn by `qrcode-generator` at level M, encoding the 64-hex `qr_token`.
  - Data comes from the RPCs `my_tickets_v1` and `my_ticket_order_qr_v1`.
  - Card status greying is under the onboarding flag.
- PRs: #1753, #1763, #1769, #1773. The teaser build itself is pre-#1701.

### 7. Buyer onboarding and the 24h reminder email

- **"What are you?": BUILT-FLAG-OFF.**
  - `src/modules/dancer-app/shell/roleStep.tsx`, wired in at `profileSheet.tsx:32,78`.
  - Multi-pick plus Skip, saved with the RPC `set_my_buyer_roles_v1`.
  - Flag: `VITE_ENABLE_BUYER_ONBOARDING`. PR #1769.
  - Follow-up: roles are not shown on the organiser side.
- **Finish card: BUILT-FLAG-OFF** (teaser flag, as in step 6).
- **24h reminder email: BUILT-ON at the DB level; content UNKNOWN.**
  - Admin edge function `ticket-onboarding-reminder`, prod v3, ACTIVE.
  - Gated by `app_feature_flags.buyer_onboarding_reminder_email`, which is **true** (switched
    on 2026-11-18 13:13 UTC).
  - `buyer_onboarding_reminders` has 0 rows so far.
  - "Ticket first, QR" content: UNKNOWN.
  - `docs/handover/onboard-b-slice-b.md:19` says slice C was waiting for its prototype round,
    yet the flag is now on. **The owner should confirm the deployed content was the agreed
    prototype.**
  - Website side: only regenerated types (#1770).

### 8. Refund and night-cancelled emails: BUILT (admin), live state UNKNOWN

- Admin edge function `ticket-status-emails`, prod v2, first deployed about 2026-11-17. It logs
  to `buyer_status_emails` (`kind`, `send_status`).
- Refunds go through `ticket-refund` (v27).
- Prod: `buyer_status_emails` has 0 rows. The single refunded order predates the function, so
  "it has never fired" is not proof that it is broken.
- Website gap (`docs/handover/onboard-a-slice-a.md:31`, NEEDS ADMIN): `my_tickets_v1` and
  `my_ticket_order_qr_v1` return only paid orders and non-void tickets. The website cannot show
  a refunded or night-cancelled ticket state; the ticket just disappears.

### 9. Prod counts (2026-11-18, counts only)

| Measure | Last 7 days | All time |
|---|---|---|
| ticket_orders expired | 4 | 6 |
| ticket_orders pending | 1 (hold not yet expired) | 1 |
| ticket_orders paid | 0 | 2 |
| ticket_orders refunded | 0 | 1 |
| tickets used | 0 | 3 |
| tickets void | 0 | 1 |
| ticket_checkout_attempts | 2 | - |
| ticket_webhook_events | 0 | - |

- Last paid order: 2026-11-07 11:42 UTC.
- Paid orders with no ticket row: **0**.
- Paid tickets with an empty `qr_token`: **0**.
- Paid orders where ticket count is not equal to quantity: **0**.
- Paid orders with no `buyer_user_id`: **1**. That buyer cannot see the ticket in `/app` and
  has only the email QR and the thanks page.
- `buyer_status_emails`: 0. `buyer_onboarding_reminders`: 0. `night_reminder_sent_log`: 0.
- Email status on paid and refunded orders: all 3 are `sent`.

## Gaps, ranked by what blocks a buyer reaching the QR

1. **The Vercel flag state is unknown.** Is `VITE_ENABLE_PUBLIC_TICKETING`,
   `VITE_ENABLE_TICKET_PICKER_B1`, `VITE_ENABLE_BUYER_ONBOARDING` or `VITE_ENABLE_TICKET_TEASER`
   on in prod? Until that is known, nobody can say which path a buyer walks. Needs owner.
2. **The B1 end-to-end path has never been verified live:** multi-line `ticket-checkout`, the
   real OTP email, the real Stripe redirect, a real device (fix1 handover :32). There has been
   no paid order since 2026-11-07, and 4 of 5 orders in the last 7 days expired unpaid.
3. **Promo codes are a stub in B1.** A buyer with a code cannot use it, while the server side
   exists.
4. **Signed-out and unlinked buyers.** 1 of the paid orders has no `buyer_user_id`. That
   buyer's only QR is the email or the thanks fallback, which matters if the confirmation email
   drops the QR ("no QR text").
5. **The confirmation email content does not match "Simple and warm / no QR".** It is
   unverified: the current email carries the QR. A rebuild must not remove the QR before the
   in-app path (gap 4) covers every buyer.
6. **No refunded or cancelled state on the website.** Tickets just vanish from My tickets
   (NEEDS ADMIN RPC change).
7. **The 24h reminder is switched on but has never sent.** Its content was not checked against
   the slice C prototype.
8. **Copy deviations:** "Buy tickets" vs "Get tickets", "Continue" vs "Continue to Stripe".
   The "lock look C" and "Home card B" names cannot be checked without the registry.

## Not verified

- The registry rows and the decisions file (not reachable).
- Vercel env flag values (proxy refused api.vercel.com; the prod site cannot be reached).
- Edge-function bodies: email subjects, buttons, QR content.
- No browser walk. This is a read-only audit with no UI change.
- PR numbers older than #1701 (shallow clone).
