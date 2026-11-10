# INVENTORY: declined-request surfaces (declined-ask-again-date)

Scope: declined-request surfaces only. Admin repo (bachata-admin-11april) is not in this sandbox, so admin rows are by brief/contract, not file:line (Not verified).

| # | Item | Where | Covered by this slice |
|---|---|---|---|
| 1 | P3 Welcome declined card + rows | src/modules/organiser/p3/onboarding/OnboardingFlow.tsx:672-683 | yes |
| 2 | P3 line "X said no on <date>." | onboardingModel.ts `declinedLine` | unchanged |
| 3 | P3 "Their note" (decisionNote) | OnboardingFlow.tsx:678 | unchanged |
| 4 | P3 next line `p3-ob-declined-next` (DECLINED_NEXT, no date) | onboardingModel.ts, OnboardingFlow.tsx:681 | yes (dated line) |
| 5 | /account declined card + row | src/modules/organiser/home/onboarding/OnboardingView.tsx:238-252 | yes |
| 6 | /account "reason not shown" / "ask again with a note" (no date) | OnboardingView.tsx:246 | yes |
| 7 | /account decisionNote not shown | OnboardingView.tsx | yes |
| 8 | Visible window 30 days, newest per organiser | accessRequestModel.ts `declinedRequests`, DECLINED_VISIBLE_DAYS | reused |
| 9 | resolvedAt null falls back to createdAt | accessRequestModel.ts | yes (askAgainFrom) |
| 10 | DECLINED_RECENTLY_COPY "ask again after 30 days" | selfServeErrors.ts:30 | no (file out of scope by brief) |
| 11 | PublicClaimCard refusal | src/modules/organiser/shared/components/PublicClaimCard.tsx | no (reads item 10, no change) |
| 12 | Admin resolve decline / declined_recently 30-day cooldown | admin repo | no (not available; contract per brief) |
| 13 | Tests: welcomeDeclined.matrix, refusal.screenMatrix | p3 __tests__ | yes |

Coverage: 9 changed or reused / 13 total; 4 deliberately untouched (2, 3 unchanged; 10, 11, 12 out of scope or unavailable).
