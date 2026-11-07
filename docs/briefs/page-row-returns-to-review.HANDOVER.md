# Handover: page-row-returns-to-review
Done: pageRowPath + pageRowExit (pageModel.ts); Stage page `review {percent, entry}`; Review onRow sets it; PageScreens
exits to Review (invalidating p3-ob, p3-ob-status) after the row's save and on Back; Continue test id
`p3-ob-page-row-return` from Review; matrix test (27 cases, 15 red on unfixed main, all green now).
Left: prod shape survey, 390x844 phone walk, PR body, review (/code-review).
tsc (tsconfig.app.json): 1 error in OnboardingFlow.tsx (dancer.data first_name unknown), identical on main, not mine.
