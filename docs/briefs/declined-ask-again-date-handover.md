# Handover: declined-ask-again-date
Done: askAgainFrom (accessRequestModel.ts), declinedNextLine (onboardingModel.ts), P3 Welcome + /account use them (testids p3-ob-declined-next, declined-ask-again), /account shows decisionNote, tests, INVENTORY (coverage 9 of 13 touched/reused; 4 untouched by design), arc row.
Left: 390x844 walk on prod-shaped data; PR checks read; owner review.
Next: if a P3 Welcome with two declined pages should date per page, the line currently uses the newest decline (the safe, later date).
tsc run on HEAD before this commit: 0 errors in branch files. npm run lint: 34 of 34 links green. check:mojibake clean.
