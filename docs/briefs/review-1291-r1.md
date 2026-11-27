# Brief: independent review of PR #1291 (fix-join-first-batch), docs only

Lane: careful read-only review. Model: Fable (builder was Opus). Branch: claude/review-1291-r1. Review ONE round; no code edits; no push to the PR branch.
Target: PR #1291 on 123constante/bachata-website, head 655c43f9 (fetch origin claude/fix-join-first-batch). Read its docs/handover/fix-join-first-batch.md and docs/design/fix-join-first-batch/INVENTORY.md first.
Owner decisions it must obey: used link signs in automatically when signed in as the redeemer; Continue after the checklist returns to the SAME event the refused edit came from; Home banner says exactly "Finish your details first to create or edit events. It takes about five minutes."; the gate stays strict.

## Must check (each with a verdict and file:line)
1. returnTo (src/modules/organiser/p3/onboarding/returnTo.ts): open-redirect cases (//host, https:, backslash, encoded slashes, javascript:), another organiser's event path, stale path, no loop on Back. Try to break validate().
2. Used-link sign-in (inviteModel.ts, join/JoinPage.tsx, joinModel.ts): the worker's own known gap, a SAME-NAME page counted as membership on a used link. Prove with a failing test whether a signed-in person with a similarly named page can be sent to a page that is not theirs, or can learn whose invite it was. Signed in as someone else must never reveal whose.
3. Banner string appears once per screen, no remaining "works as usual" anywhere (grep the tree).
4. Matrix tests really assert the specified cells (banner 5 counts x roles, return, used link 4 states x 3 viewers); they must fail on the old code.
5. The e2e fix 655c43f9: the gate-sheet specs now accept &back=; confirm they still assert the Review destination and nothing weaker than needed.

## Mutants (all must turn a test red; report a table)
M1 returnTo accepts //evil.example. M2 used link for a signed-in OTHER account routes to the page home. M3 banner keeps the old second sentence. Add one mutant for the same-name case.

## Output
docs/reviews/1291-r1.md: verdict PASS / FIX (ranked findings with severity) / BLOCK, mutant table, Not verified list. Push once. Supabase read-only. Never merge or approve. git fetch origin main first.
