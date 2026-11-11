# Brief: Honest wording when a join request is refused in cooldown
Brief-version: 2
Branch: claude/declined-recently-copy
Lane: normal, Sonnet. bachata-website, must not touch supabase/**, src/integrations/supabase/types.ts, or any component file.
Serves: a dancer whose "Ask to join" was declined and who asks the same page again within 30 days, and an interim manager whose Add someone is refused.

## What main lacks
- No copy for the `declined_recently` refusal (30 days after a decline, admin I1 #1284), so the person sees the generic failure line -- grep: declined_recently
- No copy for the `interim_cannot_add` refusal -- grep: INTERIM_CANNOT_ADD_COPY
- extends: both new codes must sit in the one COPY mapping so every screen that shows a refusal gets them -- src/modules/organiser/shared/selfServeErrors.ts

## Files
src/modules/organiser/shared/selfServeErrors.ts
src/modules/organiser/shared/__tests__/selfServeErrors.onboarding.test.ts
docs/arcs/organiser.md

Update the I5 row in docs/arcs/organiser.md (Status, Blocked by, PR link) in the same PR.

## What to build
1. `declined_recently` -> "The page said no to your last request. You can ask again after 30 days, or message us." next: contact_support.
2. `interim_cannot_add` -> "While this page has no owner, only the Bachata Calendar team can add people. Share the page link and ask them to tap Ask to join." next: null.
3. Both codes are returned by the same lookup the existing request and team-add error paths already call, so no component changes.

## Tests
Table-driven, red first: code x (message text, next step, no raw code shown, no copy mentioning a control that is absent). Run them against unfixed code first.

## Done when
Tests and every CI job step green; PR body carries Verified / Not verified (Not verified: a live refusal from prod, as no declined request is in cooldown); arc row updated.
