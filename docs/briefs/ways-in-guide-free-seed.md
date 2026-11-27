# Brief: Ways in guide opens with Free and Online both ticked (P24)

Size: 3 files, <=80 lines
Repo: 123constante/bachata-website
Branch: claude/ways-in-guide-free-seed
Kind: bug fix, non-visual logic (no new screens, no copy change)

## Problem
`TicketsV2.tsx` `openGuide` (~line 429) seeds the Ways in guide with
`online: rows.length > 0 || connected` and `methods: stored methods filtered to GUIDE_CODES`.
Free is meant to be exclusive (the guide's own toggles already enforce it:
`WaysInGuide.tsx:102-107`, test 'free is exclusive both ways'). But the seed is not normalised, so:
- Stripe-connected organiser + stored `free` -> guide opens with Free AND Online ticked.
- stored `free,door` or `free,ticket_link` (old toggles) -> guide opens with Free plus another way.

## Fix
1. In `src/modules/organiser/p3/v2/WaysInGuide.tsx` export a pure function:
   `guideInitialFrom(stored: PaymentMethod[], hasTickets: boolean, connected: boolean): Pick<GuideAnswers, 'online' | 'methods'>`
   - `methods0 = stored.filter(m => GUIDE_CODES-equivalent: door | ticket_link | free)`
   - If `methods0` includes `free` AND `!hasTickets` AND no other method in `methods0` -> `{ online: false, methods: ['free'] }` (Free wins over a bare Stripe connection).
   - Else -> `{ online: hasTickets || connected, methods: methods0.filter(m => m !== 'free') }`.
   (Import GUIDE_CODES from `./useWaysInGuideSave` only if it does not create an import cycle; otherwise inline the three codes.)
2. In `TicketsV2.tsx` `openGuide`, replace the `online:` and `methods:` lines with
   `...guideInitialFrom(parsePayment(oldMethods), rows.length > 0, connected),`. Keep the price/qty spread unchanged.
3. Tests in `src/modules/organiser/p3/v2/__tests__/waysInGuide.test.tsx` (pure function cases):
   - `['free']`, no tickets, connected -> online false, methods ['free']
   - `['free']`, no tickets, not connected -> online false, methods ['free']
   - `['free']`, has tickets -> online true, methods []
   - `['free','door']`, not connected -> online false, methods ['door']
   - `['door','ticket_link']`, connected -> online true, methods unchanged
   - `[]`, not connected -> online false, methods []

## Do not
- Do not change saving, copy, or the toggle logic in WaysInGuideView.
- Do not touch the skip-door code (separate PR #2501).

## Verified
Prod read 2026-11-27: `event_series_p5.payment_methods` has no `free` rows yet (767 null, door 5,
ticket_link 4, ticket_link+door 1, door+bank_transfer 1), so this is preventive; no data migration.

## Done when
`npx vitest run src/modules/organiser/p3/v2/__tests__/waysInGuide.test.tsx src/modules/organiser/p3/v2/__tests__/waysInRebuildWiring.test.tsx` green, `npx tsc --noEmit` clean, PR opened.
