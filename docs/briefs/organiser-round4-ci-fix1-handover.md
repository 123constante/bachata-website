# Organiser R4 ci-fix1 handover
Done: full weekday/month names in p3/r4 (R4Tickets, r4DoorInviteModel, r4EventsModel DAYS/MONTHS + shortDay output, doc comments); \u escapes in r4NightModel and r4TeamModel; matrix tests under p3/r4/__tests__ updated. No board chip exception needed.
Left: nothing.
Verified: npx vitest run src/modules/organiser: 367 files, 14347 passed. check:mojibake clean.
tsc run on HEAD (tsconfig.app.json): 0 errors in branch files.
Not verified: other CI jobs, phone walk (copy-only change).
