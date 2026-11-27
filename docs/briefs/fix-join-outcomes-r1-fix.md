# Brief: fix-join-outcomes-r1-fix (WEBSITE, Sonnet, ONE fix round on PR #1257). Branch claude/fix-join-outcomes-r1 (continue it; never push another).

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY.

Independent review: `git show origin/claude/review-1257-r1:docs/review/pr-1257-r1.md` (PASS WITH NITS). Apply exactly these, nothing else:
1. Drop the unrelated binaries from the PR: `git checkout origin/main -- docs/handover/dancer-rebuild-w2a docs/handover/dancer-rebuild-w2b docs/handover/dancer-rebuild-w2d docs/handover/dancer-rebuild-w2e` (all 27 png) and revert `docs/handover/INVENTORY.md` ONLY if it is not the join outcome inventory the worker wrote (if it is yours, keep it). `git diff --stat origin/main...HEAD` must then list only src/modules/admin-organisers/join/**, your handover and your inventory.
2. N1: JoinPage.tsx ~line 197: invalidate ORGANISER_HOME_KEY on every `done`, drop the `from === 'join'` guard. Add a test row proving it on the claim path.
3. N2: rename the misleading test in joinOutcomes.table.test.tsx:45 ("an empty tap hands '' up; the page validates") and add a page row: empty Send -> `join-email-error` = JOIN_COPY.email.badShape and no send call. Run the review's mutation D to prove it goes red.
4. N3: add `invalid` and a thrown-RPC (network) row to the post-sign-in `it.each` in joinJourney.test.tsx.
Run `npx vitest run src/modules/admin-organisers/join` and every CI job step you can; put the per-job table in the PR body. Update the handover. Commit subject ends [worker-done <ticket>].
