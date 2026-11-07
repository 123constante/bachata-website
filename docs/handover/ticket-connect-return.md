# Handover: ticket-connect-return

Brief: `docs/briefs/ticket-connect-return.md` (brief-version 2).

## Done
- `connectReturnBanner` in `ticketModel.ts`: ONE pure mapping (Stripe x paid drafts x role x arrived x polling).
  Null unless arrived from Stripe and owner/manager; null for a free-only list or when tickets exist but none is a paid draft.
- `TicketsEntry.tsx`: remembers `arrivedFromStripe` before the URL params drop; `connectReturnPoll` refetches Stripe
  every 3 s for at most 30 s (stops on connected or unmount); banner above the list. Put on sale / Put all on sale call
  the same `move` as the Selling switch. Carry on with Stripe is the existing `onboard.go`. Buttons are `minHeight: 44`.
- Tests: `p3/tickets/__tests__/ticketConnectReturn.test.tsx` (table-driven, fake timers).

## Not verified
- A real Stripe return, and the 390x844 browser walk (the sign-in walk is the lead's). No prod shape survey run.
- Tests were written alongside the code, not run red-first against main.
- Banner shows 'Put on sale' for 1 paid draft, 'Put all on sale' for 2+ (brief wording read this way).

## Next
Phone walk at 390x844 with a real paid draft after Stripe return.

## Continuation 1
tsc run on HEAD: 0 errors. Fixed the red unit check: the ellipsis in CONNECT_RETURN_CHECKING is now the \u2026 escape (same visible text), so no raw U+2026 remains in source.
