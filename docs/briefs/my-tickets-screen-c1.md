# BRIEF: my-tickets-screen-c1 (WEBSITE, continuation of PR #1334 on branch claude/my-tickets-screen; Sonnet, medium effort; normal lane). Push ONCE to the existing branch. Tiny: review nits N1 and N2 only, NO other change.

Brief-version: 2

Context line: stay under 50% of your context; early checkpoint push, push + handover by 50%. Never approve/merge/--no-verify. Plain git only. Supabase READ-ONLY (you will not need it). No migration. Never ends a turn on a background task. Source files over 2 KB go through scripts/safe-edit.py / safe-write.py (read the hook message). Hard limits are at the end.

Read first: `docs/review/1334-r1.md` (on branch claude/review-1334-r1, findings N1 and N2), `docs/handovers/my-tickets-screen.md`, `src/modules/tickets/MyTicketsPage.tsx`, `src/modules/tickets/myTicketsModel.ts`, `src/modules/tickets/__tests__/myTickets.matrix.test.tsx`.

## What main lacks (proofs, at head 28fe68c83)
- N1: `TicketCard` starts with `useState(!past)`, so EVERY upcoming ticket opens with its QR drawn on mount, and each open card builds its QR in a `useMemo`. `my_tickets_v1` returns up to 500 rows (`MY_TICKETS_CAP`), so a buyer with dozens of upcoming tickets builds dozens of QR codes at once on a phone. The matrix test never goes above 3 tickets (`several in one order` is the largest) -- extends: src/modules/tickets/MyTicketsPage.tsx
- N1 (model half): nothing in `myTicketsModel.ts` decides which cards open by default; the rule lives in one `!past` expression -- extends: src/modules/tickets/myTicketsModel.ts
- N2: no matrix row for a past ticket that is also checked in. The code path (`Show anyway` sets `anyway` and `open`) reads as correct but is unpinned -- extends: src/modules/tickets/__tests__/myTickets.matrix.test.tsx

## Files
- src/modules/tickets/myTicketsModel.ts
- src/modules/tickets/MyTicketsPage.tsx
- src/modules/tickets/__tests__/myTickets.matrix.test.tsx
- docs/handovers/my-tickets-screen-c1.md

Nothing else. No route, flag, package, qr.ts, API or copy change.

## What to build (tests first, red against the unfixed code; say so)
1. Model: add `export const QR_OPEN_DEFAULT = 3;` and a pure `qrOpenByDefault(upcoming: MyTicket[], todayKey: string): Set<string>` returning the `ticketId`s whose QR starts open: the tickets dated today first (in server order), then the other upcoming tickets in server order, and take the first `QR_OPEN_DEFAULT` of that list. Past tickets are never in the set (they stay collapsed, as today). Checked-in tickets are unaffected (their QR stays behind "Show anyway"). One mapping: the page reads only this function.
2. Page: `TicketCard` takes `defaultOpen: boolean` instead of deriving `open` from `past`; `useState(defaultOpen)`. `Section` passes `defaultOpen={openSet.has(t.ticketId)}` for upcoming and `false` for past; compute `openSet` once with `useMemo` next to `groups`. A collapsed upcoming card shows the existing "Show QR code" button; no new copy.
3. Tests (red first):
   - Model table for `qrOpenByDefault`: 0 tickets; 2 tickets (both open); 5 upcoming (first 3 open); 5 upcoming where tickets 4 and 5 are dated today (the two today tickets open first, then ticket 1); 40 upcoming dated today (exactly 3 open); a null-date ticket counts as an ordinary upcoming ticket; past tickets never open.
   - Matrix row `40 upcoming tickets`: exactly 3 `ticket-qr` nodes, 37 `Show QR code` buttons, and clicking one opens that card's QR (4 nodes).
   - Matrix row `past + checked in`: the card shows "Checked in at ...", no `ticket-qr`, a `Show anyway` button; clicking it shows the QR and "Already used at the door."
   - Update the existing rows only where they now conflict: `several in one order` (3 tickets) still expects 3 QR nodes (3 <= QR_OPEN_DEFAULT); the `token never reaches ...` test stays as is and passes.
4. `docs/handovers/my-tickets-screen-c1.md`: what changed (2-3 lines), tests red-then-green with counts, Verified / Not verified (say that no browser walk was done: the orchestrator walks it).

## Run before you push (read `.github/workflows`; say the result of each)
`npx vitest run src/modules/tickets`, `npx tsc --noEmit`, and the lint chain steps that apply to these files. Put the per-job table in the PR body note of your handover.

## Hard limits specific to this brief
- No change outside the four Files. No new dependency. The token must still never be logged, put in a URL or any attribute; keep `data-testid` values as they are.
- Do not touch `flagOff.test.ts` expectations; the route stays flag-gated and lazy.

## Done when
New rows are red-then-green, `src/modules/tickets` tests, tsc and lint are green, the branch carries one push, the handover has Verified / Not verified. Then: orchestrator walk at 390x844 and 320x568 (website-18), pack by website-44, owner Approve/merge per the normal lane.
