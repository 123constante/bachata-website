# Handover: teach-row-returns-to-review

Done: teachRowPath in personModel; PersonScreens `fromReview` prop uses it; OnboardingFlow passes it from Review rows, freezes the Review percent, Back/Done return to Review. New table test teachRowPath.matrix.test.tsx (37 tests green; fails on main since teachRowPath does not exist). All 672 onboarding tests green.
Left: browser walk at 390x844; PR creation (no PR opened: no gh, MCP not used); real-data shape survey.
tsc run on base ea16d47 + working tree: 0 errors in branch files. check:mojibake clean.
Not verified: browser walk, Supabase shape survey, admin app inventory, full pre-ship / CI jobs, bar percent assertion.
