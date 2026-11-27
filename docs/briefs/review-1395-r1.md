# Independent review: ADMIN PR #1395 (ticketing T1) at head 7a0972e38422f35a324c6607c52cd9104c0872e5
Repo 123constante/bachata-admin, PR branch claude/ticket-price-steps-t1 (placeholder migration version). READ-ONLY. Money path. Never apply a migration, never merge or approve, never push to the PR branch. Report goes on claude/review-1395-r1 as docs/review/review-1395-r1.md. ONE round.

## Review target (explicit)
`git fetch origin main claude/ticket-price-steps-t1`; review `git diff origin/main...origin/claude/ticket-price-steps-t1`. Design: Website repo PR #1529 (branch claude/revise-ticketing-design) and review #1528 (branch claude/review-ticketing-organisers) findings F1-F11.

## Must answer
1. F1-F11: each addressed in the diff, with file:line, or listed as open.
2. Data source proven: read-only prod SELECTs (project stsdtacfauprzrdebmzg, no personal data) of the live ticket tables, RPC bodies and policies this migration touches; say which table/column each new function depends on and who writes it.
3. ACCESS: for every new/changed function and table list GRANT/REVOKE/RLS: who may call it (anon, authenticated, service_role, owner, manager); owner-only money fields (prices, refunds) hidden from managers; SECURITY DEFINER search_path; no PUBLIC execute left.
4. MUTATION: 3 mutants of the RPC guard/permission checks (e.g. drop the owner check, widen a GRANT to anon, skip the price validation) run through the repo's replay/test tooling if available; each must turn a test red. Report any that stays green.
5. Retire callerless reserves: prove callerless with grep across both repos and edge functions.
6. Migration-lane findings: placeholder version noted; order versus #1384 and #1387 (one in flight at a time); what the owner must approve (money) before apply.

## Output
Verdict PASS / PASS-with-fixes / BLOCK, findings ranked, mutants table, Verified / Not verified. Docs-only branch. Final commit subject ends with [worker-done <ticket>].
