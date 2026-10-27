# Brief: P3 W-T ticketing re-skin (Website, normal lane, Design Gate stages 1-2 first)

Repo 123constante/bachata-website. Branch `claude/p3-wt-ticketing` from fresh main. Read first: `~/.claude/plans/ARC-p3.md` section 7 and 10 (copy the relevant lines into the PR body; you cannot see ~/.claude, so they are quoted below).

## Goal
Ticketing's organiser screens (`src/modules/organiser/tickets`, route `/account/tickets`, flag `organiserTicketing`) were built as a standalone black/orange area. Rebuild them INSIDE the P3 shell (`src/modules/organiser/p3`: cream/terracotta tokens in `theme/p3.css`, bottom tabs Home/Events/Stats/You, `Sheet.tsx`, wording "Do it in the current organiser area"). Neither flag is live in prod, so restyle before launch. Backend is unchanged and proven on prod: do NOT touch Supabase, edge functions, `ticketModel.ts`/`ticketsApi.ts` contracts or their matrix tests (reuse them).

## Owner decisions (clicks 2026-10-27, final)
- Tickets entry = a Tickets row on each P3 EVENT PAGE (`p3/screens/EventPage.tsx`). Plus a Get paid prompt on P3 Home while selling is possible but not set up.
- Get paid (Stripe Connect onboarding) = Home prompt + a full Get paid screen under You.
- P3 theme tokens win. Ticketing's dark theme is dropped. No new token file.
- Old `/account/tickets` stays flag-off until the P3 version replaces it, then delete it in the same PR series (not before the walk passes).

## Screens in scope
Get paid; add ticket sheet (3 steps); tickets list with Selling toggle; orders list; Refund sheet. Known defects to fold in: add-ticket sheet reset once before saving (click at the review step, not reproduced twice: write a test that holds the draft across a re-render); Refund label placement. OUT of scope: the thanks page "confirmed" state (needs a new DB read, separate careful slice).

## Phase A (this dispatch): design only, nothing built
1. Design brief (5 lines) in `docs/design/p3-wt-ticketing.md`.
2. 2-3 standalone HTML mockups at 390x844 in `mockups/p3-wt-ticketing/` (named approaches), covering: event page Tickets row (no ticket types / selling / paused), Home Get paid prompt, You > Get paid, add-ticket sheet steps 1-3, list, orders, Refund sheet, and the empty/loading/error states. Inventory the existing ticketing screens first so no field or action is missing (owner must never list what is missing).
3. Push, report the mockup list. STOP. The owner picks; a continuation dispatch builds.

## Phase B (later, on the owner's pick)
Build per the pick; consistency matrix table-driven per screen x shape (shapes from prod: org with 0 / 1 Stripe account row, 0 / 2 ticket types, paused, orders paid / free / refunded, past event); walk 390x844 as the walk test account (flags organiserP3 + organiserSelfServe + organiserTicketing); tokens/contrast/tap >= 44px checks; independent critique by a different worker; two review rounds (money).

## Do not
Merge, approve, touch migrations or `supabase/**`, add a second theme file, or edit the calendar density-exempt files.
