# Brief: Cancelled nights show on the public organiser page, marked Cancelled (organiser arc E7)
Brief-version: 2
Branch: claude/organiser-cancelled-nights
Lane: normal, Sonnet. Website only; no migration, no supabase/**, no types.ts, no perf-budgets.json or vite.config.ts.
Serves: a dancer on a public organiser page who sees a night vanish and wonders why; the organiser who cancelled it. Owner approved E7 on 2026-11-10 (docs/arcs/organiser.md:49: 23 organisers have an upcoming cancelled night).

## What main lacks
- The upcoming list drops every `is_cancelled` night (`if (occ.is_cancelled) continue;` in the upcoming loop), so a cancelled upcoming night is invisible -- grep: if (occ.is_cancelled) continue
- No shared "Cancelled" word for the public nights card; the organiser side owns CANCELLED_WORD only -- grep: PUBLIC_CANCELLED_WORD
- extends: the nights card model has no cancelled flag on upcoming items, only `PastNight.cancelled` for hosted counts -- src/modules/profile/nightsCardModel.ts

## Files
src/pages/OrganiserProfile.tsx
src/modules/profile/nightsCardModel.ts
src/modules/profile/NightsCard.tsx
src/modules/profile/__tests__/nightsCards.matrix.test.tsx
src/modules/profile/__tests__/organiserCancelledNights.test.tsx (new)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists, and report the coverage count (inventory items covered / total) at the end.
1. Prove the data source first (read-only prod): `get_organiser_nights_v2` returns cancelled upcoming rows with `is_cancelled`; state counts (rows, organisers with one, organisers whose only upcoming nights are all cancelled, lists at the 20-night cap).
2. Keep cancelled upcoming nights in the upcoming list, in date order, each with a "Cancelled" tag (text, not colour only; contrast >= 4.5), muted, no ticket/going/share action, still linking to the event page.
3. Cancelled nights NEVER count: not in stats, "nights hosted", upcoming count, next-night highlight, or the empty-state test. All-cancelled organiser: list shows them marked and the "no upcoming nights" line still says what to do.
4. The 20-night cap must count scheduled nights first; a cancelled night never pushes a scheduled one off the list.

## Tests
Table-driven, red first: shape (none, one cancelled, scheduled+cancelled, all cancelled, 20+ with cancelled) x (listed, tag text, counted in stats, action controls absent, empty state). Run against unfixed code first.

## Done when
Tests and every CI job step green; walked at 390x844 on a prod-shaped organiser (screenshots in PR, no sideways scroll); `npm run check:bundle-budget` adds 0 bytes to /app first load; PR body has Verified / Not verified (Not verified: live prod page if no cancelled night is present).
