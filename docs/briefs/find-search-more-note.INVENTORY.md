# Inventory: Find (search for your page) cut-short note

Sources checked: admin app (no Find-by-name screen there; claim is by admin assignment), current Website, public page (no search).
Line numbers are on main at 2222f75 unless marked "new".

| # | Field / state / option | Source | Where | Covered |
|---|---|---|---|---|
| 1 | Query read `.limit(8)` | Website | selfServeApi.ts:163 | yes (now `limit` param) |
| 2 | Default limit 8 for other callers | Website | selfServeApi.ts:153 | yes (`FIND_LIMIT`, default) |
| 3 | NewPageFlow caller (`searchClaimableOrganisers(name)`) | Website | newpage/NewPageFlow.tsx:90 | yes, unchanged |
| 4 | Home onboarding caller | Website | home/onboarding/OnboardingView.tsx:71 | yes, unchanged (default 8) |
| 5 | P3 `findPages` default read | Website | p3/onboarding/pageApi.ts:101 | yes (asks FIND_LIMIT + 1) |
| 6 | Find: under-two-letters state | Website | OnboardingFlow.tsx:~797 | unchanged |
| 7 | Find: error + retry (`p3-ob-find-retry`) | Website | OnboardingFlow.tsx:~800 | unchanged, tested |
| 8 | Find: searching state | Website | OnboardingFlow.tsx:~804 | unchanged |
| 9 | Find: empty state | Website | OnboardingFlow.tsx:~806 | unchanged, tested (0 rows) |
| 10 | Find: result rows (cap at FIND_LIMIT) | Website | OnboardingFlow.tsx:~810 | yes, tested 1/8/9/20 |
| 11 | Find: cut-short note `p3-ob-find-more` | Website | OnboardingFlow.tsx (new) | yes, tested |
| 12 | Invite note + support footer | Website | OnboardingFlow.tsx:~782 | unchanged (findFooter suite) |
| 13 | Public organiser page search | Public page | none exists | n/a |
| 14 | Admin app Find by name | Admin | none exists | n/a |

Coverage: 12 covered / 12 applicable (rows 13 and 14 have nothing to cover).
