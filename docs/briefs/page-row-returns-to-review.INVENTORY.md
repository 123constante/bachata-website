# INVENTORY: page rows opened from Review (written before the build)

Scope: Website organiser onboarding only. The admin app and the public page have no equivalent of the Review
checklist, so there is nothing to inventory there (count 0).

| # | Item | Where (file:line on main) |
|---|------|---------------------------|
| 1 | Review row `org_link` -> step `link` | pageModel.ts REVIEW_ROWS (`org_link`) |
| 2 | Review row `org_category` -> step `cat` | pageModel.ts REVIEW_ROWS (`org_category`) |
| 3 | Review row `org_logo` -> step `logo` | pageModel.ts REVIEW_ROWS (`org_logo`) |
| 4 | Review row `contact_confirm` -> step `contact` / `contact-phone` (`contactEntry`) | pageModel.ts REVIEW_ROWS, `contactEntry` |
| 5 | Review `onRow` page branch (no marker before) | OnboardingFlow.tsx `onRow` |
| 6 | Stage `page` shape | OnboardingFlow.tsx `type Stage` |
| 7 | Page Continue: save, then `next()` / `afterContact` | OnboardingFlow.tsx `continueStep`, `next` |
| 8 | "No public number" -> `cat` | OnboardingFlow.tsx `noNumber` |
| 9 | Back mapping `prev()` | OnboardingFlow.tsx `prev` |
| 10 | Save failure shows `p3-ob-error` in the foot, no navigation | OnboardingFlow.tsx `fail`, `errorLine` |
| 11 | Progress bar percent | OnboardingFlow.tsx `percentAt`, ReviewScreen `reviewPercent` |
| 12 | Other entries: welcome, Find, Create, deep link `at=` | OnboardingFlow.tsx Stage init, `next` |

Coverage: 12 / 12 covered (rows 1-4 by pageRowPath.matrix.test.tsx; 5-9, 11 by the Review-entry cases; 10 by the
refused case; 12 by the deep-link cases).

Note: the brief says person rows carry `review: { percent }` and a `teachRowPath` exists. Neither is on this main;
only the page side was built.
