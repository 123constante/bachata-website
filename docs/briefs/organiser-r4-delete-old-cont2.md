# Continuation 2: organiser R4 delete old P3 + V2 screens

Branch `r4-delete-old` holds two workers' commits. Read `docs/handover/organiser-r4-delete-old.md` on the branch: its second "Left (next steps)" list (items 1-5, e2e gate first) is YOUR task. Original brief: `docs/briefs/organiser-r4-delete-old.md` on `brief/r4-delete-old`.

Order, because earlier workers ran out of context before opening the PR:
1. Fix the 29 red P3 e2e tests (details in handover). Delete `organiser-night-reminder.spec.ts` (Reminders row is OUT) with its `package.json` and coverage entries. For ticket-door-scanner: update to the R4 door; the 42px "Scan next" is a possible REAL tap-target bug (must be 44px+): fix it in the R4 door CSS if it is real.
2. Push, then OPEN THE PR as soon as `test:e2e:p3` is green (body must pass both check scripts; Phone QA = mock walk 390x844 of Home, Events, a night, Tickets, Team, Compare).
3. Then delete the dead code the handover lists (DashHome, CompareNights, DashEvents, TicketsA + flag organiserTicketsA, ShareLinkCard, GetPaidPrompt/TicketsSoldTile and their tests). Push again.
4. `check:bundle-budget`, `check:integrity`, `pre-ship`, `lint`.

Rules: no product change; Raffle stays OUT; "Message everyone" and Reminders row stay OUT. The missing `p3Toast` "Removed from your events." on R4Events is a pre-existing R4 gap: do NOT fix it, list it under Not verified. Never commit e2e screenshot overwrites (docs/handovers/**/*.png): `git checkout origin/main -- docs/handovers` before each commit. Update the handover with remaining items and mark PARTIAL if you run low on context.
