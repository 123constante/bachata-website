# Fix round: PR #1429 (raffle board screens R3b-2) after independent review: BLOCK
Branch: claude/raffle-r3b-board-screens (existing PR #1429). Careful lane, Opus. Flag VITE_ENABLE_RAFFLE_V2 stays OFF; never flip it.
Review (BLOCKER + "Other fixes" sections; each fix names its own check):
`git show origin/claude/review-door-raffle-1439-1429:docs/review/review-door-raffle-1439-1429.md`
Blocker: board parser must read the real RPC keys `start_local` and `venue_name` (read the live RPC body read-only on prod first and state it), and fixtures in src/lib/__tests__/raffleBoardFixtures.ts must use the real keys, so a wrong-key fixture goes red.
Do: fix the blocker and every other listed fix; merge main first; run the reviewer's mutants and test commands, all killed/green; npm run check:bundle-budget on main vs branch (0 bytes to /app first load). One push. One fix round.
Verified / Not verified block in PR body.
