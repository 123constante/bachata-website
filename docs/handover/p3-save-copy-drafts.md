# Handover: P3 save copy for drafts (continuation c1)

Rebuilt on current main (merged origin/main 61c9706; branch was DIRTY from an old merge-base).
`model/saveWords.ts`: `saveWordsFor(oneDate, lifecycle)` is the one mapping, a function of BOTH facts.
- oneDate/many wording and button words (`Save` / `Save for all dates`) exactly as main; `hasOneDate` kept.
- Lifecycle source: `ws.series.lifecycle_status` (prod counts: archived 653, live 69, ended 21, draft 14, paused 2).
- Live column = main byte for byte (pinned in the matrix test). Draft: "... as a draft. Dancers do not see it yet."
  Paused: "... It is paused, so dancers do not see it." Ended/archived/cancelled/null/unknown: no claim about dancers.
- Session toasts (`savedEvery/savedDate/addedEvery/addedDate`) live in the same mapping; they ignore oneDate.
- Removed from labels.ts: savedEvery, savedDate, addedEvery, addedDate, detailsSaved, detailsSavedOne, pricesSaved.
- Updated: claimEdit.matrix.test.tsx, editScreens.send / sessions.send tests, DetailsScreen, PricesScreen, SessionSheet.

Red first: new `model/__tests__/saveWords.matrix.test.ts` (2 date-states x 9 lifecycles x 6 messages + 5).
Against main's saveWords the suite cannot run at all (no lifecycle arg, no session messages): "no tests" = red.
Green: p3 vitest 4126 passed; build + check:bundle-budget ok; tsc clean in p3; eslint: only an existing error in
untouched onboarding/OnboardingFlow.tsx.
Not verified: browser walk at 390x844, `/code-review` round, PR checks (PR must be re-checked not DIRTY after push).
