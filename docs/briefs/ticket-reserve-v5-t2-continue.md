# Brief: T2 continuation (reserve v5), careful lane

Repo 123constante/bachata-admin, branch claude/ticket-reserve-v5-t2. Read first: docs/handover/ticket-reserve-v5-t2.md on that branch, and ~/.claude/plans/HANDOVER-ticketing-lead-2026-11-11.md (Next 4).

## Who / what / how we know
- For ticket buyers and organisers: checkout reserve v5 refuses a stale price instead of charging it.
- After: reserve v5 (expected_total_pence, checkpoints a and b), public v3, preview/public v2 on the price-step seam, edge v5 path, hold-sweep cron, N4 guard.
- Known by: DB suites green, tsc clean, CI green, PR body has the evidence.

## Steps
1. T1 is squash-merged on main (5645c8e5). The branch still holds the pre-squash T1 history. Reset the branch to origin/main and cherry-pick 59df00a2 (applies cleanly, 10 files; lead verified). Force-with-lease push of the branch is expected and allowed.
2. Re-run tsc and the DB suites (tests/ticketReserveV5Db.test.ts, ticketMixedBasket, ticketPriceSteps*, ticketingP1/P2). Fix only real failures.
3. Close the handover "Not verified" gaps you can: DB cells for M-10 and M-16 if cheap. Do NOT deploy the edge function. Do NOT apply anything to prod (Supabase read-only).
4. Open the PR as the bot. Body: s.5 T2 privilege list, POST-APPLY ASSERTIONS (incl. cron.job ticket-hold-sweep-1m and the N4 guard run with --known-red=t1), prod survey counts (5 ticket orders: 2 paid, 2 expired, 1 refunded), `- Shapes surveyed:` line, per-job CI table, Verified / Not verified.
5. Leave the placeholder version 99990101010000; the lead assigns the real one at apply.
6. Stop with handover note in the PR. Lead adds run-ci, independent review, replay proof, apply.
