# Handover: ticket-thanks-confirm

Done: readOrderStatus + parseOrderStatus, shared thanksCopy mapping, polling on the page, table-driven tests (orderStatus.test.tsx), design record.
Not done: bundle-budget main vs branch, 390x844 e2e, full CI-step run, independent review, PR body (no PR tool use yet).
Not verified: RPC body (admin branch claude/ticket-thanks-read is outside this session's repo scope; shape taken from the brief).

Continuation: RPC body read from prod (SELECT only); parseOrderStatus matches {status, ticket_count, event_title, event_date} + retry_later; the function maps expired to failed and ignores unknown refs (unknown). Polling = first read, then 2/4/8/15 s, max 8 repeats, cleared on unmount. Bundle: dancer-app first load 374.1 KB on main and on the branch (+0 B; already over its 374 KB budget on main, not this PR). New tests/e2e/ticket-thanks.spec.ts (needs VITE_ENABLE_PUBLIC_TICKETING=true, so not in the test:e2e gate list): 3 pass.
