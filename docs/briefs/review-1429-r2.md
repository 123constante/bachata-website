# Independent review: PR #1429 (raffle board screens R3b-2) at head b98e8931b14ce9fe5c5d5873ed8605c86798e916
Read-only review. Report branch: claude/review-1429-r2. NEVER push to claude/raffle-r3b-board-screens. Never approve or merge. Careful lane. Flag VITE_ENABLE_RAFFLE_V2 must stay OFF.

## Review target (explicit)
`git fetch origin main claude/raffle-r3b-board-screens claude/review-door-raffle-1439-1429`; review `git diff origin/main...origin/claude/raffle-r3b-board-screens`. Prior review (BLOCK): `git show origin/claude/review-door-raffle-1439-1429:docs/review/review-door-raffle-1439-1429.md`. Fix handover on the PR branch: docs/briefs/fix-1429-review-r1.handover.md. If head differs from b98e893, say so and review the current head.

## Must answer
1. The BLOCKER and every item under "Other fixes" in the prior review: for each, state FIXED / NOT FIXED with file:line and the test or check that proves it.
2. Prod contract, read-only: one SELECT of pg_get_functiondef for raffle_public_board_v1 (Supabase connector, SELECT only). List the keys it returns per night and compare with the keys src/lib/raffleBoard.ts reads. Any key the parser reads that the RPC does not return = BLOCK.
3. MUTATION: write 3 mutants of the parser / fixture-key contract test (e.g. read raw.start instead of raw.start_local; drop the key allow-list; swallow a missing key) and run the committed raffle tests against each; every mutant must turn a test red. Report any that stays green.
4. Flag: confirm VITE_ENABLE_RAFFLE_V2 is OFF at this head (grep config, .env*, vercel/CI env) and that no code path enables it without the flag.
5. Checks at head: `gh pr checks 1429`; name each job green/red/pending, especially `unit (Europe/London, full)` and `phone-qa (1/2/3)`; say if any red is also red on main.
6. Empty/past/huge board shapes: pool_count 0, no nights, 100+ nights: what does each screen show (file:line)?

## Output
docs/review/review-1429-r2.md: verdict PASS / PASS-with-fixes / BLOCK, findings ranked, mutants table, Verified / Not verified. Docs-only; delete any Phone QA section from a PR body. Final commit subject ends with [worker-done <ticket>].
