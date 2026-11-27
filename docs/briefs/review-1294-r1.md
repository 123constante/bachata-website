# Brief: independent review of PR #1294 (door short-code check-in screen, flag OFF), docs only

Lane: normal read-only review. Model: Fable (builder was Opus). Branch: claude/review-1294-r1. One round, no code edits, no push to the PR branch.
Target: claude/ticket-door-code-screen head f4449a82 (fetch it). Read docs/handover/ticket-door-code-screen.md and docs/design/ticket-door-code-screen/INVENTORY.md first.
## Must check (verdict + file:line each)
1. Flag OFF is byte-for-byte today's behaviour (no import, no call, no markup change reachable) and the flag is read in ONE place.
2. Short-code path: normalisation matches the RPC (case, spaces, dashes; alphabet without 0/O/1/I/L); a malformed code is never sent; a QR token or URL still goes to ticket_check_in_v1; nothing sends twice (double tap, Enter + button, list + box at once).
3. Every RPC result (read the real RPC bodies read-only on prod: ticket_check_in_by_code_v1, ticket_check_in_by_id_v1, ticket_check_in_v1) has exactly one row in RESULT_TABLE with words and one next action; too_many_attempts leads to the Tonight list where Check in works; no copy points at a control that is not on screen.
4. Roles: who may see the Check in buttons and the code box matches the RPC permission (door staff vs owner/editor/contributor/admin vs off-team); a role the RPC refuses never gets an enabled control without a reason.
5. Wrong-event and already-checked-in answers can never read as success; list refresh after a check in; 120-row list.
6. Tests: run the matrix on the unfixed code (expect red), re-run; add two mutants of your own (a result code mapped to the wrong row; Check in shown to off-team) and report a table. Bundle: confirm 0 bytes added.
## Output
docs/reviews/1294-r1.md: verdict PASS / FIX / BLOCK, ranked findings, mutant table, Not verified. Push once. Supabase read-only. Never merge or approve. git fetch origin main first.
