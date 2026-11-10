# Brief: independent design review r2, ticketing price steps (row 310 follow-up). Lane: careful (money), docs only, read-only. Opus.
Review, do NOT build. You are a different reviewer from r1.
Inputs: branch claude/revise-ticketing-design at aa2831871 (git fetch it): docs/briefs/design-ticketing-organisers.md, docs/briefs/contract-ticket-tiers.md, docs/review/ticketing-design-fixes-r1.md (fix table). Prior findings: branch claude/review-ticketing-organisers, docs/review/ticketing-organisers-r1.md (F1-F8, 3 HIGH).
INVENTORY (first step): write INVENTORY.md (every price/tier/step field, state, option in admin app c:/dev/bachata-admin-11april, Website, public page; file:line; GAPs) BEFORE judging; end with a coverage count.
Task:
1. For each r1 finding, state CLOSED / PARTLY / OPEN against the revised docs, with the exact section that closes it. A closure that only restates the finding is OPEN.
2. Close G-1 and G-3 by reading the ADMIN repo (c:/dev/bachata-admin-11april: supabase/functions ticket-checkout edge, supabase/migrations): which reserve version does the deployed edge call; do v1-v3 reserves exist on prod (read-only SELECT on stsdtacfauprzrdebmzg, function defs and counts only, no personal data, never a write). Does the revised T2 route/retire them correctly?
3. Re-test the money invariants: buyer never pays a price the page did not show; price_changed fails closed on a missing expected-price key; London-time step boundaries incl. DST gap/overlap; price 0 vs steps; promo preview and public lists use the seam; explicit GRANT/REVOKE list complete.
4. For F1-F3 give a mutant or test the build must include.
Output: docs/review/ticketing-organisers-r2.md on your branch, verdict PASS or HOLD, plus a Verified / Not verified block. Push to your branch only.
