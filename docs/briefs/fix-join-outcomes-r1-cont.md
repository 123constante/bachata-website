# Brief: fix-join-outcomes-r1 CONTINUATION (verify, do not rebuild)

Lane: normal. Model: Sonnet. Branch: claude/fix-join-outcomes-r1 (PR #1257, head 8cebfeb). Read `docs/handover/fix-join-outcomes-r1.md` and the first brief `docs/briefs/fix-join-outcomes-r1.md` (branch brief/fix-join-outcomes-r1).

The first worker built the change in two minutes and ran NO gate. Your job is to prove it and finish the PR. Change code only where a proof fails.

0. INVENTORY FIRST: write `INVENTORY.md` (in `docs/handover/`) listing every redeem outcome the server `redeem_organiser_invite_v1` can return (read its live body read-only) and every screen/state of the join page (admin app invite issue screen, current Website join page, public invite page), with file:line, GAPs listed. End the PR work with a coverage count: N outcomes, N mapped to a screen, none silently omitted.
1. Red first: check out the new test file `join/__tests__/joinOutcomes.table.test.tsx` against the UNFIXED `JoinPage.tsx`/`joinModel.ts` (main versions) and record how many rows are red. If none are red, the test is vacuous: strengthen it until the old code fails.
2. Add one PAGE-level test for the post-sign-in path: a person-bound invite, claim `no_match`, redeem returns each of `email_mismatch`, `email_unproven`, `rate_limited`, `team_full`, `not_linked` -> the screen shown, and "told" copy ONLY for `not_linked`. (Mock the supabase calls the way the existing join tests do.)
3. Run every CI job step that applies (read `.github/workflows`): `npm run lint` (full chain), the join + admin-organisers vitest, `npm run build`, `npm run check:bundle-budget` (0 bytes to /app first load), `npm run test:e2e` and the join e2e at 390x844. Put a per-job table in the PR body.
4. Survey read-only on prod (counts only): open organiser invites by kind (email-bound / person-bound / unbound), and count of `organiser_invite_redeem_attempts` by outcome.
5. PR body: Summary, Data source (the facts in the first brief), "Verified on real data" with Verified / Not verified, a "Phone QA" section with 3-6 steps at 390x844 and the sizes checked. Labels need >= 12 characters on the SAME line. Do not say the PR creates a branch only.
6. Push once at the end, last commit subject ending `[worker-done dt_<ticket>]`.

Hard limits as in the first brief: no DB change, no gate flag, no P3 files, zero bytes to /app first load.
