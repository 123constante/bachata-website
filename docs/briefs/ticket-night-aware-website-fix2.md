# S1a Website fix round 2: spacer under the night list, honest festival note

Brief-version: 1
Repo: Website (123constante/bachata-website). Branch: `claude/ticket-night-aware-website` (PR #1523, push onto it; no new PR). Lane: careful. Opus builds. ONE push. Round-2 review (verdict FIX, one UI item + notes): `docs/review/ticket-night-aware-website-r2.md` on branch `claude/review-ticket-night-aware-website-r2`. Read it first.

## Do (red test first where jsdom can see it)
1. FIX-4: in `src/modules/tickets/TicketsBlock.tsx` (about :313-356) the 84px spacer that clears the fixed quiet bar sits ABOVE the night list, so the last night rows end under the bar. Move the spacer after the last in-flow element (or `pb-[84px]` on the list container when `quiet`). jsdom cannot see layout: add a structural test (spacer is the last child of the block when `quiet`), and list "browser walk at 390x844: last night row tappable above the quiet bar" under Not verified in the PR body.
2. N6: edit the PR body and `docs/design/ticket-night-aware-website.md`: the festival page (`FestivalDetail`) has no in-site ticketing surface, before and after this PR (separate ticket); the festival test shape is a fixture only. Do not claim festival coverage.
3. N7: one test that an applied promo preview is not shown after a prop-only night change (the `rerender` pattern in `nightControls.matrix.test.tsx`); confirm dropping the night from the `promoKey` call at TicketsBlock fails it.
4. N8: the dead disabled fallback title in `EventStickyActionBar.tsx` (~:224) must not say "from the event dates"; reword or remove.
5. Update the PR body Verified / Not verified (no browser walk yet; walk is the lead's after this push).

## Files
docs/handover/ticket-night-aware-website-fix2.md

Existing files you edit: `src/modules/tickets/TicketsBlock.tsx`, `src/modules/event-page/bento/EventStickyActionBar.tsx`, `src/modules/tickets/__tests__/nightControls.matrix.test.tsx`, `docs/design/ticket-night-aware-website.md`.
