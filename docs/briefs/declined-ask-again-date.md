# Brief: A declined organiser request says when you can ask again
Brief-version: 2
Branch: claude/declined-ask-again-date
Lane: normal, Sonnet. bachata-website, must not touch supabase/**, the calendar density-exclusion files or selfServeErrors.ts copy
Serves: a person whose request to join an organiser page was declined and who is about to try again (goal: 10 organisers claim a page and update an event)

## What main lacks
- extends: the declined line on P3 Welcome says "You can ask again" although the server refuses a repeat request for 30 days (declined_recently) -- src/modules/organiser/home/onboarding/onboardingModel.ts
- extends: the /account declined row says "ask again with a note" with no date, and says the reason is not shown although decisionNote is already fetched -- src/modules/organiser/home/onboarding/OnboardingView.tsx
- a shared helper that names the first day a person can ask again -- grep: askAgainFrom
- a testid for the ask-again line on both screens -- grep: declined-ask-again

## Files
docs/arcs/organiser.md
src/modules/organiser/home/onboarding/onboardingModel.ts
src/modules/organiser/home/onboarding/OnboardingView.tsx
src/modules/organiser/p3/onboarding/OnboardingFlow.tsx
src/modules/organiser/shared/accessRequestModel.ts
src/modules/organiser/p3/onboarding/__tests__/welcomeDeclined.matrix.test.tsx
src/modules/organiser/p3/__tests__/refusal.screenMatrix.test.tsx
src/modules/organiser/home/onboarding/__tests__/declinedAskAgain.test.ts (new)

Update the row in docs/arcs/organiser.md for this slice (Status, Blocked by, PR link) in the same PR (owner decision 2026-11-06); add it if absent.

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end. Scope it to the declined-request surfaces: P3 Welcome (OnboardingFlow.tsx declined card), /account OnboardingView declined card, PublicClaimCard refusal, selfServeErrors DECLINED_RECENTLY_COPY, admin resolve decline.
1. In accessRequestModel.ts add `askAgainFrom(resolvedAt, createdAt)`: the answered date plus DECLINED_VISIBLE_DAYS (30, the server cooldown of declined_recently), as an ISO date. In onboardingModel.ts add `declinedNextLine(iso, now)` returning "You can ask again from <Friday 12 December>, or ask to join a different page from Find your page." Full weekday names, British English. Replace DECLINED_NEXT use on P3 Welcome (data-testid `p3-ob-declined-next`, keep it) with this line.
2. /account (OnboardingView declined row): replace the "ask again with a note" line with the same ask-again line (data-testid `declined-ask-again`), and show `decisionNote` as in OnboardingFlow ("Their note: ...") instead of "The reason is not shown here yet" when a note exists; with no note, say nothing about a reason.
3. No copy may name a control that is not on screen, and no screen may offer "ask again" before the date.

## Tests
Table-driven, red first (run against unfixed code before the fix): resolved today / 15 days ago / 29 days ago x note present / absent x screen (P3 Welcome, /account) x requests of one or two organisers; the date equals resolvedAt + 30 days in London time; a request with null resolvedAt falls back to createdAt. Update welcomeDeclined.matrix and refusal.screenMatrix to the new line; add a case that no declined line says "ask again" without a date.

## Done when
- Tests above green, `npm run lint` chain and tsc clean, every CI job step run, PR checks green.
- Walked at 390x844 on prod-shaped data: a declined request with a note, without a note, two declined pages.
- INVENTORY.md written first, coverage count reported (covered / total).
- PR body carries a Verified / Not verified block; the arc-file row is updated in the same PR.
