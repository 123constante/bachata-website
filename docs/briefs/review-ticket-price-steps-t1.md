# Review: admin PR #1395 (ticket price steps T1) at head 7a0972e3 — independent, read-only

Repo to review: 123constante/bachata-admin, PR #1395, branch claude/ticket-price-steps-t1, head 7a0972e38422f35a324c6607c52cd9104c0872e5.
Review branch (Website repo, docs only): claude/review-ticket-price-steps-t1. Output: docs/review/ticket-price-steps-t1-r1.md. No PR. Do not edit the admin PR. Supabase read-only.

## Reference
The FINAL design that T1 must follow: docs/briefs/design-ticketing-organisers.md and docs/briefs/contract-ticket-tiers.md on branch claude/revise-ticketing-design (head 5d280fec1), section 5 (T1 scope), plus fix tables docs/review/ticketing-organisers-r1.md, -r2.md, -r3.md on the review branches. Money-bearing: the lead merges this PR itself on your PASS.

## Check
1. Every s.5 T1 item implemented; nothing from T2/T4 leaked in (v5 reserve, edge change).
2. Seam: one price function (+ _at) used by all summaries/preview/lists; step set/remove/list RPCs; manage_v1; reserve_not_ready gate; callerless-only retirement of old reserves (verify "callerless" against the admin repo and edge functions); N4 price guard (upsert refuses price 0 while steps exist).
3. ACL: explicit GRANT/REVOKE list per new function and table (incl. service_role, anon, PUBLIC); no function callable by anon that mutates; RLS on ticket_price_steps. London-time editor rules, DST non-existent times refused.
4. Prod shapes: read-only counts on prod (project stsdtacfauprzrdebmzg): ticket types by status, with/without steps, free, huge; state each as a prediction vs result.
5. Run the PR's own tests (tests/ticketPriceSteps*.test.ts, ticketDoorGate, check-ticket-price-seam) and the replay proof if runnable; report CI job results at the head (run-ci label was added; checks are running).
6. MUTANTS (required, at least 5): e.g. seam ignoring a step; step boundary off-by-one (<= vs <); price_changed passing when expected price omitted; GRANT to anon left in; N4 guard removed; a retired reserve left callable. For each: apply on a scratch copy, run the relevant test, report KILLED/SURVIVED. A survivor = finding.

## Verdict
PASS or HOLD, findings ranked HIGH/MED/LOW with file:line. Stopping rule: ONE round; list exact fixes. End with Verified / Not verified.
