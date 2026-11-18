# Review: PR #1790 (organiser Round 4, flag organiserR4, default OFF) at head b8ca2d154

Independent review, ONE round. Risky classes only: routing (P3Routes.tsx, paths.ts), saves (R4EditNight, R4CancelSheet, CancelEventSheet, RefundSheet, R4Raffle, R4Team, R4DoorInvite), money surface (RefundSheet, TicketsEntry, r4TicketsModel), flag gating (featureFlags.ts: flag off must leave old screens byte-identical in behaviour), DB contract (any rpc/table read: check names exist, venue reads use COALESCE(co.venue_id, e.venue_id), no legacy tables).

Do: fetch branch claude/organiser-r4, diff against origin/main, read the risky files above, run `npx tsc --noEmit` and the r4 vitest matrix tests (`npx vitest run src/modules/organiser/p3/r4 src/modules/organiser/p3/door`). Do not review colours/layout (owner checks boards). Do not edit the PR branch.

Check specifically: (1) flag off = no route/behaviour change; (2) every new route reachable only behind organiserR4 and guarded for non-organisers; (3) refund/cancel/raffle/team save paths send a command only when changed, error states handled, no double-submit; (4) no raw Unicode punctuation in JSX (use entities); (5) no secrets, no migrations.

Output: write docs/review/pr-1790-organiser-r4.md with headings `## Verdict: PASS|PASS WITH NITS|BLOCK` and `## Hard-tier: PASS|FAIL`, findings as file:line, and an honest "Not verified". Push on your review branch.
