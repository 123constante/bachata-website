# Brief: ownerless page request says "Help run this page" and needs a note

Brief-version: 2
Branch: claude/ownerless-request-copy
Lane: normal, Sonnet. bachata-website, must not touch src/modules/organiser/shared/ownership.ts decisions, any calendar density-exclusion file, or any supabase file.
Serves: a person who finds an organiser page with no owner and wants to help run it (arc organiser, row "I5 Website: ownerless claim copy"; PLAN-interim-manager-seats.md piece I5).

## What main lacks
- extends: the request panel in the public claim card has no ownerless wording ("Help run this page while the owner is away") and treats the note as optional -- src/modules/organiser/shared/components/PublicClaimCard.tsx
- No test pins that Send stays disabled with an empty note and says why -- grep: public-request-note-required
- No copy constant for the ownerless request heading, so it cannot be tabled with the other claim copy -- grep: OWNERLESS_REQUEST_HEADING

## Files
- src/modules/organiser/shared/components/PublicClaimCard.tsx
- src/modules/organiser/shared/__tests__/PublicClaimCard.test.tsx
- src/modules/organiser/shared/__tests__/PublicClaimCard.ownerless.test.tsx (new)
- docs/design/ownerless-request-copy.INVENTORY.md (new)
- docs/arcs/organiser.md

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. In the request panel (panel === 'request', page unmanaged), show heading "Help run this page while the owner is away" with one line saying what happens next (the Bachata Calendar team checks, you become a manager, not the owner). Constant OWNERLESS_REQUEST_HEADING.
2. The note label changes from "Who are you? (optional)" to required wording; "Request access" is disabled until the trimmed note has 3+ characters, and a visible line under the disabled button says why (data-testid public-request-note-required). maxLength 500 stays; tap targets >= 44px at 390x844.
3. Refusal and success copy are unchanged. Update the Status, Blocked by and PR link of the I5 row in docs/arcs/organiser.md in this same PR (owner decision 2026-11-06).

## Tests
Table-driven, red first against current main: kind (sign_in, claim, request, member, managed, hidden) x note (empty, spaces, 2 chars, 3+ chars) x hint (email_differs, no_email, unknown). Assert: heading only in the request panel; button disabled with the reason for short notes; no text points at a control not on screen; the claim and sign_in kinds are unchanged.

## Done when
PR checks green, every CI job step run per the workflow files, walked at 390x844 on a prod-shaped unmanaged organiser (39 of 51 prod pages are ownerless), design record linked in the PR body, and a Verified / Not verified block in the hand-off.
