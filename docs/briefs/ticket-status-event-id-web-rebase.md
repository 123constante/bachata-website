# Continuation: #1382 (T8 Website half) -- bring the branch up to date with main

Repo 123constante/bachata-website. Branch claude/ticket-status-event-id-web (SAME branch, PR #1382, head 98416c8bd). Lane normal, Sonnet.

Independent check found the PR green on its own base but the branch is 97 commits behind main (merge-base ea16d4711) and conflicts in src/modules/tickets/TicketThanksPage.tsx: main added a "See your tickets" link there (data-testid tickets-thanks-my-tickets, shown when state is paid and a user is signed in), a 'See your tickets link' test block in src/modules/tickets/__tests__/orderStatus.test.tsx and a useAuth mock.

Do:
1. `git fetch origin main` then `git merge origin/main` into the branch (a merge commit, not a rebase, so the PR history stays). Resolve TicketThanksPage.tsx keeping BOTH links: main's "See your tickets" and the new "Back to the event"; keep "Back to what's on" last. Resolve orderStatus.test.tsx keeping main's block and the one-line `eventId: null` addition.
2. Add the missing test rows for the `processing` state (gave up polling) with eventId set and null, in orderStatus.eventLink.test.tsx.
3. Re-run: vitest src/modules/tickets, tsc --noEmit -p ., npm run check:mojibake, lint chain for touched files. Update the PR body Checks line with the new counts (keep labels exactly; run both check scripts as the standing instructions say).
4. ONE final push (no [skip preview] on it, the previous push already used one preview), last commit subject ending "[worker-done <ticket>]".
Do not change anything else. Write a 5-line handover appended to docs/briefs/ticket-status-event-id-web.handover.md.
